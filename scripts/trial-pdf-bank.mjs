// Experimental adapter for papers with numbered questions and inline 参考答案.
// Private source material and reports stay in the caller-selected output directory.
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const [source, output] = process.argv.slice(2)
if (!source || !output) throw new Error('Usage: node scripts/trial-pdf-bank.mjs source.pdf output-directory')
await mkdir(output, { recursive: true })
const extracted = execFileSync('pdftotext', ['-layout', source, '-'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
const pages = extracted.split('\f')
const lines = pages.flatMap((page, index) => page.split(/\r?\n/).map(text => ({ page: index + 1, text })))
const chunks = []
for (const line of lines) {
  if (/专业网校课程/.test(line.text) || /^\s*\d+\s*$/.test(line.text)) continue
  const start = line.text.match(/^\s*(\d+)\.(.*)$/)
  if (start) chunks.push({ number: Number(start[1]), page: line.page, lines: [start[2]] })
  else if (chunks.length) chunks.at(-1).lines.push(line.text)
}
const questions = chunks.map(chunk => {
  const raw = chunk.lines.join('\n').trim()
  const answerMatches = [...raw.matchAll(/参考答案[：:]\s*([^\n]+)/g)]
  const before = raw.slice(0, answerMatches[0]?.index ?? raw.length)
  const answer = answerMatches.length === 1 ? answerMatches[0][1].trim() : ''
  const judge = ['对', '错', '正确', '错误'].includes(answer)
  const optionMatches = judge ? [] : [...before.matchAll(/^\s*([A-H])\.(.*?)(?=^\s*[A-H]\.|$(?![\s\S]))/gms)]
  return {
    id: `source-${chunk.number}`, category: judge ? '判断题' : '选择题',
    ...(judge ? { type: 'judge' } : {}),
    stem: (optionMatches.length ? before.slice(0, optionMatches[0].index) : before).trim(),
    options: optionMatches.map(match => ({ key: match[1], text: match[2].trim() })),
    answer,
    explanation: raw.split('【解析】').slice(1).join('【解析】').replace(/\s*(多项选择题|判断题)\s*$/, '').trim(),
  }
})
const client = new Client({ name: 'pdf-extraction-trial', version: '1.0.0' })
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve('mcp/launch.mjs')], env: { ...process.env, ALLRIGHT_OUTPUT_DIR: path.resolve(output) } }))
try {
  const bank = { name: path.basename(source, '.pdf'), questions }
  const result = await client.callTool({ name: 'normalize_bank', arguments: { bank } })
  const report = JSON.parse(result.content[0].text)
  const enriched = {
    source: path.resolve(source), adapter: 'numbered-inline-answer-experimental',
    coverage: 'Question boundaries detected automatically; original total and content require visual review.',
    pages: pages.filter(page => page.trim()).length,
    ...report,
    items: report.items.map((item, index) => ({ ...item, page: chunks[index].page, originalNumber: chunks[index].number, rawText: chunks[index].lines.join('\n') })),
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify(enriched, null, 2) + '\n')
  await writeFile(path.join(output, 'extracted.txt'), extracted)
  const built = await client.callTool({ name: 'build_bank_file', arguments: { bank, filename: 'trial-bank.json' } })
  if (!report.valid && !built.isError) throw new Error('Export incorrectly accepted an incomplete paper')
  console.log(JSON.stringify({ pages: enriched.pages, sourceCount: report.sourceCount, accepted: report.acceptedCount, review: report.reviewCount, unsupported: report.unsupportedCount, exportBlocked: Boolean(built.isError), issues: enriched.items.filter(item => item.status !== 'accepted').map(item => ({ number: item.originalNumber, page: item.page, issues: item.issues })), report: path.resolve(output, 'report.json') }, null, 2))
} finally { await client.close() }
