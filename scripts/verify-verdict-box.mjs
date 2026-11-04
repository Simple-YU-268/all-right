/* 校验「上一题回答情况」方框：手绘主题要用 Looseleaf 的专用素材，经典主题保持原样。 */
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const url = process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5180/'
const out = '.impeccable/review'
await mkdir(out, { recursive: true })

const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})

const seedWorkspace = (count, withExplanation) => {
  const questions = Array.from({ length: count }, (_, index) => ({
    id: `v${index}`,
    type: 'single',
    category: '第一章 交换技术',
    stem: `第 ${index + 1} 道题`,
    options: [{ key: 'A', text: '选项一' }, { key: 'B', text: '选项二' }],
    answer: ['A'],
    explanation: withExplanation ? `第 ${index + 1} 题的解析。` : '',
    difficulty: 3,
    tags: [],
  }))
  return { version: 2, banks: [{ id: 'v', name: '批改条验证', questions, importedAt: 1 }], activeBankId: 'v', attempts: [], stats: {}, sessions: [], assets: {} }
}

try {
  for (const theme of ['looseleaf', 'classic']) {
    for (const withExplanation of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(String(error)))
      await page.goto(url)
      await page.evaluate(([theme, workspace]) => {
        localStorage.setItem('allright.theme.v1', theme)
        localStorage.setItem('allright.motion.v1', 'reduced')
        localStorage.setItem('allright.workspace.v1', JSON.stringify(workspace))
      }, [theme, seedWorkspace(3, withExplanation)])
      await page.reload()
      await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme)

      const nav = name => page.getByRole('navigation').first().getByRole(theme === 'classic' ? 'button' : 'tab', { name: new RegExp(`^${name}`) }).click()
      await nav('练习')
      await page.getByRole(theme === 'classic' ? 'button' : 'tab', { name: '按章节', exact: true }).click()
      await page.locator('.chapter-entry').first().click()
      await page.locator('.option__pick').nth(1).click()
      await page.getByRole('button', { name: '确认答案', exact: true }).click()
      await page.locator('.result').waitFor()
      /* 答错会留在原地，把下一题点开才留批改条 */
      await page.getByRole('button', { name: '下一题', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.practice__counter')?.textContent?.includes('第 2 / 3 题'))

      if (withExplanation) {
        const verdict = page.locator('.practice__verdict')
        assert.equal(await verdict.count(), 1, `${theme} 批改条出现`)
        assert.ok((await verdict.innerText()).includes('上一题答错了'), `${theme} 批改条说明上一题答错`)
        assert.ok((await verdict.innerText()).includes('看解析'), `${theme} 批改条保留看解析入口`)

        if (theme === 'looseleaf') {
          /* 手绘主题：方框与记号都要是 Looseleaf 的专用素材 */
          assert.ok(await verdict.locator('svg[data-ink="hand-frame"] path').count() > 0, '手绘批改条有绘线框')
          assert.equal(await verdict.locator('.practice__verdict-mark svg[data-ink="icon"]').count(), 1, '手绘批改条用手绘图标')
          assert.equal(await verdict.locator('.practice__verdict-mark [data-missing]').count(), 0, '手绘图标素材存在')
          const link = verdict.locator('.practice__verdict-link')
          assert.ok(await link.locator('svg[data-ink="button"]').count() > 0, '看解析按钮带手绘下划线')
        } else {
          assert.equal(await verdict.locator('svg[data-ink]').count(), 0, '经典主题不引入绘线')
          assert.ok(await verdict.locator('.practice__verdict-mark svg').count() === 1, '经典主题保留原有图标')
        }

        for (const width of [1280, 390]) {
          await page.setViewportSize({ width, height: 900 })
          await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 5000 })
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${theme} ${width} 无横向溢出`)
          const box = await verdict.boundingBox()
          assert.ok(box.width > 0 && box.height > 0, `${theme} ${width} 批改条可见`)
        }
        await page.setViewportSize({ width: 1280, height: 900 })
        await page.screenshot({ path: `${out}/verdict-${theme}-wrong-${withExplanation ? 'explain' : 'plain'}.png`, fullPage: true })

        /* 看解析能跳回上一题 */
        await verdict.getByRole('button', { name: '看解析' }).click()
        await page.waitForFunction(() => document.querySelector('.practice__counter')?.textContent?.includes('第 1 / 3 题'))
      } else {
        assert.equal(await page.locator('.practice__verdict').count(), 0, `${theme} 没有解析时不显示批改条`)
      }

      assert.deepEqual(errors, [], `${theme} 无脚本错误`)
      await context.close()
    }
  }
  console.log('PASS verdict box: both themes, hand-drawn assets in looseleaf, no overflow, 看解析 jump')
} catch (error) {
  console.error(error)
  throw error
} finally {
  await browser.close()
}
