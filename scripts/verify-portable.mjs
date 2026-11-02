/* 验证便携版 exe：把 ALLRIGHT-Portable-1.0.0.exe 复制到临时目录运行，
   确认 (1) exe 旁边真的落出了 data\ 目录（真便携，数据跟着文件夹走）
   (2) 便携版窗口能正常渲染、app:// 协议在成品里可用
   (3) 数据确实写进了 exe 旁边的 data\，而不是 %APPDATA%
   跑法：npm run electron:build && npm run verify:portable */
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORTABLE = join(ROOT, 'release', 'ALLRIGHT-Portable-1.0.0.exe')
const PORT = 9334
const SANDBOX = mkdtempSync(join(tmpdir(), 'allright-portable-'))
const DATA_DIR = join(SANDBOX, 'data')

const fails = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fails.push(msg)
}

/* 便携版启动器会解压出真正的应用进程，杀启动器不够，得连树一起杀 */
function killTree(child) {
  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    child.kill()
  }
}

if (!existsSync(PORTABLE)) {
  console.error(`找不到便携版产物：${PORTABLE}\n先跑 npm run electron:build`)
  process.exit(1)
}

/* 把便携版拷到沙箱目录再跑，模拟"U 盘拷走"的真实场景 */
const EXE = join(SANDBOX, 'ALLRIGHT-Portable-1.0.0.exe')
copyFileSync(PORTABLE, EXE)

const child = spawn(EXE, [`--remote-debugging-port=${PORT}`], {
  cwd: SANDBOX,
  env: { ...process.env, ALLRIGHT_USER_DATA: '' },
  stdio: 'ignore',
})

let target = null
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500))
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
    const list = await res.json()
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (page) {
      target = page
      break
    }
  } catch {
    /* 还没起来 */
  }
}

if (!target) {
  console.error('连不上便携版的调试端口')
  killTree(child)
  process.exit(1)
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
const context = browser.contexts()[0]
const page = context.pages()[0] ?? (await context.newPage())
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(2500)

ok((await page.locator('.rail__name').count()) > 0, '便携版窗口能正常渲染出界面')
const origin = await page.evaluate(() => location.origin)
ok(origin === 'app://bundle', `便携版页面 origin 是 app://bundle（实际 ${origin}）`)
const railFoot = await page.locator('.rail__foot').first().textContent()
ok(
  railFoot.includes('本机应用') && !railFoot.includes('浏览器'),
  `便携版侧栏说的是应用而不是浏览器（实际「${(railFoot || '').trim()}」）`,
)

/* 存点东西，确认数据落到了 exe 旁边 */
await page.evaluate(() => {
  localStorage.setItem('allright.portable.probe', 'ok')
})
await page.waitForTimeout(400)

ok(existsSync(DATA_DIR), `exe 旁边出现了 data\\ 目录（${DATA_DIR}）`)
if (existsSync(DATA_DIR)) {
  const entries = readdirSync(DATA_DIR)
  ok(entries.length > 0, `data\\ 里写进了数据文件（${entries.length} 项：${entries.slice(0, 4).join(', ')}）`)
}

await page.screenshot({ path: '.impeccable/review/desktop-electron-portable.png' })
await browser.close()
/* 便携版启动器会把应用解压到临时目录再拉起子进程，
   只 kill 启动器会留下一堆常驻进程，所以连树一起杀。 */
killTree(child)

console.log(fails.length ? `\n${fails.length} 项未通过` : '\n全部通过')
console.log(`沙箱目录：${SANDBOX}`)
process.exit(fails.length ? 1 : 0)
