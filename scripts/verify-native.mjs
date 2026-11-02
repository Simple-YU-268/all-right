import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'

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
  let page
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
  await page.locator('.rail__item').nth(4).click()
  await page.locator('code').filter({ hasText: 'workspace.json' }).waitFor()
  const roundTrip = await page.evaluate(async () => {
    const invoke = (command, args) => window.__TAURI_INTERNALS__.invoke(command, args)
    const original = await invoke('load_workspace')
    if (original === null) throw new Error('Initial workspace was not persisted')
    await invoke('save_workspace', { data: original })
    await invoke('save_workspace', { data: original })
    const saved = await invoke('load_workspace')
    let rejectedInvalid = false
    try {
      await invoke('save_workspace', { data: '{"version":2,"banks":[]}' })
    } catch {
      rejectedInvalid = true
    }
    return { unchanged: saved === original && await invoke('load_workspace') === original, rejectedInvalid }
  })
  assert.deepEqual(roundTrip, { unchanged: true, rejectedInvalid: true })
  assert.deepEqual(errors, [])
  console.log('PASS Native executable: bundled assets, React startup, Tauri detection, Rust read/write and replacement, invalid-data rejection')
} finally {
  if (browser) await browser.close().catch(() => undefined)
  if (child.exitCode === null) child.kill()
}
