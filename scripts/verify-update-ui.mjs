import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript(() => {
    window.isTauri = true
    window.calls = []
    window.failure = 'network'
    window.__TAURI_INTERNALS__ = {
      transformCallback: () => 1, unregisterCallback: () => {},
      invoke: async (command) => {
        window.calls.push(command)
        if (command === 'load_workspace') return JSON.stringify({ version: 2, banks: [], attempts: [], stats: {}, sessions: [], assets: {} })
        if (command === 'save_workspace') { if (window.failure === 'save') throw Error('disk full'); return }
        if (command === 'plugin:app|version') return '0.8.6'
        if (command === 'plugin:updater|check') {
          if (window.failure === 'network') throw Error('network')
          return { rid: 1, currentVersion: '0.8.6', version: '0.8.7', rawJson: {} }
        }
        if (command === 'plugin:updater|download') throw Error('signature verification failed')
        if (command === 'plugin:resources|close') return
        throw Error(command)
      },
    }
  })
  await page.goto('http://127.0.0.1:5182/')
  await page.getByText('检查失败，请重试', { exact: true }).waitFor()
  await page.evaluate(() => window.failure = 'save')
  await page.getByRole('button', { name: '检查更新', exact: true }).click()
  await page.getByRole('button', { name: '更新至 v0.8.7' }).click()
  await page.getByText(/进度保存失败，未开始更新/).waitFor()
  assert.equal(await page.evaluate(() => window.calls.includes('plugin:updater|download')), false)
  await page.evaluate(() => window.failure = 'signature')
  await page.getByRole('button', { name: '更新至 v0.8.7' }).click()
  await page.getByText(/更新签名校验失败，未安装/).waitFor()
  assert.equal(await page.evaluate(() => window.calls.includes('plugin:updater|install')), false)
  assert.equal(await page.getByRole('button', { name: '更新至 v0.8.7' }).isEnabled(), true)
  console.log('PASS updater UI: network recovery, save failure blocks download, signature failure blocks install, retry unlocked')
} finally { await browser.close() }
