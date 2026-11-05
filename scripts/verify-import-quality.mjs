import assert from 'node:assert/strict'
import { loadAppModule } from './lib/load-app-module.mjs'
const { parseBank } = await loadAppModule('src/domain/parseBank.ts')
const valid = { id: 'q1', type: 'single', stem: '题干', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: ['A'] }
const parsed = parseBank({ questions: [valid, null, { ...valid, id: 'q3', answer: [] }] })
assert.equal(parsed.sourceCount, 3, '源题数必须独立保存，不能用错误条数推算')
assert.equal(parsed.valid.length, 1)
assert.deepEqual(parsed.sourceIndices, [0])
assert.equal(parsed.sourceCount - parsed.valid.length, 2)
console.log('PASS import source reconciliation: every source question accounted for')
const { chromium } = await import('playwright-core')
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
try {
  for (const theme of ['classic', 'looseleaf']) {
    const page = await browser.newPage()
    await page.goto('http://127.0.0.1:5182/')
    await page.getByRole('navigation').first().waitFor()
    await page.evaluate(theme => { localStorage.clear(); localStorage.setItem('allright.theme.v1', theme) }, theme)
    await page.reload()
    await page.getByRole('navigation').first().getByRole(theme === 'classic' ? 'button' : 'tab', { name: '题库', exact: true }).click()
    await page.locator('input[type=file]').first().setInputFiles({ name: 'quality.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ questions: [valid, null, { ...valid, id: 'q3', answer: [] }] })) })
    await page.getByText('源题对账：3 题 = 可导入 1 题 + 待处理 2 题').waitFor()
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: '导入 1 题', exact: true }).click()
    assert.equal(await page.locator('.preview').count(), 1, '取消部分导入保留预览')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: '导入 1 题', exact: true }).click()
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('allright.workspace.v1')).banks.some(bank => bank.questions.length === 1))
    await page.close()
  }
  console.log('PASS both themes: partial import requires explicit confirmation, cancel retains preview')
} finally { await browser.close() }
