import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const url = process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5180/'
const browser = await chromium.launch({ executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(String(error)))
page.on('response', response => { if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) errors.push(`${response.status()}: ${response.url()}`) })
const screenshots = '.impeccable/review'
await mkdir(screenshots, { recursive: true })
const nav = async label => {
  if (await page.locator('.study-nav').count()) await page.locator('.study-nav').getByRole('tab', { name: label === '看板' ? '学习桌' : label, exact: true }).click()
  else await page.locator('.rail__item').filter({ hasText: label }).click()
}
const checkTheme = theme => page.waitForFunction(value => document.documentElement.dataset.theme === value, theme)
const capture = async name => {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: `${screenshots}/${name}.png` })
}
const noOverflow = async () => {
  const documentFits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  if (await page.locator('.content').count()) {
    const report = await page.locator('.content').evaluate(contentOverflow)
    if (!documentFits || report.length) {
      await capture('overflow-debug')
      console.log(await overflowReport())
    }
    assert.ok(report.length === 0, `Content fits viewport: ${JSON.stringify(report)}`)
  } else if (!documentFits) {
    await capture('overflow-debug')
    console.log(await overflowReport())
  }
  assert.ok(documentFits, 'Document fits viewport')
}

// Looseleaf paints its pencil edge and sheet shadow outside the paper box on purpose, so the
// decorative ink layers never count as overflow. A row that lives inside an `overflow-x: auto`
// strip may also be wider than its box: that is the strip's own scroll, not a layout fault.
const contentOverflow = (container) => {
  const ink = '[data-slot="paper-face"], [data-slot="paper-shadow"], svg[data-ink]'
  const limit = container.getBoundingClientRect().right + 1
  const offenders = []
  for (const element of container.querySelectorAll('*')) {
    if (element.closest(ink)) continue
    let scrollable = false
    for (let parent = element.parentElement; parent && parent !== container; parent = parent.parentElement) {
      const overflow = getComputedStyle(parent).overflowX
      if (overflow === 'auto' || overflow === 'scroll') { scrollable = true; break }
    }
    if (scrollable) continue
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 && rect.right > limit) offenders.push({ tag: element.tagName, class: String(element.className).slice(0, 60), right: Math.round(rect.right) })
  }
  return offenders.slice(0, 20)
}
const overflowReport = () => page.evaluate(() => {
  const container = document.querySelector('.content')
  if (!container) return []
  const ink = '[data-slot="paper-face"], [data-slot="paper-shadow"], svg[data-ink]'
  const limit = container.getBoundingClientRect().right + 1
  const offenders = []
  for (const element of document.querySelectorAll('body *')) {
    if (element.closest(ink)) continue
    const rect = element.getBoundingClientRect()
    if (rect.width > 0 && rect.right > limit) offenders.push({ tag: element.tagName, class: String(element.className).slice(0, 60), right: Math.round(rect.right) })
  }
  return offenders.slice(0, 20)
})

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await checkTheme('classic')
  await nav('设置')
  await page.getByRole('radio', { name: /手绘笔记/ }).check()
  await checkTheme('looseleaf')
  await page.waitForSelector('.theme-choice svg[data-ink] path')
  await page.locator('#settings-general').scrollIntoViewIfNeeded()
  await capture('settings-desktop')
  await page.reload()
  await checkTheme('looseleaf')
  await nav('设置')
  assert.ok(await page.getByRole('radio', { name: /手绘笔记/ }).isChecked(), 'Theme persists on reload')
  await page.getByRole('radio', { name: /油印卷子/ }).focus()
  await page.keyboard.press('Space')
  await checkTheme('classic')
  assert.equal(await page.locator('.ll-app').count(), 0)
  await page.getByRole('radio', { name: /手绘笔记/ }).check()
  const questions = [1, 2, 3].map(id => ({ id: `q${id}`, category: '第一章 · 公式与基础', type: 'single', stem: `示例 ${id}：已知 $x^2=4$ 且 $x>0$，求 $x$ 的值。`, options: [{ key: 'A', text: '$x=2$' }, { key: 'B', text: '$x=-2$' }], answer: ['A'], explanation: '由 $x^2=4$，得 $x=\\pm 2$。结合 $x>0$，所以 $x=2$。', difficulty: 1, tags: [] }))
  await page.evaluate(questions => localStorage.setItem('allright.workspace.v1', JSON.stringify({ version: 1, activeBankId: 'theme-demo', banks: [{ id: 'theme-demo', name: '手绘主题示例题库', importedAt: Date.now(), questions }], attempts: [], stats: {}, sessions: [] })), questions)
  await page.reload({ waitUntil: 'networkidle' })
  await capture('desktop')
  await nav('练习')
  await page.getByRole('button', { name: /^开始练习/ }).click()
  await page.locator('.katex').first().waitFor()
  await page.waitForSelector('.option svg[data-ink] path')
  // Decode an actual control background, proving the vendored engine produces visible ink.
  const decoded = await page.locator('.option').first().evaluate(async element => {
    const original = element.querySelector('svg[data-ink]')
    const clone = original.cloneNode(true)
    const defs = document.querySelector('[data-ll-defs] defs')?.cloneNode(true)
    if (defs) clone.prepend(defs)
    const styles = getComputedStyle(element)
    const markup = new XMLSerializer().serializeToString(clone).replace(/var\((--ll-[a-z-]+)\)/g, (_, key) => styles.getPropertyValue(key).trim() || 'normal')
    const source = 'data:' + 'image/svg+xml,' + encodeURIComponent(markup)
    const image = new Image()
    image.src = source
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    return pixels.some((value, index) => index % 4 === 3 && value > 0)
  })
  assert.ok(decoded, 'Looseleaf strokes decode and contain nontransparent pixels')
  await page.locator('.option').nth(1).click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  assert.match(await page.locator('.result__title').innerText(), /答错了/)
  assert.equal(await page.locator('.option__pick[aria-disabled="true"]').count(), 2, 'Revealed options retain disabled semantics')
  const chosenAfterReveal = await page.locator('.option__pick[aria-pressed="true"]').innerText()
  await page.locator('.option__pick').first().evaluate(element => element.click())
  assert.equal(await page.locator('.option__pick[aria-pressed="true"]').innerText(), chosenAfterReveal, 'Revealed answer cannot be changed')
  const progress = page.getByRole('progressbar', { name: '本次已答进度' })
  await progress.locator('[data-slot="progress-indicator"][data-ink-ready] svg[data-ink] path').first().waitFor()
  assert.equal(await progress.getAttribute('aria-valuenow'), '1')
  assert.ok(await progress.locator('[data-slot="progress-indicator"]').evaluate(element => {
    const style = getComputedStyle(element)
    return style.position === 'absolute' && element.offsetHeight > 0 && style.clipPath !== 'none'
  }), 'Answered progress has a measured, positioned ink fill')
  const counter = await page.locator('.practice__counter').innerText()
  await page.waitForTimeout(2500)
  assert.equal(await page.locator('.practice__counter').innerText(), counter, 'Wrong answer stays for explanation')
  await capture('practice-desktop')
  await page.getByRole('button', { name: '下一题', exact: true }).click()
  await page.locator('.option').first().click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.practice__counter')?.textContent.includes('3 / 3'))
  await page.setViewportSize({ width: 390, height: 844 })
  // The tab panels animate in; measure only once the resize has settled.
  await page.waitForTimeout(300)
  await noOverflow()
  await capture('mobile')
  for (const route of ['题库', '错题本', '设置']) {
    await nav(route)
    await noOverflow()
  }
  await page.locator('#settings-general').scrollIntoViewIfNeeded()
  await capture('settings-mobile')
  await page.getByRole('radio', { name: /油印卷子/ }).check()
  await checkTheme('classic')
  await page.setViewportSize({ width: 1440, height: 900 })
  await nav('看板')
  await capture('classic-desktop')
  assert.deepEqual(errors, [], 'No JS errors or failed local assets')
  console.log('PASS theme switching, reload, keyboard, SVG ink pixels, math, correct/wrong behavior, responsive routes, and local assets')
} finally {
  await browser.close()
}
