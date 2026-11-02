import { EMPTY_WORKSPACE, type Workspace } from './types'

const STORAGE_KEY = 'allright.workspace.v1'

export function loadWorkspace(): Workspace {
  if (typeof localStorage === 'undefined') return EMPTY_WORKSPACE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_WORKSPACE
    const parsed = JSON.parse(raw) as Workspace
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.banks)) return EMPTY_WORKSPACE
    return {
      version: 1,
      banks: parsed.banks,
      activeBankId: parsed.activeBankId ?? null,
      attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
      stats: parsed.stats && typeof parsed.stats === 'object' ? parsed.stats : {},
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    }
  } catch {
    return EMPTY_WORKSPACE
  }
}

export function saveWorkspace(workspace: Workspace): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace))
  } catch (err) {
    // Quota exceeded or storage disabled — the app keeps working in memory.
    console.warn('[allright] 无法写入本地存储', err)
  }
}

export function downloadJson(filename: string, data: unknown): void {
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
