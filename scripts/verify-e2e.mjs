/* 端到端冒烟：设置页模板 → 落盘 → 导入 → 答错 → 错题本 → 看板
   跑法：npm run verify:e2e（需要 dev server 跑在 5173） */
import { chromium } from 'playwright-core'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = join(tmpdir(), 'allright-template-bank.json')
mkdirSync(tmpdir(), { recursive: true })

const fails = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fails.push(msg)
}

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))

await page.goto(process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

const rail = (label) => page.locator('.rail__item').filter({ hasText: label }).first()

/* 1. 设置页上的模板本身就要能用 */
await rail('设置').click()
await page.waitForTimeout(400)
const tplText = await page.locator('pre.schema__code.t-data').first().innerText()
let tpl = null
try {
  tpl = JSON.parse(tplText)
} catch (e) {
  console.log('模板 JSON 解析失败：', e.message)
}
ok(!!tpl, '设置页模板是合法 JSON')
ok(Array.isArray(tpl?.questions) && tpl.questions.length > 0, '模板含至少一道题')
const q0 = tpl?.questions?.[0] ?? {}
ok(Array.isArray(q0.options) && q0.options.length >= 2, '模板题含 options 数组')
ok(Array.isArray(q0.answer) && q0.answer.length > 0, '模板题含 answer 数组')
ok(typeof q0.stem === 'string' && q0.stem.length > 0, '模板题含 stem')
ok(tpl.questions.length === 3 && new Set(tpl.questions.map((question) => question.category)).size === 2, '模板展示两个章节、三道题')
ok(tpl.questions[1].category === q0.category && tpl.questions[2].category !== q0.category, '相同 category 归入同章，不同 category 分章')
ok((await page.locator('.chapter-guide').innerText()).includes('category'), '设置页说明章节字段')
writeFileSync(OUT, tplText, 'utf8')

/* 2. 用它导入 */
await rail('题库').click()
await page.waitForTimeout(300)
await page.locator('input[type=file]').setInputFiles(OUT)
await page.waitForSelector('.preview', { timeout: 8000 })
const statValues = await page.locator('.preview__stat b').allTextContents()
ok(statValues.length === 5, `预览给出 5 项统计（实际 ${statValues.length}）`)
const previewChapters = page.locator('.preview .chapter-distribution')
await previewChapters.locator('summary').click()
const previewRows = await previewChapters.locator('li').allTextContents()
ok(previewRows.length === 2 && previewRows[0].includes('2 题') && previewRows[1].includes('1 题'), '导入预览显示各章节及题量')
const importBtn = page.getByRole('button', { name: /^导入 \d+ 题$/ })
ok((await importBtn.count()) === 1, '导入按钮文案是「导入 N 题」')
await importBtn.click()
await page.waitForTimeout(800)

/* 3. 题库列表里出现它 */
await rail('题库').click()
await page.waitForTimeout(400)
const bankNames = await page.locator('.bankrow__name').allTextContents()
ok(bankNames.includes(tpl.name), `题库列表出现「${tpl.name}」（实际 ${JSON.stringify(bankNames)}）`)
const bankRow = page.locator('.bankrow').filter({ hasText: tpl.name })
await bankRow.locator('.chapter-distribution summary').click()
ok((await bankRow.locator('.chapter-distribution li').count()) === 2, '题库管理可展开两个章节')
ok((await page.locator('.chapter-guide').innerText()).includes('直接更新目标题库'), '题库管理说明单章操作直接更新目标题库')
await page.setViewportSize({ width: 390, height: 844 })
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), '窄屏题库章节列表和说明无横向溢出')
await page.setViewportSize({ width: 1440, height: 900 })

/* 4. 故意答错，看它进不进错题本 */
await rail('练习').click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /^开始练习/ }).click()
await page.waitForTimeout(500)
const firstStem = await page.locator('.practice__stem').innerText()
const firstQuestion = tpl.questions.find((question) => question.stem === firstStem)
const rightKey = firstQuestion.answer[0]
const wrongText = firstQuestion.options.find((option) => option.key !== rightKey)?.text
await page.locator('.option').filter({ hasText: wrongText }).first().click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: '确认答案' }).click()
await page.waitForTimeout(500)
const resultText = await page.locator('.result__title').first().innerText().catch(() => '')
ok(resultText === '答错了', `批改结果为「答错了」（实际「${resultText}」）`)
ok((await page.locator('.option--right').count()) === 1, '正确答案被标为答对（石绿勾）')
ok((await page.locator('.option--wrong').count()) === 1, '选错的那条被标为选错了（朱红叉）')
ok((await page.locator('.option--picked').count()) === 1, '你划的那条被单独标记（靛蓝下划线）')

/* 5. 走完这题，进结算 */
await page.getByRole('button', { name: /看本次结算|下一题/ }).click()
for (let questionIndex = 1; questionIndex < tpl.questions.length; questionIndex += 1) {
  const currentStem = await page.locator('.practice__stem').innerText()
  const currentQuestion = tpl.questions.find((question) => question.stem === currentStem)
  const correctText = currentQuestion.options.find((option) => option.key === currentQuestion.answer[0]).text
  await page.locator('.option').filter({ hasText: correctText }).first().click()
  await page.getByRole('button', { name: '确认答案' }).click()
  await page.getByRole('button', { name: /看本次结算|下一题/ }).click()
}
await page.waitForTimeout(600)
const summaryText = await page.locator('.summary').first().innerText().catch(() => '')
ok(summaryText.length > 0, '结算页出现')

/* 6. 错题本里应该有这道题 */
await rail('错题本').click()
await page.waitForTimeout(500)
const wrongPageText = await page.locator('.content__inner').first().innerText().catch(() => '')
ok(/共 \d+ 道/.test(wrongPageText), '错题本显示了题目计数')
ok(wrongPageText.includes(firstQuestion.stem), '错题本是刚答错的那道题')

/* 7. 看板回写了这天的练习量 */
await rail('看板').click()
await page.waitForTimeout(600)
const dashText = await page.locator('.content__inner').first().innerText().catch(() => '')
ok(dashText.length > 0, '看板有内容')

ok(errors.length === 0, `没有 JS 报错${errors.length ? '：' + errors[0] : ''}`)

await browser.close()
console.log(fails.length ? `\n${fails.length} 项未通过` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
