/* 验证安装版：真的跑一遍 NSIS 安装 → 启动装好的程序 → 静默卸载，
   确认用户双击那个 exe 之后能装、能用、能干净地卸掉。
   跑法：npm run electron:build && npm run verify:installer */
import { chromium } from 'playwright-core'
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/* 产物名里带版本号，这里按 package.json 的版本去找，不用每次发版都改脚本 */
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const SETUP = join(ROOT, 'release', `ALLRIGHT-Setup-${VERSION}.exe`)
const INSTALL_DIR = join(tmpdir(), 'allright-install-test')
const PORT = 9335

const fails = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fails.push(msg)
}

function killTree(child) {
  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  } catch {
    child.kill()
  }
}

if (!existsSync(SETUP)) {
  console.error(`找不到安装包：${SETUP}\n先跑 npm run electron:build`)
  process.exit(1)
}

console.log(`静默安装到：${INSTALL_DIR}`)
/* oneClick=false 的安装器是「辅助式」安装器，支持 /S 静默 + /D 指定目录 */
execFileSync(SETUP, ['/S', `/D=${INSTALL_DIR}`], { stdio: 'ignore', timeout: 300000 })

/* 安装器是异步退出的，等目录里的主程序出现 */
let appExe = ''
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 500))
  if (!existsSync(INSTALL_DIR)) continue
  const hit = readdirSync(INSTALL_DIR).find((f) => f.endsWith('.exe') && !f.startsWith('Uninstall'))
  if (hit) {
    appExe = join(INSTALL_DIR, hit)
    break
  }
}

ok(Boolean(appExe), `安装后主程序就位了（${appExe || '没找到 exe'}）`)

if (appExe) {
  const child = spawn(appExe, [`--remote-debugging-port=${PORT}`], {
    cwd: INSTALL_DIR,
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

  ok(Boolean(target), '装好的程序能启动并开出窗口')
  if (target) {
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
    const context = browser.contexts()[0]
    const page = context.pages()[0] ?? (await context.newPage())
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2500)
    ok((await page.locator('.rail__name').count()) > 0, '安装版界面渲染正常')
    const origin = await page.evaluate(() => location.origin)
    ok(origin === 'app://bundle', `安装版页面 origin 是 app://bundle（实际 ${origin}）`)
    const railFoot = await page.locator('.rail__foot').first().textContent()
    ok(
      railFoot.includes('本机应用') && !railFoot.includes('浏览器'),
      `安装版侧栏说的是应用而不是浏览器（实际「${(railFoot || '').trim()}」）`,
    )
    await page.screenshot({ path: '.impeccable/review/desktop-electron-installed.png' })
    await browser.close()
  }
  killTree(child)
}

/* 静默卸载，确认能干净收掉 */
const uninstaller = existsSync(INSTALL_DIR)
  ? readdirSync(INSTALL_DIR).find((f) => f.startsWith('Uninstall') && f.endsWith('.exe'))
  : null
ok(Boolean(uninstaller), `卸载程序在位（${uninstaller || '没找到'}）`)
if (uninstaller) {
  try {
    execFileSync(join(INSTALL_DIR, uninstaller), ['/S'], { stdio: 'ignore', timeout: 180000 })
  } catch {
    /* 卸载器自己会退出，非零退出码不代表失败 */
  }
  /* NSIS 卸载器会把自己挪到父进程再删目录，删得比脚本返回慢，得等 */
  let gone = false
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (!existsSync(INSTALL_DIR)) {
      gone = true
      break
    }
  }
  ok(gone, '卸载后安装目录已被清空')
  ok(!existsSync(join(INSTALL_DIR, 'ALL RIGHT 全对.exe')), '卸载后主程序已被移除')
}

console.log(fails.length ? `\n${fails.length} 项未通过` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
