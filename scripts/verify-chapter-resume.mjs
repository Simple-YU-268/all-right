import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
try {
  for (const theme of ['classic', 'looseleaf']) {
    const page = await browser.newPage()
    await page.goto(process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5182/')
    await page.getByRole('navigation').first().waitFor()
    await page.evaluate(theme => {
      const questions = Array.from({ length: 72 }, (_, index) => index + 1).map(i => ({ id: `q${i}`, category: '章节一', type: 'single', stem: `续练测试第${i}题`, options: [{ key: 'A', text: '正确选项' }, { key: 'B', text: '错误选项' }], answer: ['A'], explanation: '', difficulty: 3, tags: [] }))
      localStorage.setItem('allright.theme.v1', theme)
      const completed = Array.from({ length: 41 }, (_, index) => index + 1)
      localStorage.setItem('allright.workspace.v1', JSON.stringify({ version: 2, activeBankId: 'b', banks: [{ id: 'b', name: '续练测试', importedAt: 1, questions }], stats: Object.fromEntries(completed.map(i => [`q${i}`, { attempts: 1 }])), sessions: [], attempts: completed.map(i => ({ id: `a${i}`, bankId: 'b', questionId: `q${i}`, chosen: ['B'], correct: false, at: 1, elapsedMs: 1000 })).concat([{ id: 'other', bankId: 'another-bank', questionId: 'q42', chosen: ['A'], correct: true, at: 1, elapsedMs: 1000 }]) }))
    }, theme)
    const open = async () => {
      await page.reload()
      const nav = page.getByRole('navigation').first()
      await nav.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '练习', exact: true }).click()
      try {
        await page.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '按章节', exact: true }).click({ timeout: 5000 })
      } catch (error) {
        console.log(theme, await page.locator('body').innerText())
        throw error
      }
    }
    await open()
    assert.match(await page.locator('.chapter-entry').innerText(), /已练 41 题.*剩余 31 题/)
    await page.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '全部', exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('.chapter-entry').click()
    assert.match(await page.locator('.practice__stem').innerText(), /第42题/)
    assert.equal(await page.locator('.practice__counter').innerText(), '第 1 / 31 题')
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('allright.workspace.v1')).activeSession.questionIds.some(id => Number(id.slice(1)) <= 41)), false)
    await page.getByRole('button', { name: /错误选项/ }).click()
    await page.getByRole('button', { name: '确认答案', exact: true }).click()
    await page.getByRole('button', { name: '结束并结算', exact: true }).click()
    await page.locator('.summary').waitFor()
    await open()
    await page.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '从头重练', exact: true }).click()
    await page.locator('.chapter-entry').click()
    assert.match(await page.locator('.practice__stem').innerText(), /第1题/)
    await page.getByRole('button', { name: '结束并结算', exact: true }).click()
    await page.locator('.summary').waitFor()
    await open()
    await page.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '随机抽题', exact: true }).click()
    await page.getByRole('button', { name: /^开始练习/ }).click()
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('allright.workspace.v1')).activeSession.questionIds.some(id => Number(id.slice(1)) <= 42)), false)
    await page.getByRole('button', { name: '结束并结算', exact: true }).click()
    await page.locator('.summary').waitFor()
    await open()
    await page.locator('.chapter-entry').click()
    assert.match(await page.locator('.practice__stem').innerText(), /第43题/)
    await page.getByRole('button', { name: /错误选项/ }).click()
    await page.getByRole('button', { name: '确认答案', exact: true }).click()
    await page.getByRole('button', { name: '结束并结算', exact: true }).click()
    await page.locator('.summary').waitFor()
    await open()
    await page.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '从头重练', exact: true }).click()
    await page.locator('.chapter-entry').click()
    assert.match(await page.locator('.practice__stem').innerText(), /第1题/)
    await page.close()
  }
  console.log('PASS chapter continuation: historical attempts, wrong answers, bank isolation, partial settlement, reload, restart, both themes')
} finally {
  await browser.close()
}
