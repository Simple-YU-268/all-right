import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
const timer = setTimeout(() => process.exit(2), 12000)
const directory = await mkdtemp(path.join(tmpdir(), 'allright-selftest-'))
const client = new Client({ name: 'allright-selftest', version: '1.0.0' })
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [process.argv[2]],
    env: { ...process.env, ALLRIGHT_OUTPUT_DIR: directory } }))
  const tools = await client.listTools()
  if (!['get_bank_spec', 'normalize_bank', 'validate_bank', 'build_bank_file'].every(name => tools.tools.some(tool => tool.name === name))) throw new Error('Required tools missing')
  const result = await client.callTool({ name: 'get_bank_spec', arguments: {} })
  if (result.isError) throw new Error('Spec request failed')
  console.log('MCP handshake and four tools verified')
} finally {
  await client.close()
  await rm(directory, { recursive: true, force: true })
  clearTimeout(timer)
}
