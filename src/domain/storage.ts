import { EMPTY_WORKSPACE, type AssetMeta, type Bank, type ContentBlock, type Workspace } from './types'
import { invoke } from '@tauri-apps/api/core'
import { IS_TAURI } from './shell'

const STORAGE_KEY = 'allright.workspace.v1'

let pendingSave: Promise<void> = Promise.resolve()

export async function loadWorkspace(): Promise<Workspace> {
  if (IS_TAURI) {
    const raw = await invoke<string | null>('load_workspace')
    if (raw !== null) return parseWorkspace(raw)
  }
  if (typeof localStorage === 'undefined') return EMPTY_WORKSPACE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_WORKSPACE
    return parseWorkspace(raw)
  } catch {
    return EMPTY_WORKSPACE
  }
}

export function parseWorkspace(raw: string): Workspace {
  const parsed = JSON.parse(raw) as Record<string, unknown>
  const version = parsed?.version
  if (version !== 1 && version !== 2) {
    throw new Error('工作区格式不正确')
  }
  if (!Array.isArray(parsed.banks)) {
    throw new Error('工作区格式不正确')
  }
  const banks = parsed.banks as Bank[]
  if (banks.some((bank) => !bank || typeof bank.id !== 'string' || typeof bank.name !== 'string' || !Array.isArray(bank.questions))) {
    throw new Error('备份中的题库格式不正确')
  }
  for (const bank of banks) {
    if (bank.questions.some((question) => !question || typeof question.id !== 'string' ||
      typeof question.category !== 'string' || typeof question.stem !== 'string' ||
      !['single', 'multiple', 'judge'].includes(question.type) ||
      !Array.isArray(question.options) || !Array.isArray(question.answer) ||
      !question.options.every((option) => option && typeof option.key === 'string' && typeof option.text === 'string') ||
      !question.answer.every((answer) => typeof answer === 'string'))) {
      throw new Error('备份中的题目格式不正确')
    }
    if (bank.questions.some((question) => !hasValidBlocks(question.stemBlocks) ||
      !hasValidBlocks(question.explanationBlocks) ||
      question.options.some((option) => !hasValidBlocks(option.blocks)))) {
      throw new Error('备份中的图片内容块格式不正确')
    }
  }
  return {
    version: 2,
    activeSession: parsed.activeSession as Workspace['activeSession'],
    banks,
    activeBankId: typeof parsed.activeBankId === 'string' ? parsed.activeBankId : null,
    attempts: Array.isArray(parsed.attempts) ? (parsed.attempts as Workspace['attempts']) : [],
    stats: parsed.stats && typeof parsed.stats === 'object' ? (parsed.stats as Workspace['stats']) : {},
    sessions: Array.isArray(parsed.sessions) ? (parsed.sessions as Workspace['sessions']) : [],
    assets: normalizeAssets(parsed.assets),
  }
}

function hasValidBlocks(blocks: ContentBlock[] | undefined): boolean {
  if (blocks === undefined) return true
  if (!Array.isArray(blocks)) return false
  return blocks.every((block) => {
    if (!block || typeof block !== 'object') return false
    if (block.type === 'text') return typeof block.text === 'string'
    if (block.type === 'image') return typeof block.assetId === 'string' && block.assetId.length > 0
    return false
  })
}

function normalizeAssets(raw: unknown): Record<string, AssetMeta> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const assets: Record<string, AssetMeta> = {}
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const meta = value as Partial<AssetMeta>
    if (typeof meta.mime !== 'string' || typeof meta.bytes !== 'number') continue
    assets[id] = { mime: meta.mime, bytes: meta.bytes }
  }
  return assets
}

export async function saveWorkspace(workspace: Workspace): Promise<void> {
  if (IS_TAURI) {
    const data = JSON.stringify(workspace)
    pendingSave = pendingSave.catch(() => undefined).then(() => invoke<void>('save_workspace', { data }))
    return pendingSave
  }
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  } catch (err) {
    throw new Error('无法写入本地存储，请导出备份。', { cause: err })
  }
}

export function downloadJson(filename: string, data: unknown): void {
  if (IS_TAURI) {
    void exportNativeJson(filename, data).catch(async (error: unknown) => {
      const { message } = await import('@tauri-apps/plugin-dialog')
      await message(`导出失败：${String(error)}`, { title: 'ALL RIGHT 全对', kind: 'error' })
    })
    return
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 下载二进制文件（题库包、工作区备份包）。 */
export function downloadBinary(filename: string, bytes: Uint8Array): void {
  if (IS_TAURI) {
    void exportNativeBinary(filename, bytes).catch(async (error: unknown) => {
      const { message } = await import('@tauri-apps/plugin-dialog')
      await message(`导出失败：${String(error)}`, { title: 'ALL RIGHT 全对', kind: 'error' })
    })
    return
  }
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy.buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function exportNativeJson(filename: string, data: unknown): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const path = await save({ defaultPath: filename, filters: [{ name: 'JSON 文件', extensions: ['json'] }] })
  if (path) await writeTextFile(path, JSON.stringify(data, null, 2))
}

async function exportNativeBinary(filename: string, bytes: Uint8Array): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeFile } = await import('@tauri-apps/plugin-fs')
  const path = await save({
    defaultPath: filename,
    filters: [{ name: 'ALL RIGHT 全对 题库包', extensions: ['allright'] }],
  })
  if (path) await writeFile(path, bytes)
}
