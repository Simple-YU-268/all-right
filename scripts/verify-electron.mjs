/* 桌面版冒烟：窗口起得来、app:// 协议通、示例题库取得到、
   localStorage 落盘并且重启后还在。
   跑法：npm run build && npm run verify:electron */
import { _electron as electron } from 'playwright-core'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXE = require('electron')
const USER_DATA = mkdtempSync(join(tmpdir(), 'allright-desktop-'))
const SHOT_DIR = '.impeccable/review'
mkdirSync(SHOT_DIR, { recursive: true })

const fails = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fails.push(msg)
}

async function launch() {
  const app = await electron.launch({
    executablePath: EXE,
    args: [ROOT],
    cwd: ROOT,
    env: { ...process.env, ALLRIGHT_USER_DATA: USER_DATA },
  })
  const win = await app.firstWindow()
  const errors = []
  win.on('pageerror', (e) => errors.push(String(e).slice(0, 120)))
  win.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 120))
  })
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(1500)
  return { app, win, errors }
}

/* ---- 第一轮：起得来吗 ---- */
const first = await launch()
const { app, win, errors } = first

ok((await win.locator('.rail__name').count()) > 0, '窗口加载后界面渲染出来了')
ok((await win.locator('.rail__item').count()) === 5, '左侧导航五项都在')
ok((await win.title()).includes('ALL RIGHT'), `窗口标题正确（实际「${await win.title()}」）`)
ok(errors.length === 0, `没有报错${errors.length ? '：' + errors[0] : ''}`)

/* ---- app:// 协议：页面 origin 是真源，不是 file:// 的 null ---- */
const origin = await win.evaluate(() => location.origin)
ok(origin === 'app://bundle', `页面 origin 是 app://bundle（实际 ${origin}）`)

/* ---- 示例题库：fetch 在 app:// 下要能取到（file:// 会被拦） ---- */
await win.locator('.rail__item').filter({ hasText: '题库' }).first().click()
await win.waitForTimeout(500)
await win.getByRole('button', { name: '载入示例题库' }).click()
await win.waitForTimeout(1500)
ok((await win.locator('.preview').count()) > 0, '「载入示例题库」在 app:// 下取得到（fetch 没被 CORS 拦）')
ok((await win.locator('.preview__stat b').count()) === 5, '预览给出 5 项统计')

/* ---- 真的导进去，写一条练习记录 ---- */
await win.getByRole('button', { name: /^导入 \d+ 题$/ }).click()
await win.waitForTimeout(800)
ok((await win.locator('.rail__bank').innerText()).includes('示例'), '题库导进来了，rail 上能看到')

await win.locator('.rail__item').filter({ hasText: '练习' }).first().click()
await win.waitForTimeout(500)
await win.getByRole('button', { name: /^开始练习/ }).click()
await win.waitForTimeout(600)
await win.locator('.option').nth(1).click()
await win.waitForTimeout(200)
await win.getByRole('button', { name: '确认答案' }).click()
await win.waitForTimeout(600)
ok((await win.locator('.result__title').count()) > 0, '答完一题有批改结果')

/* ---- localStorage 真的落盘了吗 ---- */
const stored = await win.evaluate(() => {
  const raw = localStorage.getItem('allright.workspace.v1')
  if (!raw) return null
  const w = JSON.parse(raw)
  return { banks: w.banks.length, attempts: w.attempts.length }
})
ok(!!stored && stored.banks > 0, `localStorage 里有题库（banks=${stored?.banks}）`)
ok(!!stored && stored.attempts > 0, `localStorage 里有作答记录（attempts=${stored?.attempts}）`)

await win.screenshot({ path: join(SHOT_DIR, 'desktop-electron.png') })
await app.close()

/* ---- 第二轮：重启后数据还在吗 ---- */
const second = await launch()
const after = await second.win.evaluate(() => {
  const raw = localStorage.getItem('allright.workspace.v1')
  if (!raw) return null
  const w = JSON.parse(raw)
  return { banks: w.banks.length, attempts: w.attempts.length }
})
ok(!!after && after.banks > 0, `重启后题库还在（banks=${after?.banks}）`)
ok(!!after && after.attempts > 0, `重启后作答记录还在（attempts=${after?.attempts}）`)
ok(second.errors.length === 0, `重启后没有报错${second.errors.length ? '：' + second.errors[0] : ''}`)
await second.app.close()

console.log(fails.length ? `\n${fails.length} 项未通过` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
