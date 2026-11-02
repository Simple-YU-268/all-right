import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})
const url = process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5173/'
const workspace = {
  version: 1, activeBankId: 'native-bank', attempts: [], stats: {}, sessions: [],
  banks: [{ id: 'native-bank', name: 'Rust 本地题库', importedAt: 1, questions: [{
    id: 'native-question', type: 'single', category: '原生章节', stem: '桌面接口测试题',
    options: [{ key: 'A', text: '正确选项' }, { key: 'B', text: '错误选项' }],
    answer: ['A'], explanation: '', difficulty: 1, tags: [],
  }] }],
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await context.addInitScript((data) => {
    window.nativeCalls = []
    window.isTauri = true
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args, options) => {
        window.nativeCalls.push({ command, args: ArrayBuffer.isView(args) ? Array.from(args) : args, options })
        if (command === 'load_workspace') {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (localStorage.getItem('mock-load-failure')) throw new Error('模拟读取失败')
          return localStorage.getItem('mock-workspace') ?? JSON.stringify(data)
        }
        if (command === 'save_workspace') {
          if (localStorage.getItem('mock-save-failure')) throw new Error('模拟磁盘已满')
          localStorage.setItem('mock-workspace', args.data)
          return
        }
        if (command === 'plugin:dialog|save') return localStorage.getItem('mock-cancel-save') ? null : 'C:\\backups\\workspace.json'
        if (command === 'plugin:dialog|message') return '确认'
        if (command === 'plugin:fs|write_text_file') return
        throw new Error(`未预期的 IPC：${command}`)
      },
    }
  }, workspace)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  const navigate = (label) => page.getByRole('navigation').getByRole('button').filter({ hasText: label }).click()
  await page.goto(url)
  await page.locator('.rail__bank').filter({ hasText: 'Rust 本地题库' }).waitFor()
  assert.equal(await page.evaluate(() => window.nativeCalls[0].command), 'load_workspace')
  await page.waitForFunction(() => window.nativeCalls.some((call) => call.command === 'save_workspace'))
  assert.equal(await page.evaluate(() => window.nativeCalls.filter((call) => call.command === 'save_workspace').every((call) => JSON.parse(call.args.data).banks.length === 1)), true)
  await navigate('练习')
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').click()
  await page.getByRole('button', { name: /错误选项/ }).click()
  await page.getByRole('button', { name: '确认答案', exact: true }).click()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('mock-workspace')).attempts.length === 1)
  await page.reload()
  await navigate('错题本')
  assert.match(await page.locator('.content__inner').innerText(), /桌面接口测试题/)
  await navigate('设置')
  assert.match(await page.locator('.settings').innerText(), /workspace.json/)
  await page.getByRole('button', { name: '导出备份', exact: true }).click()
  await page.waitForFunction(() => window.nativeCalls.some((call) => call.command === 'plugin:fs|write_text_file'))
  const exported = await page.evaluate(() => {
    const call = window.nativeCalls.find((entry) => entry.command === 'plugin:fs|write_text_file')
    return JSON.parse(new TextDecoder().decode(new Uint8Array(call.args)))
  })
  assert.equal(exported.attempts.length, 1)
  await page.evaluate(() => localStorage.setItem('mock-cancel-save', '1'))
  const writes = await page.evaluate(() => window.nativeCalls.filter((call) => call.command === 'plugin:fs|write_text_file').length)
  await page.getByRole('button', { name: '导出备份', exact: true }).click()
  await page.waitForFunction(() => window.nativeCalls.filter((call) => call.command === 'plugin:dialog|save').length === 2)
  assert.equal(await page.evaluate(() => window.nativeCalls.filter((call) => call.command === 'plugin:fs|write_text_file').length), writes)
  await page.getByLabel('选择工作区备份').setInputFiles({ name: 'legacy-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(workspace)) })
  await page.getByRole('status').filter({ hasText: '已恢复 1 个题库及练习记录' }).waitFor()
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('mock-workspace')).attempts.length === 0)
  await page.getByLabel('选择工作区备份').setInputFiles({ name: 'bad-backup.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"banks":[null]}') })
  await page.getByRole('status').filter({ hasText: '恢复失败' }).waitFor()
  assert.equal(await page.locator('.rail__bank').innerText(), 'Rust 本地题库')
  await page.evaluate(() => localStorage.setItem('mock-save-failure', '1'))
  await page.getByRole('button', { name: '清空本机数据', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '保存失败' }).waitFor()
  await page.evaluate(() => localStorage.setItem('mock-load-failure', '1'))
  await page.reload()
  await page.getByRole('alert').filter({ hasText: '读取本地数据失败' }).waitFor()
  assert.equal(await page.evaluate(() => window.nativeCalls.filter((call) => call.command === 'save_workspace').length), 0)
  assert.deepEqual(errors, [])
  console.log('PASS  模拟 Tauri IPC：先加载再保存、练习持久化、原生导出及取消、旧版备份恢复、无效备份与读写失败保护')
} finally {
  await browser.close()
}
