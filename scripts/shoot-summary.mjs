import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = process.env.KUKU_URL || 'http://localhost:5173/'
const OUT = '.impeccable/review'
mkdirSync(OUT, { recursive: true })

const sample = JSON.parse(readFileSync('public/sample-bank.json', 'utf8'))
const seed = JSON.stringify({
  version: 1,
  banks: [
    {
      id: 'bank-demo',
      name: sample.name,
      importedAt: Date.now() - 20 * 86400000,
      questions: sample.questions,
    },
  ],
  activeBankId: 'bank-demo',
  attempts: [],
  stats: {},
  sessions: [],
})

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const errors = []

async function run(width, height, tag, mobile = false) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
    locale: 'zh-CN',
  })
  await context.addInitScript((data) => {
    window.localStorage.setItem('allright.workspace.v1', data)
  }, seed)

  const page = await context.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '练习', exact: true }).click()
  await page.waitForTimeout(400)
  await page.getByRole('group', { name: '题量' }).getByRole('button', { name: '10 题', exact: true }).click()
  await page.getByRole('button', { name: /开始练习/ }).click()
  await page.waitForTimeout(500)

  for (let i = 0; i < 10; i++) {
    // 每题随手点一个，别把结算拍成 0%
    const options = page.locator('.option')
    const total = await options.count()
    await options.nth(Math.floor(Math.random() * total)).click()
    await page.getByRole('button', { name: '确认答案' }).click()
    await page.waitForTimeout(350)
    const next = page.getByRole('button', { name: /下一题|看本次结算/ })
    await next.first().click()
    await page.waitForTimeout(350)
  }

  await page.waitForTimeout(120)

  // 停在反相动画的最深处（38% ≈ 235ms），看看负片上的字还看不看得见
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => {
      a.pause()
      a.currentTime = 235
    })
  })
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${OUT}/${tag}-summary-flip.png` })
  console.log('captured', `${tag}-summary-flip`)

  await page.evaluate(() => {
    document.getAnimations().forEach((a) => {
      a.currentTime = 620
      a.play()
    })
  })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${tag}-summary.png` })
  console.log('captured', `${tag}-summary`)

  await context.close()
}

await run(1440, 900, 'desktop')
await run(390, 844, 'mobile', true)

if (errors.length) console.log('console errors:', errors.slice(0, 5))
await browser.close()
