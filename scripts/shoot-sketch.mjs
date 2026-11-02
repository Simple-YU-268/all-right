import { chromium } from 'playwright-core'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SRC = 'file:///C:/Users/yy197/Desktop/Kuku/.impeccable/mocks/decision/assigned.html'
const OUT = '.impeccable/mocks/decision/_shot_assigned.png'

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto(SRC, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: OUT })
console.log('shot ok', OUT)
await browser.close()
