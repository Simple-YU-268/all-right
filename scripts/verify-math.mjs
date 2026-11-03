/* 公式端到端：LaTeX 写法 → 题面排版 → 选项与解析 → 窄屏不溢出
   跑法：npm run verify:math（需要 dev server 跑在 5173） */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})
const url = process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5173/'

const question = (id, stem, options, answer, explanation) => ({
  id,
  type: 'single',
  category: '第一章 公式',
  stem,
  options,
  answer,
  explanation,
  difficulty: 2,
  tags: [],
})

const workspace = {
  version: 1,
  activeBankId: 'bank-math',
  banks: [{
    id: 'bank-math',
    name: '公式题库',
    importedAt: 1,
    questions: [
      question(
        'm1',
        '已知 $x^2 + y^2 = z^2$，则 $z = \\sqrt{x^2 + y^2}$。',
        [
          { key: 'A', text: '勾股定理 $a^2 + b^2 = c^2$' },
          { key: 'B', text: '价格 $100 和 $200 都不是公式' },
          { key: 'C', text: '普通选项' },
        ],
        ['A'],
        '由 $\\frac{a}{b} = \\frac{c}{d}$ 可得 $ad = bc$。',
      ),
      question(
        'm2',
        '行间公式单独成行：\n$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
        [{ key: 'A', text: '对' }, { key: 'B', text: '错' }],
        ['A'],
        '这题只有行间公式。',
      ),
      question(
        'm3',
        '坏掉的公式 $\\frac{1}{$ 也要有交代。',
        [{ key: 'A', text: '对' }, { key: 'B', text: '错' }],
        ['A'],
        '',
      ),
    ],
  }],
  attempts: [],
  stats: {},
  sessions: [],
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const navigate = (label) => page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click()

  await page.goto(url)
  /* 等应用自己渲染完，也等它把空工作区写回本地，否则会把刚塞进去的题库覆盖掉 */
  await page.locator('.rail').waitFor({ timeout: 8000 })
  await page.waitForTimeout(400)
  await page.evaluate((data) => localStorage.setItem('allright.workspace.v1', JSON.stringify(data)), workspace)
  await page.reload()
  await page.locator('.rail').waitFor({ timeout: 8000 })
  await navigate('练习')
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').first().click()
  await page.locator('.practice__counter').waitFor({ timeout: 8000 })

  /* 1. 行内公式排出来了 */
  const stem = page.locator('.practice__stem')
  assert.ok(await stem.locator('.katex').count() >= 2, '题干里的行内公式排成了公式')
  assert.ok(await stem.locator('.katex-html').count() >= 2, '公式有排版后的结构')
  const stemText = await stem.innerText()
  assert.ok(!stemText.includes('$x^2'), '题面上不再露出公式源码')
  assert.ok(stemText.includes('已知'), '公式旁边的文字照常读')
  assert.ok(await stem.locator('.katex .msupsub').count() >= 1, '上标真的排出来了')

  /* 2. 选项里的公式也排版，价格写法不当成公式 */
  const optionFormula = page.locator('.option__text').first()
  assert.ok(await optionFormula.locator('.katex').count() === 1, '选项里的公式也排版')
  const priceOption = page.locator('.option__text').nth(1)
  assert.equal(await priceOption.locator('.katex').count(), 0, '「$100 和 $200」不会被当成公式')
  assert.match(await priceOption.innerText(), /\$100 和 \$200/, '价格写法原样留着')

  /* 3. 解析里的公式也排版 */
  await page.getByRole('button', { name: /勾股定理/ }).click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.locator('.explain').waitFor({ timeout: 8000 })
  assert.ok(await page.locator('.explain .katex').count() >= 1, '解析里的公式也排版')

  /* 4. 行间公式单独成行 */
  await page.getByRole('button', { name: '下一题', exact: true }).click()
  await page.locator('.practice__counter').waitFor({ timeout: 8000 })
  assert.ok(await page.locator('.practice__stem .katex-display').count() === 1, '行间公式单独占一行')
  assert.ok(await page.locator('.practice__stem .katex-display').first().isVisible(), '行间公式看得见')

  /* 5. 排不动的公式把原文还回去，题目不塌 */
  await page.getByRole('button', { name: '下一题', exact: true }).click()
  await page.locator('.practice__counter').waitFor({ timeout: 8000 })
  const raw = page.locator('.math__raw')
  assert.equal(await raw.count(), 1, '排不动的公式退回原文')
  assert.match(await raw.innerText(), /\\frac\{1\}\{/, '退回的是公式原文')
  assert.match(await page.locator('.practice__stem').innerText(), /坏掉的公式/, '题面还在')

  /* 6. 窄屏上公式不把整页撑宽 */
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    '窄屏上公式没有横向溢出',
  )
  await page.setViewportSize({ width: 1280, height: 900 })

  await page.locator('.option__pick').nth(1).click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '下一题', exact: true }).isEnabled(), true)
  await page.getByRole('button', { name: '下一题', exact: true }).click()
  assert.equal(await page.locator('.practice__counter').innerText(), '第 2 / 3 题')
  await page.locator('.option__pick').first().click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.locator('.summary').waitFor()
  await page.getByRole('button', { name: '再来一组', exact: true }).click()
  await page.locator('.practice__counter').waitFor()
  assert.equal(await page.locator('.summary').count(), 0, '再来一组进入新的练习')

  assert.deepEqual(errors, [], '页面没有 JS 报错')
  console.log('公式排版全部通过')
} finally {
  await browser.close()
}
