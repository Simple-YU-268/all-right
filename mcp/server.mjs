import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseBank } from '../src/domain/parseBank.ts'
import { TEMPLATE, FIELD_ALIASES } from '../src/domain/bankTemplate.ts'
import BANK_JSON_SCHEMA from '../src/domain/bankSchema.json' with { type: 'json' }
import { bankSchema } from '../src/domain/bankSchema.ts'

const requestedOutput = process.env.ALLRIGHT_OUTPUT_DIR || process.cwd()
await mkdir(requestedOutput, { recursive: true })
const outputDirectory = await realpath(requestedOutput)
const server = new McpServer({ name: 'allright-mcp', version: '0.6.0' })
const inputSchema = {
  bank: z.unknown().describe('Source bank object or question array; never invent missing answers.'),
  expectedSourceCount: z.number().int().positive().optional().describe('Question count independently checked against the original document.'),
}
const response = (data, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  isError,
})

function inspect(bank, expectedSourceCount) {
  const original = structuredClone(bank)
  bank = structuredClone(bank)
  const sourceQuestions = Array.isArray(bank) ? bank : bank && ['questions', 'items', 'data', 'list', '题目', '试题'].map(key => bank[key]).find(Array.isArray)
  const assignedIds = []
  if (Array.isArray(sourceQuestions)) {
    const used = new Set(sourceQuestions.map(q => q && (q.id ?? q.key ?? q.code ?? q['编号'] ?? q['题号'])).filter(Boolean).map(String))
    sourceQuestions.forEach((q, i) => {
      if (!q || typeof q !== 'object' || Array.isArray(q)) return
      if (['id', 'key', 'code', '编号', '题号'].some(key => q[key] !== undefined && q[key] !== '')) return
      let id = `q${i + 1}`
      while (used.has(id)) id += '_'
      q.id = id
      used.add(id)
      assignedIds.push(id)
    })
  }
  const parsed = parseBank(bank)
  const unsupported = new Set()
  const supportedTypes = new Set(['single', 'multiple', 'multi', 'judge', 'truefalse', 'boolean', '单选', '单选题', '多选', '多选题', '判断', '判断题'])
  if (Array.isArray(sourceQuestions)) sourceQuestions.forEach((question, index) => {
    const type = question?.type ?? question?.['题型'] ?? question?.questionType
    if (type !== undefined && !supportedTypes.has(String(type).trim().toLowerCase().replace(/[\s_-]/g, ''))) unsupported.add(index)
  })
  const errors = parsed.issues.map(issue => ({
    code: issue.code ?? 'IMPORT_ERROR',
    path: issue.index ? `questions[${issue.index - 1}].${issue.field}` : issue.field,
    message: issue.message,
  }))
  const standard = bankSchema.safeParse({ name: parsed.name, questions: parsed.questions })
  if (!standard.success) for (const issue of standard.error.issues) {
    const [root, position, ...fields] = issue.path
    const sourceIndex = typeof position === 'number' ? parsed.sourceIndices?.[position] : undefined
    errors.push({ code: 'OUTPUT_SCHEMA', path: root === 'questions' && sourceIndex !== undefined ? `questions[${sourceIndex}].${fields.join('.') || 'question'}` : String(root), message: issue.message })
  }
  for (const index of unsupported) errors.push({ code: 'UNSUPPORTED_TYPE', path: `questions[${index}].type`, message: '题型不支持或无法明确识别，请保留原题并人工确认，不得改成选择题。' })
  function hasImage(value) {
    if (!value || typeof value !== 'object') return false
    if (value.type === 'image') return true
    return Object.values(value).some(hasImage)
  }
  if (hasImage(bank)) errors.push({ code: 'IMAGES_UNSUPPORTED', path: 'questions', message: 'This MCP version cannot export images. Use the desktop pack workflow.' })
  if (!parsed.questions.length && !errors.length) errors.push({ code: 'EMPTY_BANK', path: 'questions', message: '题库里没有可用的题目。' })
  const changes = collectChanges(sourceQuestions, parsed, assignedIds)
  const sourceCount = Array.isArray(sourceQuestions) ? sourceQuestions.length : 0
  if (expectedSourceCount !== undefined && expectedSourceCount !== sourceCount) errors.push({ code: 'SOURCE_COUNT_MISMATCH', path: 'questions', message: `原卷 ${expectedSourceCount} 题，提交 ${sourceCount} 题，数量不一致。` })
  const originals = Array.isArray(original) ? original : original && ['questions', 'items', 'data', 'list', '题目', '试题'].map(key => original[key]).find(Array.isArray)
  const items = (sourceQuestions ?? []).map((source, index) => {
    const position = parsed.sourceIndices?.indexOf(index) ?? -1
    const issues = errors.filter(error => error.path.startsWith(`questions[${index}].`) || error.path === 'questions')
    const status = unsupported.has(index) ? 'unsupported' : position < 0 || issues.length ? 'needs_review' : 'accepted'
    return { sourceIndex: index + 1, sourceId: source?.id ?? source?.['题号'] ?? null, status, issues,
      source: originals[index],
      ...(status === 'accepted' ? { question: parsed.questions[position] } : {}) }
  })
  const accepted = items.filter(item => item.status === 'accepted')
  const reviewCount = items.filter(item => item.status === 'needs_review').length
  const unsupportedCount = items.filter(item => item.status === 'unsupported').length
  return {
    valid: errors.length === 0 && accepted.length === sourceCount && sourceCount > 0,
    sourceCount,
    sourceCoverage: expectedSourceCount === undefined ? 'unverified' : expectedSourceCount === sourceCount ? 'count_matched' : 'count_mismatch',
    acceptedCount: accepted.length,
    rejectedCount: reviewCount + unsupportedCount,
    reviewCount,
    unsupportedCount,
    items,
    errors,
    warnings: parsed.warnings,
    changes,
    bank: { name: parsed.name, questions: accepted.map(item => item.question) },
  }
}

/** 记下整理过程改了什么，方便人和 Agent 复核，而不是悄悄改完就交。 */
function collectChanges(sourceQuestions, parsed, assignedIds) {
  const changes = []
  if (!Array.isArray(sourceQuestions)) return changes
  sourceQuestions.forEach((source, index) => {
    if (!source || typeof source !== 'object') return
    const position = parsed.sourceIndices?.indexOf(index) ?? -1
    const output = parsed.questions[position]
    if (!output) return
    const notes = []
    if (assignedIds.includes(output.id)) notes.push(`补了编号 ${output.id}`)
    if (!source.type) notes.push(`题型按答案判定为 ${output.type}`)
    const sourceAnswer = Array.isArray(source.answer) ? source.answer.join('、') : String(source.answer ?? '')
    if (sourceAnswer && sourceAnswer !== output.answer.join('、')) notes.push(`答案由 ${sourceAnswer} 规范成 ${output.answer.join('、')}`)
    if (!source.category) notes.push(`章节按「${output.category}」归类`)
    if (source.difficulty === undefined || source.difficulty === null || source.difficulty === '') notes.push(`难度默认 ${output.difficulty}`)
    if (!source.explanation) notes.push('没有解析，留空')
    if (notes.length) changes.push({ id: output.id, notes })
  })
  return changes
}

server.registerTool('get_bank_spec', {
  description: 'Get ALL RIGHT text-bank format and conversion policy. Read before converting source material.',
  inputSchema: {},
}, async () => response({
  template: TEMPLATE, aliases: FIELD_ALIASES, jsonSchema: BANK_JSON_SCHEMA,
  policy: ['Preserve original content and meaningful line breaks.', 'Never guess answers or silently skip questions.',
    'Every source question must appear in items as accepted, needs_review or unsupported. Counts must reconcile.',
    'Only single, multiple and judge questions are supported. Do not convert unsupported types into choices.',
    'Validation covers supplied data only; it cannot prove that the original document was fully extracted or that answers are correct.',
    'Return unresolved questions separately to the user.', 'normalize_bank returns a candidate, not permission to drop invalid items.',
    'This version exports text JSON only. Judge questions require type judge and answer [正确] or [错误]. Images need manual review.',
    'Validate, fix every error, then build_bank_file. File creation never changes the app workspace.'],
}))

server.registerTool('normalize_bank', {
  description: 'Normalize supported field aliases and answer formats using the app importer. Errors block export; review the candidate against the source.',
  inputSchema,
}, async ({ bank, expectedSourceCount }) => response(inspect(bank, expectedSourceCount)))

server.registerTool('validate_bank', {
  description: 'Check import compatibility plus unique IDs, option keys and answer counts. No file is written.',
  inputSchema,
}, async ({ bank, expectedSourceCount }) => {
  const { bank: candidate, ...result } = inspect(bank, expectedSourceCount)
  return response({ ...result, questionCount: candidate.questions.length })
})

server.registerTool('build_bank_file', {
  description: 'Validate and create a text JSON bank in the configured output directory. Never overwrites existing files.',
  inputSchema: { ...inputSchema, filename: z.string().max(120).regex(/^[\p{L}\p{N}_-]+\.json$/u).refine(name => !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])\.json$/i.test(name), 'Reserved Windows filename') },
}, async ({ bank, filename, expectedSourceCount }) => {
  const result = inspect(bank, expectedSourceCount)
  if (!result.valid) return response(result, true)
  try {
    const destination = path.join(outputDirectory, filename)
    await writeFile(destination, JSON.stringify(result.bank, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' })
    const { bank: candidate, ...report } = result
    return response({ path: destination, questionCount: candidate.questions.length, ...report })
  } catch (error) {
    return response({ code: error.code || 'WRITE_FAILED', message: error.message }, true)
  }
})

await server.connect(new StdioServerTransport())
