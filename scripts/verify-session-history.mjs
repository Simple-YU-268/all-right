/* 练习历史：结算后要留下记录，设置页能看到；跨题库的统计不能串。 */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const url = process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5180/'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const fails = []
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) fails.push(msg)
}

const question = (id, category) => ({
  id, category, type: 'single', stem: `第 ${id} 题`,
  options: [{ key: 'A', text: '正确选项' }, { key: 'B', text: '错误选项' }],
  answer: ['A'], explanation: '解析', difficulty: 3, tags: [],
})

const seed = (banks, activeBankId) => ({
  version: 2, activeBankId, banks,
  attempts: [], stats: {}, sessions: [], assets: {},
})

try {
  for (const theme of ['classic', 'looseleaf']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(url)
    await page.evaluate(([theme, workspace]) => {
      localStorage.setItem('allright.theme.v1', theme)
      localStorage.setItem('allright.workspace.v1', JSON.stringify(workspace))
    }, [theme, seed([{ id: 'b', name: '历史题库', importedAt: 1, questions: [question('q1', '第一章'), question('q2', '第一章')] }], 'b')])
    await page.reload()
    await page.waitForTimeout(400)

    const nav = (name) => page.getByRole('navigation').first()
      .getByRole(theme === 'classic' ? 'button' : 'tab', { name: new RegExp(`^${name}`) }).click()

    await nav('练习')
    await page.getByRole('button', { name: '开始新练习', exact: true }).click()
    await page.getByRole('button', { name: /^开始练习/ }).click()
    await page.waitForTimeout(500)
    await page.locator('.option__pick').first().click()
    const original = await page.evaluate(() => JSON.parse(localStorage.getItem('allright.workspace.v1')).activeSession)
    await nav(theme === 'classic' ? '看板' : '学习桌')
    page.once('dialog', dialog => void dialog.dismiss())
    await page.getByRole('button', { name: /开始随机练习/ }).click()
    await page.waitForTimeout(300)
    const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('allright.workspace.v1')).activeSession)
    assert.equal(retained.id, original.id, '取消替换保留原练习')
    assert.deepEqual(retained.drafts, original.drafts, '取消替换保留草稿')
    ok(true, `${theme} 取消新练习保留进度与草稿`)
    await nav('练习')
    const resume = page.getByRole('button', { name: '继续练习', exact: true })
    if (await resume.count()) {
      await page.getByRole('button', { name: '开始新练习', exact: true }).click()
      await page.getByRole('button', { name: '返回练习入口', exact: true }).click()
      ok(await resume.count() === 1, `${theme} 新练习设置返回后仍可续答`)
    }
    if (await resume.count()) await resume.click()
    await page.getByRole('button', { name: '确认答案', exact: true }).click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: '结束并结算', exact: true }).click()
    await page.locator('.summary').waitFor()

    const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('allright.workspace.v1')).sessions)
    ok(sessions.length === 1, `${theme} 结算后留下一条练习记录`)
    ok(sessions[0]?.answered === 1, `${theme} 记录了答题数`)
    ok(sessions[0]?.total === 2, `${theme} 提前结算仍保留计划题量`)
    ok(sessions[0]?.correct === 1, `${theme} 记录了答对数`)
    ok(typeof sessions[0]?.elapsedMs === 'number', `${theme} 记录了用时`)

    await nav('设置')
    await page.waitForTimeout(300)
    if (theme === 'looseleaf') await page.getByRole('tab', { name: '数据与隐私', exact: true }).click()
    const disclosure = page.getByText(/练习历史（\d+）/)
    ok(await disclosure.count() > 0, `${theme} 设置页出现练习历史入口`)
    await disclosure.first().click()
    await page.waitForTimeout(300)
    const historyText = await page.locator('.history').innerText()
    ok(historyText.includes('随机练习'), `${theme} 历史里显示了练习方式`)
    ok(historyText.includes('历史题库'), `${theme} 历史里显示了题库名`)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} 窄屏无横向溢出`)
    await page.setViewportSize({ width: 1280, height: 900 })

    ok(errors.length === 0, `${theme} 无脚本错误`)
    await context.close()
  }

  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
    const page = await context.newPage()
    await page.goto(url)
    await page.evaluate(([workspace]) => {
      localStorage.setItem('allright.theme.v1', 'classic')
      localStorage.setItem('allright.workspace.v1', JSON.stringify(workspace))
    }, [seed([
      { id: 'a', name: '甲库', importedAt: 1, questions: [question('q1', '第一章')] },
      { id: 'b', name: '乙库', importedAt: 2, questions: [question('q1', '第二章')] },
    ], 'a')])
    await page.reload()
    await page.waitForTimeout(400)

    await page.locator('.rail__item').filter({ hasText: '练习' }).first().click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '开始新练习', exact: true }).click()
    await page.getByRole('button', { name: /^开始练习/ }).click()
    await page.waitForTimeout(500)
    await page.locator('.option__pick').nth(1).click()
    await page.getByRole('button', { name: '确认答案', exact: true }).click()
    await page.waitForTimeout(600)

    await page.locator('.rail__item').filter({ hasText: '题库' }).first().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: '切到', exact: true }).first().click()
    await page.waitForTimeout(400)
    await page.locator('.rail__item').filter({ hasText: '错题本' }).first().click()
    await page.waitForTimeout(600)
    const wrongBody = await page.locator('.content__inner').first().innerText()
    ok(!wrongBody.includes('第 q1 题'), '同名题不串到另一个题库')
    ok(wrongBody.includes('错题本是空的'), '另一个题库的错题本没有被污染')
    await context.close()
  }

  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  if (fails.length) process.exitCode = 1
} finally {
  await browser.close()
}
