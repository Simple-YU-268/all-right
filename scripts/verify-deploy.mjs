/* 部署形态回归守卫：确认构建产物挂到根目录、子目录都能起来
   跑法：npm run build && npm run verify:deploy */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname, resolve } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const DIST = resolve(process.argv[2] ?? 'dist')
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

/* prefix 非空 = 模拟子目录托管：前缀之外的路径一律 404（GitHub Pages 项目站等同于此） */
function serve(root, port, prefix) {
  const server = createServer((req, res) => {
    const p = decodeURIComponent(req.url.split('?')[0])
    let rel = p
    if (prefix) {
      if (!p.startsWith(prefix)) {
        res.writeHead(404)
        return res.end('outside prefix')
      }
      rel = p.slice(prefix.length)
    }
    if (rel === '' || rel === '/') rel = '/index.html'
    const file = join(root, rel)
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404)
      return res.end('not found')
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })
  return new Promise((r) => server.listen(port, () => r(server)))
}

const fails = []

async function probe(label, url) {
  const b = await chromium.launch({ executablePath: EDGE, headless: true })
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 }, locale: 'zh-CN' })).newPage()
  const fontStatuses = []
  const errors = []
  p.on('response', (r) => {
    if (r.url().includes('.woff2')) fontStatuses.push(r.status())
  })
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 80)))
  let booted = false
  let sampleOk = false
  let serifOk = false
  try {
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 })
    await p.waitForTimeout(2200)
    booted = (await p.locator('.rail__name').count()) > 0
    if (booted) {
      serifOk = await p.evaluate(async () => {
        await document.fonts.ready
        return document.fonts.check('16px "Noto Serif SC"')
      })
      await p.locator('.rail__item').filter({ hasText: '题库' }).first().click()
      await p.waitForTimeout(500)
      await p.getByRole('button', { name: '载入示例题库' }).click()
      await p.waitForTimeout(1500)
      sampleOk = (await p.locator('.preview').count()) > 0
    }
  } catch (e) {
    errors.push(String(e).slice(0, 80))
  }
  await b.close()

  const ok = booted && sampleOk && serifOk
  if (!ok) fails.push(label)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  console.log(`      启动 ${booted ? '✓' : '✗'} · 示例题库 ${sampleOk ? '✓' : '✗'} · 宋体 ${serifOk ? '✓' : '✗'} · woff2 ${fontStatuses.length} 个（状态 ${[...new Set(fontStatuses)].join(',') || '无'}）`)
  if (errors.length) console.log(`      报错 ${errors[0]}`)
}

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`找不到 ${DIST}/index.html，先跑 npm run build`)
  process.exit(1)
}

console.log(`\n被测构建：${DIST}\n`)
const s1 = await serve(DIST, 8831, '')
await probe('根路径托管', 'http://localhost:8831/')
const s2 = await serve(DIST, 8832, '/allright')
await probe('子目录托管 /allright', 'http://localhost:8832/allright/')
s1.close()
s2.close()

console.log(fails.length ? `\n${fails.length} 项未通过` : '\n全部通过')
process.exit(fails.length ? 1 : 0)
