import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const directory = await mkdtemp(path.join(tmpdir(), 'allright-mcp-test-'))
const client = new Client({ name: 'allright-test', version: '1.0.0' })
const transport = new StdioClientTransport({
  command: process.env.ALLRIGHT_MCP_EXE || process.execPath,
  args: process.env.ALLRIGHT_MCP_EXE ? (process.env.ALLRIGHT_MCP_ENTRY ? [process.env.ALLRIGHT_MCP_ENTRY] : []) : [process.env.ALLRIGHT_MCP_ENTRY || path.resolve('mcp/launch.mjs')],
  env: { ...process.env, ALLRIGHT_OUTPUT_DIR: directory },
})
const call = async (name, args = {}) => {
  const result = await client.callTool({ name, arguments: args })
  return { ...JSON.parse(result.content[0].text), isError: result.isError }
}
try {
  await client.connect(transport)
  assert.equal((await client.listTools()).tools.length, 4)
  const bank = (await call('get_bank_spec')).template
  const spec = await call('get_bank_spec')
  assert.equal(spec.jsonSchema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.ok(spec.jsonSchema.properties.questions)
  const noIds = structuredClone(bank)
  noIds.questions.forEach(q => { delete q.id })
  assert.deepEqual((await call('normalize_bank', { bank: noIds })).bank, (await call('normalize_bank', { bank: noIds })).bank)
  const report = await call('normalize_bank', { bank: noIds })
  assert.equal(report.sourceCount, 3)
  assert.equal(report.acceptedCount, 3)
  assert.equal(report.rejectedCount, 0)
  assert.ok(report.changes.some(change => change.notes.some(note => note.includes('补了编号'))))
  assert.equal((await call('validate_bank', { bank })).valid, true)
  const judges = { name: 'judge', questions: ['正确', '错误'].map((answer, i) => ({ id: `j${i}`, type: 'judge', stem: '判断题', answer: [answer] })) }
  const normalizedJudges = await call('normalize_bank', { bank: judges })
  assert.equal(normalizedJudges.valid, true)
  assert.deepEqual(normalizedJudges.bank.questions.map(q => q.answer), [['正确'], ['错误']])
  const bad = structuredClone(bank)
  bad.questions[1].id = bad.questions[0].id
  assert.equal((await call('validate_bank', { bank: bad })).valid, false)
  assert.equal((await call('build_bank_file', { bank: bad, filename: 'bad.json' })).isError, true)
  const missing = structuredClone(bank)
  delete missing.questions[0].answer
  assert.equal((await call('normalize_bank', { bank: missing })).valid, false)
  missing.questions[2].options[1].key = missing.questions[2].options[0].key
  const located = await call('validate_bank', { bank: missing })
  assert.ok(located.errors.some(error => error.code === 'DUPLICATE_OPTION' && error.path === 'questions[2].options'))
  assert.ok(located.rejectedCount >= 1)
  assert.equal(located.items.length, missing.questions.length)
  assert.equal(located.sourceCount, located.acceptedCount + located.reviewCount + located.unsupportedCount)
  assert.deepEqual(located.items[0].source, missing.questions[0])
  const unsupported = structuredClone(bank)
  unsupported.questions[0].type = '简答题'
  const unsupportedReport = await call('normalize_bank', { bank: unsupported })
  assert.equal(unsupportedReport.valid, false)
  assert.equal(unsupportedReport.items[0].status, 'unsupported')
  assert.equal(unsupportedReport.unsupportedCount, 1)
  assert.equal((await call('build_bank_file', { bank: unsupported, filename: 'unsupported.json' })).isError, true)
  const mismatch = await call('build_bank_file', { bank, expectedSourceCount: 4, filename: 'incomplete.json' })
  assert.equal(mismatch.isError, true)
  assert.ok(mismatch.errors.some(error => error.code === 'SOURCE_COUNT_MISMATCH'))
  assert.equal((await call('validate_bank', { bank, expectedSourceCount: 3 })).sourceCoverage, 'count_matched')
  // These cases exercise public MCP calls, including app-parser compatibility.
  for (const answer of ['A或B', '可能A', 'A/B', 'A（待核实）', 1.5, 0]) {
    const candidate = structuredClone(bank)
    candidate.questions[0].answer = answer
    const checked = await call('normalize_bank', { bank: candidate })
    assert.equal(checked.valid, false, `Ambiguous answer accepted: ${answer}`)
    assert.equal(checked.items[0].status, 'needs_review')
    assert.deepEqual(checked.items[0].source, candidate.questions[0])
  }
  const chinese = { 题库名: '通信回归样本', 试题: [{ 题号: '原卷-7', 题型: '单选题', 章节: '通信原理', 题干: '第一行\n第二行', 选项: { A: '甲', B: '乙' }, 正确答案: 'A', 解析: '保留原文解析。' }] }
  const chineseResult = await call('normalize_bank', { bank: chinese, expectedSourceCount: 1 })
  assert.equal(chineseResult.valid, true)
  assert.equal(chineseResult.items[0].question.stem, '第一行\n第二行')
  assert.equal(chineseResult.items[0].question.explanation, '保留原文解析。')
  assert.deepEqual(chineseResult.items[0].source, chinese.试题[0])
  for (const type of ['boolean', 'true_false', '判断题']) {
    const checked = await call('normalize_bank', { bank: { name: '判断', questions: [{ type, stem: '原文', answer: false }] } })
    assert.equal(checked.valid, true)
    assert.deepEqual(checked.bank.questions[0].answer, ['错误'])
  }
  const mixedBank = { name: '混合卷', questions: [bank.questions[0], null, { ...bank.questions[1], type: '填空题' }, { ...bank.questions[2], answer: [] }] }
  const mixedReport = await call('normalize_bank', { bank: mixedBank, expectedSourceCount: 4 })
  assert.deepEqual(mixedReport.items.map(item => item.status), ['accepted', 'needs_review', 'unsupported', 'needs_review'])
  assert.equal(mixedReport.sourceCount, mixedReport.acceptedCount + mixedReport.reviewCount + mixedReport.unsupportedCount)
  assert.deepEqual(mixedReport.items.map(item => item.source), mixedBank.questions)
  const result = await call('build_bank_file', { bank, filename: 'bank.json' })
  assert.equal(result.questionCount, 3)
  assert.equal(result.items.length, 3)
  assert.equal(result.sourceCoverage, 'unverified')
  assert.equal(JSON.parse(await readFile(path.join(directory, 'bank.json'), 'utf8')).questions.length, 3)
  assert.equal((await call('build_bank_file', { bank, filename: 'bank.json' })).code, 'EEXIST')
  assert.equal((await call('build_bank_file', { bank, filename: '通信试卷.json' })).questionCount, 3)
  const traversal = await client.callTool({ name: 'build_bank_file', arguments: { bank, filename: '../escape.json' } })
  assert.equal(traversal.isError, true)
  if (process.env.ALLRIGHT_REAL_BANK) {
    const realBank = JSON.parse(await readFile(process.env.ALLRIGHT_REAL_BANK, 'utf8'))
    const realReport = await call('normalize_bank', { bank: realBank, expectedSourceCount: realBank.questions.length })
    assert.equal(realReport.valid, true, JSON.stringify(realReport.errors))
    assert.equal(realReport.items.length, realBank.questions.length)
    for (const [index, question] of realBank.questions.entries()) {
      const output = realReport.bank.questions[index]
      for (const field of ['id', 'stem', 'options', 'answer', 'explanation', 'type', 'category']) {
        assert.deepEqual(output[field], question[field], `Question ${index + 1}: ${field} changed`)
      }
    }
    const built = await call('build_bank_file', { bank: realBank, expectedSourceCount: realBank.questions.length, filename: 'real-paper.json' })
    assert.equal(built.valid, true)
    assert.equal(built.sourceCoverage, 'count_matched')
    assert.deepEqual(JSON.parse(await readFile(built.path, 'utf8')), realReport.bank)
    console.log(`PASS local converted-paper regression: ${realBank.questions.length} questions; source PDF not re-extracted`)
  }
  console.log('PASS MCP stdio: discovery, validation, missing answers, duplicate IDs, export, overwrite and traversal protection')
} finally {
  await client.close()
  await rm(directory, { recursive: true, force: true })
}
