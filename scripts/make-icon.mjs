/* 从 public/favicon.svg 生成打包用的应用图标（512×512 PNG）
   跑法：node scripts/make-icon.mjs */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'build'
mkdirSync(OUT, { recursive: true })

const svg = `
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; padding: 0; width: 512px; height: 512px; background: transparent; }
      svg { display: block; width: 512px; height: 512px; }
    </style>
  </head>
  <body>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
      <rect width="32" height="32" rx="4" fill="#1a2247" />
      <rect x="7" y="8" width="4" height="16" fill="#b3bddf" />
      <rect x="14" y="12" width="4" height="12" fill="#4a5dab" />
      <rect x="21" y="6" width="4" height="18" fill="#2a3e8f" />
    </svg>
  </body>
</html>
`

const browser = await chromium.launch({ executablePath: EDGE, headless: true })
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
await page.setContent(svg, { waitUntil: 'load' })
await page.screenshot({ path: resolve(OUT, 'icon.png'), omitBackground: true })
await browser.close()
console.log(`已生成 ${OUT}/icon.png（512×512）`)
