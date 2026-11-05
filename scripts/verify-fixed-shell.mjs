import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { readFile } from 'node:fs/promises'
const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
try {
  for (const theme of ['classic', 'looseleaf']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } })
    await page.goto(process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5182/', { waitUntil: 'networkidle' })
    await page.evaluate(theme => localStorage.setItem('allright.theme.v1', theme), theme)
    await page.reload()
    await page.waitForTimeout(500)
    const navigation = page.getByRole('navigation').first()
    await navigation.getByRole(theme === 'classic' ? 'button' : 'tab', { name: /设置/ }).click()
    const shell = page.locator(theme === 'classic' ? '.rail' : '.study-header')
    const before = await shell.boundingBox()
    const area = page.locator(theme === 'classic' ? '.content' : '.ll-stage').first()
    await area.evaluate(element => { element.scrollTop = 500 })
    assert.deepEqual(await shell.boundingBox(), before, `${theme}: navigation stays fixed`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true, `${theme}: window height stays fixed`)
    assert.ok((await page.locator('.app-update').innerText()).includes(`当前版本 v${version}`))
    await page.screenshot({ path: `.impeccable/review/fixed-shell-${theme}.png` })
    await page.close()
  }
  console.log('PASS fixed window, navigation and version in both themes')
} finally { await browser.close() }
