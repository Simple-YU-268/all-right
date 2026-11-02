import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = process.env.KUKU_URL || 'http://localhost:5173/'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' })
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// 题库页：AI 转译提示词
await page.getByRole('button', { name: '题库', exact: true }).click()
await page.waitForTimeout(400)
const prompt = await page.locator('.schema__code--prompt').textContent()
console.log('prompt length:', prompt.length)
for (const needle of ['你是一个题库格式转换器', '"questions"', '不要臆造', 'ALL RIGHT']) {
  console.log(`  contains "${needle}":`, prompt.includes(needle))
}
console.log('  placeholder leak:', /\$\{/.test(prompt))

await page.getByRole('button', { name: '复制提示词' }).click()
await page.waitForTimeout(400)
console.log('copy button label:', (await page.getByRole('button', { name: /已复制|复制提示词/ }).textContent()).trim())
const clip = await page.evaluate(() => navigator.clipboard.readText())
// Windows 剪贴板会把 \n 规范成 \r\n，比对前先统一行尾
const norm = (s) => s.replace(/\r\n/g, '\n').trim()
console.log('clipboard matches prompt:', norm(clip) === norm(prompt))

// 设置页：JSON 模板
await page.getByRole('button', { name: '设置', exact: true }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: '复制模板' }).click()
await page.waitForTimeout(400)
const clip2 = await page.evaluate(() => navigator.clipboard.readText())
console.log('template clipboard length:', clip2.length)
console.log('  clipboard is valid JSON:', (() => { try { JSON.parse(clip2); return true } catch { return false } })())

// 设置页：动效开关真的关掉动画
await page.getByRole('group', { name: '结算翻页' }).getByRole('button', { name: '关' }).click()
await page.waitForTimeout(300)
console.log('html data-motion:', await page.evaluate(() => document.documentElement.getAttribute('data-motion')))
console.log('localStorage motion key:', await page.evaluate(() => localStorage.getItem('allright.motion.v1')))

if (errors.length) console.log('page errors:', errors.slice(0, 5))
await browser.close()
