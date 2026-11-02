/* 验证「打包后的成品」而不只是源码树：连上 exe 的远程调试端口，
   确认 asar 里的 app:// 协议、字体、示例题库在成品里一样能用。
   跑法：npm run electron:build && npm run verify:packaged */
import { chromium } from 'playwright-core'
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXE = join(ROOT, 'release', 'win-unpacked', 'ALL RIGHT 全对.exe')
const PORT = 9333
const USER_DATA = mkdtempSync(join(tmpdir(), 'allright-packaged-'))

const fails = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fails.push(msg)
}

if (!existsSync(EXE)) {
  console.error(`找不到打包产物：${EXE}\n先跑 npm run electron:build`)
  process.exit(1)
}

const child = spawn(EXE, [`--remote-debugging-port=${PORT}`], {
  cwd: ROOT,
  env: { ...process.env, ALLRIGHT_USER_DATA: USER_DATA },
  stdio: 'ignore',
})

/* 等调试端口起来 */
let targets = null
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500))
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
    const list = await res.json()
    const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
    if (page) {
      targets = page
      break
    }
  } catch {
    /* 还没起来 */
  }
}

if (!targets) {
  console.error('连不上打包产物的调试端口')
  child.kill()
  process.exit(1)
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
const context = browser.contexts()[0]
const page = context.pages()[0] ?? (await context.newPage())
await page.waitForLoadState('domcontentloaded')
await page.waitForTimeout(2000)

const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 110)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text().slice(0, 110))
})

ok((await page.locator('.rail__name').count()) > 0, '成品窗口里界面渲染出来了')
const origin = await page.evaluate(() => location.origin)
ok(origin === 'app://bundle', `页面 origin 是 app://bundle（实际 ${origin}）——asar 里的协议读得到文件`)

/* 桌面版不该再提「浏览器」，数据其实写在应用存储里 */
const railFoot = await page.locator('.rail__foot').first().textContent()
ok(
  railFoot.includes('本机应用') && !railFoot.includes('浏览器'),
  `侧栏数据说明说的是应用而不是浏览器（实际「${(railFoot || '').trim()}」）`,
)

const fonts = await page.evaluate(async () => {
  await document.fonts.ready
  return { serif: document.fonts.check('16px "Noto Serif SC"') }
})
ok(fonts.serif, '宋体在成品里加载正常')

/* 等宽字体是按需加载的，空看板上没有元素用它，
   得去设置页——那里有 code.t-data——才会真的下载下来 */
await page.locator('.rail__item').filter({ hasText: '设置' }).first().click()
await page.waitForTimeout(1200)
const mono = await page.evaluate(async () => {
  await document.fonts.ready
  const el = document.querySelector('.t-data')
  return {
    loaded: document.fonts.check('13px "IBM Plex Mono"'),
    applied: el ? getComputedStyle(el).fontFamily.includes('IBM Plex Mono') : false,
  }
})
ok(mono.loaded, '等宽字体在成品里加载正常')
ok(mono.applied, '等宽字体真的套在数据读数上')

await page.locator('.rail__item').filter({ hasText: '题库' }).first().click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: '载入示例题库' }).click()
await page.waitForTimeout(1500)
ok((await page.locator('.preview').count()) > 0, '成品里「载入示例题库」也取得到')

ok(errors.length === 0, `没有报错${errors.length ? '：' + errors[0] : ''}`)

await page.screenshot({ path: '.impeccable/review/desktop-electron-packaged.png' })
await browser.close()
child.kill()

console.log(fails.length ? `\n${fails.length} 项未通过` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
