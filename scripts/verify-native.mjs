import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const root = resolve('.')
const executable = resolve(process.argv[2] ?? 'src-tauri/target/release/all-right.exe')
assert.ok(existsSync(executable), `Executable not found: ${executable}`)
const portProbe = createServer()
await new Promise((resolve, reject) => {
  portProbe.once('error', reject)
  portProbe.listen(0, '127.0.0.1', resolve)
})
const port = portProbe.address().port
await new Promise((resolve) => portProbe.close(resolve))

const child = spawn(executable, [], {
  windowsHide: true,
  env: {
    ...process.env,
    WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `${process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS ?? ''} --remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
  },
  stdio: ['ignore', 'ignore', 'pipe'],
})
let startupError
let stderr = ''
child.on('error', (error) => { startupError = error })
child.stderr.on('data', (data) => { stderr = (stderr + String(data)).slice(-8000) })
let browser
let page
/* 测试跑的是真实应用目录：先把原样记下来，跑完好还原，别弄脏用户的题库。 */
let originalWorkspace = null
let assetsBefore = []

try {
  const deadline = Date.now() + 30000
  let endpoint
  while (Date.now() < deadline) {
    if (startupError) throw startupError
    if (child.exitCode !== null) throw new Error(`App exited with code ${child.exitCode}: ${stderr}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`)
      endpoint = (await response.json()).webSocketDebuggerUrl
      if (endpoint) break
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(endpoint, `WebView2 debugging endpoint unavailable: ${stderr}`)
  browser = await chromium.connectOverCDP(endpoint)
  while (Date.now() < deadline) {
    page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().includes('tauri.localhost'))
    if (page) break
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert.ok(page, 'App must load its bundled assets from tauri.localhost')
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.locator('.rail__brand').waitFor({ timeout: 15000 })
  assert.equal(await page.locator('.rail__name').innerText(), 'ALL RIGHT')
  assert.equal(await page.evaluate(() => !!window.isTauri), true)
  const snapshot = await page.evaluate(async () => {
    const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args)
    return { workspace: await invoke('load_workspace'), assets: await invoke('list_assets') }
  })
  originalWorkspace = snapshot.workspace
  assetsBefore = snapshot.assets
  await page.locator('.rail__item').nth(4).click()
  await page.locator('code').filter({ hasText: 'workspace.json' }).waitFor()
  await page.getByText('章节组织规则', { exact: true }).click()
  await page.getByText('JSON 模板与兼容字段', { exact: true }).click()
  assert.match(await page.locator('.chapter-guide[aria-label="章节管理说明"]').innerText(), /category/)
  assert.match(await page.locator('.chapter-guide[aria-label="章节管理说明"]').innerText(), /默认全选/)
  const template = JSON.parse(await page.locator('#settings-format pre.schema__code.t-data').innerText())
  assert.equal(template.questions.length, 3)
  assert.equal(new Set(template.questions.map((question) => question.category)).size, 2)
  const roundTrip = await page.evaluate(async () => {
    const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args)
    const original = await invoke('load_workspace')
    if (original === null) throw new Error('Initial workspace was not persisted')
    await invoke('save_workspace', { data: original })
    await invoke('save_workspace', { data: original })
    const saved = await invoke('load_workspace')
    let rejectedInvalid = false
    try {
      await invoke('save_workspace', { data: '{"version":99,"banks":[]}' })
    } catch {
      rejectedInvalid = true
    }
    let acceptedLegacy = false
    try {
      await invoke('save_workspace', { data: '{"version":1,"banks":[]}' })
      acceptedLegacy = true
      await invoke('save_workspace', { data: original })
    } catch {
      acceptedLegacy = false
    }
    return { unchanged: saved === original && await invoke('load_workspace') === original, rejectedInvalid, acceptedLegacy }
  })
  assert.deepEqual(roundTrip, { unchanged: true, rejectedInvalid: true, acceptedLegacy: true })

  /* 图片资源仓库：落盘、读回、拒绝坏 ID 与坏类型、删除 */
  const assets = await page.evaluate(async () => {
    const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args)
    const id = 'a'.repeat(64)
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    await invoke('save_asset', { id, data: png, mime: 'image/png' })
    const listed = await invoke('list_assets')
    const raw = await invoke('read_asset', { id })
    const head = Array.from(new Uint8Array(raw).slice(0, 4))
    let rejectedBadId = false
    try {
      await invoke('save_asset', { id: '../escape', data: png, mime: 'image/png' })
    } catch {
      rejectedBadId = true
    }
    let rejectedBadMime = false
    try {
      await invoke('save_asset', { id: 'b'.repeat(64), data: png, mime: 'image/webp' })
    } catch {
      rejectedBadMime = true
    }
    await invoke('delete_assets', { ids: [id] })
    const after = await invoke('list_assets')
    return {
      listed: listed.includes(id),
      head,
      rejectedBadId,
      rejectedBadMime,
      removed: !after.includes(id),
    }
  })
  assert.deepEqual(assets, {
    listed: true,
    head: [0x89, 0x50, 0x4e, 0x47],
    rejectedBadId: true,
    rejectedBadMime: true,
    removed: true,
  })

  /* 桌面端导入图片题库包：图片落盘后要真能在页面上显示出来 */
  await page.locator('.rail__item').nth(2).click()
  await page.locator('.dropzone input[type=file]').setInputFiles(join(root, 'public', 'sample-image-bank.allright'))
  await page.locator('.preview').waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: /^导入 \d+ 题$/ }).click()
  await page.waitForTimeout(1500)
  await page.locator('.rail__item').nth(1).click()
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').first().click()
  await page.locator('.media__img').first().waitFor({ timeout: 15000 })
  const decoded = await page.locator('.media__img').first().evaluate((img) => img.naturalWidth > 0)
  assert.equal(decoded, true, 'Native app must render imported images')

  assert.deepEqual(errors, [])
  console.log('PASS Native executable: bundled assets, chapter guide and template, React startup, Tauri detection, Rust read/write and replacement, invalid-data rejection, image asset store and picture questions')
} finally {
  /* 还原工作区，只删掉这次测试新增的图片，别碰用户自己的资源。 */
  if (page) {
    await page.evaluate(async (state) => {
      const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args)
      try {
        const current = await invoke('list_assets')
        const added = current.filter((id) => !state.assetsBefore.includes(id))
        if (added.length) await invoke('delete_assets', { ids: added })
        if (state.originalWorkspace) await invoke('save_workspace', { data: state.originalWorkspace })
      } catch {}
    }, { originalWorkspace, assetsBefore }).catch(() => undefined)
  }
  if (browser) await browser.close().catch(() => undefined)
  if (child.exitCode === null) child.kill()
}
