import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})
const url = process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5173/'
const question = (id, category) => ({
  id, category, type: 'single', stem: `${category}的第 ${id} 题`,
  options: [{ key: 'A', text: '正确选项' }, { key: 'B', text: '错误选项' }],
  answer: ['A'], explanation: '示例解析', difficulty: 1, tags: [],
})
const longChapter = '第三章：一个很长的章节名称，用于验证窄屏下换行与入口的可用性'
const workspace = {
  version: 1,
  activeBankId: 'bank-one',
  banks: [
    { id: 'bank-one', name: '章节测试题库', importedAt: 1, questions: [
      ...Array.from({ length: 25 }, (_, index) => question(`first-${index + 1}`, '第一章')),
      ...Array.from({ length: 3 }, (_, index) => question(`second-${index + 1}`, '第二章')),
      question('long', longChapter),
    ] },
    { id: 'bank-two', name: '另一个题库', importedAt: 1, questions: [question('other', '独立章节')] },
  ],
  attempts: [], stats: {}, sessions: [],
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, locale: 'zh-CN' })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const navigate = (label) => page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click()
  await page.goto(url)
  await navigate('练习')
  assert.match(await page.locator('.empty__title').innerText(), /还没有题库/)
  await page.evaluate((data) => localStorage.setItem('allright.workspace.v1', JSON.stringify(data)), workspace)

  const openChapters = async (count) => {
    await page.reload()
    await navigate('练习')
    await page.getByRole('button', { name: '按章节', exact: true }).click()
    await page.getByRole('group', { name: '题量', exact: true }).getByRole('button', { name: count, exact: true }).click()
  }

  await openChapters('10 题')
  assert.equal(await page.locator('.chapter-entry').count(), 3)
  assert.equal(await page.locator('select').count(), 0)
  assert.equal(await page.locator('.chapter-entry .i-icon-book-open svg').count(), 3)
  assert.match(await page.locator('.chapter-entry').first().innerText(), /共 25 题 · 已练 0 题/)
  await page.locator('.chapter-entry').first().focus()
  await page.keyboard.press('Enter')
  await page.locator('.practice__counter').waitFor()
  assert.equal(await page.locator('.practice__counter').innerText(), '第 1 / 10 题')
  for (let index = 0; index < 10; index += 1) {
    const counter = await page.locator('.practice__counter').innerText()
    assert.match(await page.locator('.practice__stem').innerText(), /第一章/)
    await page.getByRole('button', { name: /正确选项/ }).click()
    await page.getByRole('button', { name: '确认答案', exact: true }).click()
    /* 提交后自己翻页，等题号变了再答下一题 */
    await page.waitForFunction(
      (text) => {
        const element = document.querySelector('.practice__counter')
        return !element || element.textContent.trim() !== text
      },
      counter,
      { timeout: 8000 },
    )
  }
  await page.locator('.summary').waitFor()
  assert.equal(await page.locator('.summary__score').innerText(), '100%')
  await openChapters('全部')
  assert.match(await page.locator('.chapter-entry').first().innerText(), /共 25 题 · 已练 10 题/)
  await page.locator('.chapter-entry').first().click()
  assert.equal(await page.locator('.practice__counter').innerText(), '第 1 / 25 题')
  await openChapters('20 题')
  await page.locator('.chapter-entry').nth(1).click()
  assert.equal(await page.locator('.practice__counter').innerText(), '第 1 / 3 题')
  assert.match(await page.locator('.practice__stem').innerText(), /第二章/)
  await openChapters('50 题')
  await page.locator('.chapter-entry').first().click()
  assert.equal(await page.locator('.practice__counter').innerText(), '第 1 / 25 题')
  await openChapters('10 题')
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await page.getByRole('button', { name: `${longChapter}，共 1 题，开始练习 1 题`, exact: true }).click()
  assert.match(await page.locator('.practice__stem').innerText(), /第三章/)
  await page.setViewportSize({ width: 1280, height: 860 })
  await navigate('题库')
  await page.locator('.bankrow').filter({ hasText: '另一个题库' }).getByRole('button', { name: '切到', exact: true }).click()
  await navigate('练习')
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  assert.equal(await page.locator('.chapter-entry').count(), 1)
  assert.match(await page.locator('.chapter-entry').innerText(), /独立章节/)
  assert.deepEqual(errors, [])
  console.log('PASS  空题库、章节平铺、IconPark、键盘启动、题量限制、章节隔离、统计持久化、窄屏与切换题库')
} finally {
  await browser.close()
}
