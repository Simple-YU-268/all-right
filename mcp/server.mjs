import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseBank } from '../src/domain/parseBank.ts'
import { TEMPLATE, FIELD_ALIASES } from '../src/domain/bankTemplate.ts'

const requestedOutput = process.env.ALLRIGHT_OUTPUT_DIR || process.cwd()
await mkdir(requestedOutput, { recursive: true })
const outputDirectory = await realpath(requestedOutput)
const server = new McpServer({ name: 'allright-mcp', version: '0.4.0' })
const inputSchema = { bank: z.unknown().describe('Source bank object or question array; never invent missing answers.') }
const response = (data, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  isError,
})

function inspect(bank) {
  bank = structuredClone(bank)
  const sourceQuestions = Array.isArray(bank) ? bank : bank && ['questions', 'items', 'data', 'list', '题目', '试题'].map(key => bank[key]).find(Array.isArray)
  if (Array.isArray(sourceQuestions)) {
    const used = new Set(sourceQuestions.map(q => q && (q.id ?? q.key ?? q.code ?? q['编号'] ?? q['题号'])).filter(Boolean).map(String))
    sourceQuestions.forEach((q, i) => {
      if (!q || typeof q !== 'object' || Array.isArray(q)) return
      if (['id', 'key', 'code', '编号', '题号'].some(key => q[key] !== undefined && q[key] !== '')) return
      let id = `q${i + 1}`
      while (used.has(id)) id += '_'
      q.id = id
      used.add(id)
    })
  }
  const judgeAnswers = new Map()
  const judgeErrors = []
  if (Array.isArray(sourceQuestions)) sourceQuestions.forEach((question, index) => {
    if (question?.type !== 'judge') return
    const answer = question.answer
    if (!Array.isArray(answer) || answer.length !== 1 || !['正确', '错误'].includes(answer[0])) {
      judgeErrors.push({ code: 'INVALID_JUDGE_ANSWER', path: `questions[${index}].answer`, message: 'Use exactly ["正确"] or ["错误"].' })
      return
    }
    if (!question.id) question.id = `judge-${index + 1}`
    judgeAnswers.set(question.id, answer)
  })
  const parsed = parseBank(bank)
  const errors = parsed.issues.map(issue => ({
    code: 'IMPORT_ERROR',
    path: issue.index ? `questions[${issue.index - 1}].${issue.field}` : issue.field,
    message: issue.message,
  }))
  errors.push(...judgeErrors)
  const ids = new Set()
  function hasImage(value) {
    if (!value || typeof value !== 'object') return false
    if (value.type === 'image') return true
    return Object.values(value).some(hasImage)
  }
  if (hasImage(bank)) errors.push({ code: 'IMAGES_UNSUPPORTED', path: 'questions', message: 'This MCP version cannot export images. Use the desktop pack workflow.' })
  for (const [index, question] of parsed.questions.entries()) {
    const prefix = `questions[${index}]`
    if (ids.has(question.id)) errors.push({ code: 'DUPLICATE_ID', path: `${prefix}.id`, message: question.id })
    ids.add(question.id)
    if (question.type !== 'multiple' && question.answer.length !== 1) {
      errors.push({ code: 'ANSWER_COUNT', path: `${prefix}.answer`, message: 'Single and judge questions require one answer.' })
    }
    if (new Set(question.options.map(option => option.key)).size !== question.options.length) {
      errors.push({ code: 'DUPLICATE_OPTION', path: `${prefix}.options`, message: 'Option keys must be unique.' })
    }
    if (question.options.some(option => !option.text)) {
      errors.push({ code: 'EMPTY_OPTION', path: `${prefix}.options`, message: 'Every text option needs content.' })
    }
    if (question.options.length < 2) errors.push({ code: 'TOO_FEW_OPTIONS', path: `${prefix}.options`, message: 'At least two options are required.' })
    if (question.type === 'judge') {
      if (judgeAnswers.has(question.id)) question.answer = judgeAnswers.get(question.id)
      else errors.push({ code: 'JUDGE_REVIEW', path: `${prefix}.answer`, message: 'Judge questions require explicit type and canonical answer.' })
    }
  }
  if (!parsed.questions.length && !errors.length) errors.push({ code: 'EMPTY_BANK', path: 'questions', message: 'At least one question is required.' })
  return { valid: errors.length === 0, sourceCount: sourceQuestions?.length || 0, acceptedCount: parsed.questions.length,
    errors, warnings: parsed.warnings, bank: { name: parsed.name, questions: parsed.questions } }
}

server.registerTool('get_bank_spec', {
  description: 'Get ALL RIGHT text-bank format and conversion policy. Read before converting source material.',
  inputSchema: {},
}, async () => response({
  template: TEMPLATE, aliases: FIELD_ALIASES,
  policy: ['Preserve original content and meaningful line breaks.', 'Never guess answers or silently skip questions.',
    'Return unresolved questions separately to the user.', 'normalize_bank returns a candidate, not permission to drop invalid items.',
    'This version exports text JSON only. Judge questions require type judge and answer [正确] or [错误]. Images need manual review.',
    'Validate, fix every error, then build_bank_file. File creation never changes the app workspace.'],
}))

server.registerTool('normalize_bank', {
  description: 'Normalize supported field aliases and answer formats using the app importer. Errors block export; review the candidate against the source.',
  inputSchema,
}, async ({ bank }) => response(inspect(bank)))

server.registerTool('validate_bank', {
  description: 'Check import compatibility plus unique IDs, option keys and answer counts. No file is written.',
  inputSchema,
}, async ({ bank }) => {
  const { bank: candidate, ...result } = inspect(bank)
  return response({ ...result, questionCount: candidate.questions.length })
})

server.registerTool('build_bank_file', {
  description: 'Validate and create a text JSON bank in the configured output directory. Never overwrites existing files.',
  inputSchema: { ...inputSchema, filename: z.string().max(120).regex(/^[\p{L}\p{N}_-]+\.json$/u).refine(name => !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\.json$/i.test(name), 'Reserved Windows filename') },
}, async ({ bank, filename }) => {
  const result = inspect(bank)
  if (!result.valid) return response(result, true)
  try {
    const destination = path.join(outputDirectory, filename)
    await writeFile(destination, JSON.stringify(result.bank, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' })
    return response({ path: destination, questionCount: result.bank.questions.length, warnings: result.warnings })
  } catch (error) {
    return response({ code: error.code || 'WRITE_FAILED', message: error.message }, true)
  }
})

await server.connect(new StdioServerTransport())
