import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync, copyFileSync } from 'node:fs'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL = process.env.KUKU_URL || 'http://localhost:5173/'
const OUT = '.impeccable/review'
mkdirSync(OUT, { recursive: true })

const sample = JSON.parse(readFileSync('public/sample-bank.json', 'utf8'))

function buildSeed() {
  const questions = sample.questions
  const now = Date.now()
  const day = 86400000
  const attempts = []
  const stats = {}
  let n = 0
  // 造 14 天的练习记录：前密后疏，其中若干题反复答错。
  for (let d = 13; d >= 0; d--) {
    const count = d < 3 ? 16 + ((d * 7) % 11) : d < 7 ? 6 + ((d * 5) % 9) : d < 11 ? 2 + (d % 5) : 0
    for (let i = 0; i < count; i++) {
      const q = questions[(d * 13 + i * 3) % questions.length]
      const hard = ['cn-013', 'cn-020', 'cn-023', 'cn-022', 'cn-015', 'cn-018'].includes(q.id)
      const correct = hard ? Math.random() < 0.35 : Math.random() < 0.86
      const at = now - d * day + 8 * 3600000 + i * 42000 + (d % 5) * 3600000
      const chosen = correct ? q.answer : q.options.filter((o) => !q.answer.includes(o.key)).slice(0, 1).map((o) => o.key)
      attempts.push({
        id: `a${n++}`,
        bankId: 'bank-demo',
        questionId: q.id,
        chosen,
        correct,
        at,
        elapsedMs: 9000 + Math.floor(Math.random() * 26000),
      })
      const prev = stats[q.id]
      const consecutiveCorrect = correct ? (prev?.consecutiveCorrect ?? 0) + 1 : 0
      stats[q.id] = {
        questionId: q.id,
        attempts: (prev?.attempts ?? 0) + 1,
        correctCount: (prev?.correctCount ?? 0) + (correct ? 1 : 0),
        wrongCount: (prev?.wrongCount ?? 0) + (correct ? 0 : 1),
        consecutiveCorrect,
        lastAt: at,
        totalMs: (prev?.totalMs ?? 0) + 12000,
      }
    }
  }
  return {
    version: 1,
    banks: [
      {
        id: 'bank-demo',
        name: sample.name,
        importedAt: now - 20 * day,
        questions,
      },
    ],
    activeBankId: 'bank-demo',
    attempts,
    stats,
    sessions: [],
  }
}

const seed = JSON.stringify(buildSeed())

const browser = await chromium.launch({ executablePath: EDGE, headless: true })

const UNLOCK_CSS =
  'html,body,#root{height:auto!important}.app{height:auto!important}.content{overflow:visible!important}'

async function setScrollMode(page, expanded) {
  await page.evaluate(
    ({ expanded, css }) => {
      let el = document.getElementById('__shot_unlock')
      if (expanded) {
        if (!el) {
          el = document.createElement('style')
          el.id = '__shot_unlock'
          document.head.appendChild(el)
        }
        el.textContent = css
      } else if (el) {
        el.remove()
      }
    },
    { expanded, css: UNLOCK_CSS },
  )
  await page.waitForTimeout(250)
}

async function shoot(page, name, fullPage = false) {
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage })
  console.log('captured', name)
}

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
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(URL, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  if (mobile) await setScrollMode(page, true)
  await shoot(page, `${tag}-dashboard`, true)
  if (mobile) await setScrollMode(page, false)

  // 练习：答一题，拍下「选错了」之后的样子——选错的选项上要有朱红批改
  await page.getByRole('button', { name: '练习', exact: true }).click()
  await page.waitForTimeout(400)
  await shoot(page, `${tag}-practice-start`)
  const start = page.getByRole('button', { name: /开始练习/ })
  if (await start.count()) {
    await start.first().click()
    await page.waitForTimeout(500)
    // 每轮换一个选项下手，直到碰上「选错了」的那一个
    for (let round = 0; round < 6; round++) {
      const options = page.locator('.option')
      const total = await options.count()
      if (!total) break
      await options.nth(round % total).scrollIntoViewIfNeeded()
      await options.nth(round % total).click()
      await page.getByRole('button', { name: '确认答案' }).click()
      await page.waitForTimeout(500)
      if (await page.locator('.option--wrong').count()) break
      const next = page.getByRole('button', { name: /下一题|看本次结算/ })
      if (!(await next.count())) break
      await next.first().click()
      await page.waitForTimeout(400)
    }
    if (mobile) await page.locator('.options').scrollIntoViewIfNeeded()
    await shoot(page, `${tag}-practice-revealed`)
  }

  // 错题本
  await page.getByRole('button', { name: /错题本/ }).click()
  await page.waitForTimeout(400)
  if (mobile) await setScrollMode(page, true)
  await shoot(page, `${tag}-wrongbook`, true)
  if (mobile) await setScrollMode(page, false)

  // 题库
  await page.getByRole('button', { name: '题库', exact: true }).click()
  await page.waitForTimeout(400)
  if (mobile) await setScrollMode(page, true)
  await shoot(page, `${tag}-banks`, true)
  if (mobile) await setScrollMode(page, false)

  // 设置
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.waitForTimeout(400)
  if (mobile) await setScrollMode(page, true)
  await shoot(page, `${tag}-settings`, true)
  if (mobile) await setScrollMode(page, false)

  if (errors.length) console.log(`[${tag}] console errors:`, errors.slice(0, 5))
  await context.close()
}

await run(1440, 900, 'desktop')
await run(1280, 800, 'desktop-1280')
await run(390, 844, 'mobile', true)

// 规范名：看板那张同时留一份 desktop.png / mobile.png
copyFileSync(`${OUT}/desktop-dashboard.png`, `${OUT}/desktop.png`)
copyFileSync(`${OUT}/mobile-dashboard.png`, `${OUT}/mobile.png`)

await browser.close()
console.log('done')
