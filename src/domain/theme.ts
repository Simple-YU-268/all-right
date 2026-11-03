import { useSyncExternalStore } from 'react'

export type Theme = 'classic' | 'looseleaf'
const KEY = 'allright.theme.v1'
const EVENT = 'allright-theme-change'
let current: Theme = loadTheme()

export function loadTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'looseleaf' ? 'looseleaf' : 'classic'
  } catch {
    return 'classic'
  }
}

export function applyTheme(theme: Theme): void {
  current = theme
  document.documentElement.dataset.theme = theme
  document.documentElement.classList.toggle('ll-ui', theme === 'looseleaf')
}

export function saveTheme(theme: Theme): void {
  try { localStorage.setItem(KEY, theme) } catch { /* Keep this session usable. */ }
  applyTheme(theme)
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      applyTheme(loadTheme())
      listener()
    }
  }
  window.addEventListener(EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme(): [Theme, typeof saveTheme] {
  return [useSyncExternalStore(subscribe, () => current, () => 'classic' as Theme), saveTheme]
}
