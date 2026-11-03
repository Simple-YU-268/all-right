import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const directory = join(process.env.APPDATA, 'com.allright.quandui')
const file = join(directory, 'workspace.json')
const original = await readFile(file).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
const port = 19487
let child, browser
async function launch() {
  child = spawn(resolve('src-tauri/target/release/all-right.exe'), [], { windowsHide: true,
    env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` }, stdio: 'ignore' })
  for (let i = 0; i < 120; i++) {
    try {
      const data = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
      browser = await chromium.connectOverCDP(data.webSocketDebuggerUrl)
      const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().includes('tauri.localhost') || page.url().startsWith('http://localhost'))
      if (page) { await page.waitForLoadState('domcontentloaded'); return page }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('Native app did not start')
}
async function kill() {
  if (!child || child.exitCode !== null) return
  const exited = new Promise(resolve => child.once('exit', resolve))
  child.kill()
  await exited
  browser = null
  await new Promise(resolve => setTimeout(resolve, 600))
}
try {
  await mkdir(directory, { recursive: true })
  const question = { id: 'q1', category: '测试', type: 'single', stem: '原生恢复测试', options: [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }], answer: ['A'], explanation: '解析', tags: [], difficulty: 1 }
  await writeFile(file, JSON.stringify({ version: 2, banks: [{ id: 'b', name: '原生恢复', questions: [question], importedAt: 1 }], activeBankId: 'b', attempts: [], stats: {}, sessions: [] }))
  let page = await launch()
  await page.evaluate(() => localStorage.setItem('allright.theme.v1', 'classic'))
  await page.reload()
  await page.locator('.rail__item').filter({ hasText: '练习' }).click()
  await page.getByRole('button', { name: /^开始练习/ }).click()
  await page.locator('.option__pick').nth(1).click()
  await page.waitForTimeout(1300)
  const before = JSON.parse(await readFile(file, 'utf8'))
  assert.deepEqual(before.activeSession.drafts.q1, ['B'])
  await kill()
  await new Promise(resolve => setTimeout(resolve, 1600))
  page = await launch()
  await page.getByRole('button', { name: '继续练习', exact: true }).click()
  assert.equal(await page.locator('.option__pick[aria-pressed="true"]').count(), 1)
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.waitForTimeout(1200)
  await kill()
  page = await launch()
  await page.getByRole('button', { name: '继续练习', exact: true }).click()
  assert.match(await page.locator('.result__title').innerText(), /答错/)
  assert.equal(JSON.parse(await readFile(file, 'utf8')).attempts.length, 1)
  console.log('PASS native process termination/relaunch: disk-backed drafts and answers, one attempt')
} finally {
  await kill()
  if (original === null) await rm(file, { force: true })
  else await writeFile(file, original)
}
