/* 发布前的安装形态校验：按 tauri.conf 的资源清单核对文件，并把整套资源装进
   带中文和空格的路径里真实启动 MCP，确认配置与连接都不挑路径。
   跑法：node scripts/verify-release-resources.mjs */
import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const config = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8'))
const listed = config.bundle.resources
assert.ok(listed?.length, 'tauri.conf.json 没有声明安装资源')

for (const entry of listed) {
  const full = path.resolve('src-tauri', entry)
  assert.ok((await stat(full)).isFile(), `缺少安装资源：${entry}`)
}

const root = await mkdtemp(path.join(tmpdir(), 'allright-安装 校验-'))
const install = path.join(root, 'ALL RIGHT 全对', 'resources')
await mkdir(install, { recursive: true })
for (const entry of listed) {
  await cp(path.resolve('src-tauri', entry), path.join(install, path.basename(entry)))
}

const node = path.join(install, 'node.exe')
const server = path.join(install, 'mcp-server.mjs')
const selftest = path.join(install, 'mcp-selftest.mjs')

const client = new Client({ name: 'allright-install-check', version: '1.0.0' })
try {
  await client.connect(new StdioClientTransport({
    command: node,
    args: [server],
    env: { ...process.env, ALLRIGHT_OUTPUT_DIR: path.join(root, '题库输出') },
  }))
  const tools = await client.listTools()
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(),
    ['build_bank_file', 'get_bank_spec', 'normalize_bank', 'validate_bank'])
  const spec = await client.callTool({ name: 'get_bank_spec', arguments: {} })
  assert.equal(spec.isError, false)
  assert.ok(JSON.parse(spec.content[0].text).template.questions.length > 0)

  const built = await client.callTool({
    name: 'build_bank_file',
    arguments: { filename: '路径校验.json', bank: JSON.parse(spec.content[0].text).template },
  })
  assert.equal(built.isError, false)
  assert.ok((await stat(JSON.parse(built.content[0].text).path)).isFile(), '带中文路径的输出文件没有生成')

  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const run = promisify(execFile)
  const checked = await run(node, [selftest, server], { env: { ...process.env, ALLRIGHT_OUTPUT_DIR: path.join(root, '自检输出') } })
  assert.match(checked.stdout, /four tools verified/)

  const notices = await readFile(path.join(install, 'THIRD_PARTY_NOTICES.md'), 'utf8')
  assert.match(notices, /Third-Party Notices/)
  const rustNotices = await readFile(path.join(install, 'RUST_THIRD_PARTY_NOTICES.md'), 'utf8')
  assert.match(rustNotices, /Rust Third-Party Notices/)
  console.log(`PASS 安装形态：${listed.length} 项资源就位，中文与空格路径下 MCP 握手、工具发现、导出与自检均通过`)
} finally {
  await client.close()
  await rm(root, { recursive: true, force: true })
}
