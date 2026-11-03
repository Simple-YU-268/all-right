import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
const mcpBank = {
  name: 'Agent 试卷',
  questions: [
    {
      id: 'mcp-1', type: 'single', category: '通信', stem: 'MCP 生成的题目',
      options: [{ key: 'A', text: '选项一' }, { key: 'B', text: '选项二' }],
      answer: ['A'], explanation: '', difficulty: 2, tags: [],
    },
    {
      id: 'mcp-2', type: 'judge', category: '通信', stem: 'MCP 生成的判断题',
      options: [], answer: ['正确'], explanation: '', difficulty: 1, tags: [],
    },
  ],
}

function installMock(data) {
    window.nativeCalls = []
    window.isTauri = true
    window.__TAURI_INTERNALS__ = {
      invoke: async (command, args, options) => {
        window.nativeCalls.push({ command, args: ArrayBuffer.isView(args) ? Array.from(args) : args, options })
        if (command === 'check_mcp') return '连接正常，四个 MCP 工具可用'
        if (command === 'get_mcp_config') return { mcpServers: { allright: { command: 'C:\\ALLRIGHT\\resources\\node.exe', args: ['C:\\ALLRIGHT\\resources\\mcp-server.mjs'], env: { ALLRIGHT_OUTPUT_DIR: 'C:\\ALLRIGHT\\output' } } } }
        if (command === 'list_mcp_outputs') {
          return [
            { name: '通信试卷.json', bytes: 2048, modifiedAt: Date.now() },
          ]
        }
        if (command === 'read_mcp_output') {
          if (!args.name.endsWith('.json') || args.name.includes('..')) throw new Error('文件名不合法')
          return JSON.stringify(data.mcpBank)
        }
        if (command === 'load_workspace') {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (localStorage.getItem('mock-load-failure')) throw new Error('模拟读取失败')
          return localStorage.getItem('mock-workspace') ?? JSON.stringify(data.workspace)
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
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await context.addInitScript(installMock, { workspace, mcpBank })
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
  await page.getByRole('button', { name: '复制 MCP 配置', exact: true }).waitFor()
  await page.getByText('查看连接配置', { exact: true }).click()
  assert.match(await page.locator('.settings').innerText(), /mcp-server\.mjs/)
  await page.getByRole('button', { name: '检测 MCP', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '连接正常，四个 MCP 工具可用' }).waitFor()
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

  /* MCP 产物列表、预览与导入，另开一个上下文，免得动到上面的题库断言。 */
  const mcpContext = await browser.newContext({ viewport: { width: 1280, height: 860 } })
  await mcpContext.addInitScript(installMock, { workspace, mcpBank })
  const mcpPage = await mcpContext.newPage()
  const mcpErrors = []
  mcpPage.on('pageerror', (error) => mcpErrors.push(String(error)))
  await mcpPage.goto(url)
  await mcpPage.getByRole('navigation').getByRole('button').filter({ hasText: '设置' }).click()
  await mcpPage.locator('.filerow__name').filter({ hasText: '通信试卷.json' }).waitFor()
  assert.equal(await mcpPage.locator('.filerow').count(), 1)
  await mcpPage.getByRole('button', { name: '查看', exact: true }).click()
  await mcpPage.locator('.mcp__preview').waitFor()
  assert.match(await mcpPage.locator('.mcp__preview').innerText(), /Agent 试卷/)
  await mcpPage.locator('.mcp__outputs').scrollIntoViewIfNeeded()
  await mcpPage.screenshot({ path: join(tmpdir(), 'allright-mcp-desktop.png') })
  await mcpPage.setViewportSize({ width: 390, height: 844 })
  assert.equal(await mcpPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await mcpPage.locator('.mcp__outputs').scrollIntoViewIfNeeded()
  await mcpPage.screenshot({ path: join(tmpdir(), 'allright-mcp-mobile.png') })
  await mcpPage.setViewportSize({ width: 1280, height: 860 })
  await mcpPage.getByRole('button', { name: '导入 2 题' }).click()
  await mcpPage.locator('.rail__bank').filter({ hasText: 'Agent 试卷' }).waitFor()
  await mcpPage.getByRole('status').filter({ hasText: '已导入题库「Agent 试卷」，共 2 题' }).waitFor()

  /* JSON Schema 也能直接导出给 Agent 用。 */
  await mcpPage.getByRole('button', { name: '下载 JSON Schema' }).click()
  await mcpPage.waitForFunction(() => window.nativeCalls.some((call) => call.command === 'plugin:fs|write_text_file'))
  const schema = await mcpPage.evaluate(() => {
    const call = window.nativeCalls.filter((entry) => entry.command === 'plugin:fs|write_text_file').pop()
    return JSON.parse(new TextDecoder().decode(new Uint8Array(call.args)))
  })
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema')
  assert.ok(schema.properties.questions)
  assert.deepEqual(mcpErrors, [])
  await mcpContext.close()

  console.log('PASS  模拟 Tauri IPC：先加载再保存、练习持久化、原生导出及取消、旧版备份恢复、无效备份与读写失败保护、MCP 产物列表预览导入与 Schema 导出')
} finally {
  await browser.close()
}
