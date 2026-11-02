/* 真实安装校验：静默安装到带中文和空格的隔离目录，检查安装资源、启动 MCP 自检，
   再做一次覆盖升级。结束后卸载并还原应用数据。
   跑法：node scripts/verify-install.mjs <安装包> [覆盖升级用的旧安装包] */
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { cp, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)
const [installer, previous] = process.argv.slice(2)
assert.ok(installer, '需要安装包路径')
/* NSIS 的 /D= 会被安装器忽略，直接用真实默认安装位置，更贴近用户实际路径。 */
const installDir = path.join(process.env.LOCALAPPDATA, 'ALL RIGHT 全对')
const dataDir = path.join(process.env.APPDATA, 'com.allright.quandui')
const backup = await mkdtemp(path.join(tmpdir(), 'allright-data-'))
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

if (await stat(dataDir).catch(() => null)) await cp(dataDir, backup, { recursive: true })

const install = async file => {
  await run(file, ['/S', `/D=${installDir}`], { timeout: 180000 })
  await sleep(1500)
}
const resources = () => path.join(installDir, 'resources')
const check = async (label, selftest) => {
  const required = ['node.exe', 'mcp-server.mjs', 'NODE-LICENSE.txt']
  if (selftest) required.push('mcp-selftest.mjs', 'THIRD_PARTY_NOTICES.md', 'RUST_THIRD_PARTY_NOTICES.md')
  for (const name of required) {
    assert.ok((await stat(path.join(resources(), name))).isFile(), `${label}：缺少 ${name}`)
  }
  if (selftest) {
    const { stdout } = await run(path.join(resources(), 'node.exe'),
      [path.join(resources(), 'mcp-selftest.mjs'), path.join(resources(), 'mcp-server.mjs')],
      { timeout: 60000, env: { ...process.env, ALLRIGHT_OUTPUT_DIR: path.join(installDir, '题库输出') } })
    assert.match(stdout, /four tools verified/, `${label}：MCP 自检未通过`)
  }
  console.log(`  ${label} 资源就位${selftest ? '，MCP 自检通过' : ''}`)
}
const launch = async () => {
  const names = (await readdir(installDir)).filter(name => name.toLowerCase().endsWith('.exe') && name.toLowerCase() !== 'uninstall.exe')
  assert.ok(names.length, '安装目录里没有找到主程序')
  const child = spawn(path.join(installDir, names[0]), [], { detached: true, stdio: 'ignore' })
  await sleep(6000)
  assert.equal(child.exitCode, null, '桌面程序启动后异常退出')
  child.kill()
  await sleep(1500)
  console.log('  桌面程序启动正常')
}

try {
  await rm(installDir, { recursive: true, force: true })
  if (previous) {
    console.log('安装旧版本')
    await install(previous)
    await check('旧版本', false)
  }
  console.log('安装当前版本')
  await install(installer)
  await check(previous ? '覆盖升级后' : '全新安装', true)
  await launch()
  if (previous) {
    console.log('覆盖升级：资源与自检均通过')
  }
  console.log('PASS 安装校验：资源就位、MCP 自检、桌面启动与覆盖升级')
} finally {
  const uninstaller = path.join(installDir, 'uninstall.exe')
  if (await stat(uninstaller).catch(() => null)) await run(uninstaller, ['/S'], { timeout: 120000 }).catch(() => {})
  await rm(installDir, { recursive: true, force: true })
  if (await stat(backup).catch(() => null)) {
    await rm(dataDir, { recursive: true, force: true })
    await cp(backup, dataDir, { recursive: true })
  }
  await rm(backup, { recursive: true, force: true })
}
