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
  args: process.env.ALLRIGHT_MCP_EXE ? [] : [process.env.ALLRIGHT_MCP_ENTRY || path.resolve('mcp/launch.mjs')],
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
  const noIds = structuredClone(bank)
  noIds.questions.forEach(q => { delete q.id })
  assert.deepEqual((await call('normalize_bank', { bank: noIds })).bank, (await call('normalize_bank', { bank: noIds })).bank)
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
  const result = await call('build_bank_file', { bank, filename: 'bank.json' })
  assert.equal(result.questionCount, 3)
  assert.equal(JSON.parse(await readFile(path.join(directory, 'bank.json'), 'utf8')).questions.length, 3)
  assert.equal((await call('build_bank_file', { bank, filename: 'bank.json' })).code, 'EEXIST')
  assert.equal((await call('build_bank_file', { bank, filename: '通信试卷.json' })).questionCount, 3)
  const traversal = await client.callTool({ name: 'build_bank_file', arguments: { bank, filename: '../escape.json' } })
  assert.equal(traversal.isError, true)
  console.log('PASS MCP stdio: discovery, validation, missing answers, duplicate IDs, export, overwrite and traversal protection')
} finally {
  await client.close()
  await rm(directory, { recursive: true, force: true })
}
