import { EMPTY_WORKSPACE, type Workspace } from './types'
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
  const parsed = JSON.parse(raw) as Workspace
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.banks)) throw new Error('工作区格式不正确')
  if (parsed.banks.some((bank) => !bank || typeof bank.id !== 'string' || typeof bank.name !== 'string' || !Array.isArray(bank.questions))) {
    throw new Error('备份中的题库格式不正确')
  }
  for (const bank of parsed.banks) {
    if (bank.questions.some((question) => !question || typeof question.id !== 'string' ||
      typeof question.category !== 'string' || typeof question.stem !== 'string' ||
      !['single', 'multiple', 'judge'].includes(question.type) ||
      !Array.isArray(question.options) || !Array.isArray(question.answer) ||
      !question.options.every((option) => option && typeof option.key === 'string' && typeof option.text === 'string') ||
      !question.answer.every((answer) => typeof answer === 'string'))) {
      throw new Error('备份中的题目格式不正确')
    }
  }
  return {
    version: 1,
    banks: parsed.banks,
    activeBankId: parsed.activeBankId ?? null,
    attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
    stats: parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {},
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  }
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

async function exportNativeJson(filename: string, data: unknown): Promise<void> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  const path = await save({ defaultPath: filename, filters: [{ name: 'JSON 文件', extensions: ['json'] }] })
  if (path) await writeTextFile(path, JSON.stringify(data, null, 2))
}
