import { isTauri } from '@tauri-apps/api/core'

export const IS_TAURI = isTauri()
export const IS_DESKTOP = IS_TAURI ||
  (typeof window !== 'undefined' && window.location.protocol === 'app:') ||
  import.meta.env.VITE_DESKTOP === '1'

export const DATA_PLACE = IS_DESKTOP ? '这台电脑上' : '这台电脑的浏览器里'
export const DATA_STORE = IS_DESKTOP ? '应用本地存储' : '浏览器的本地存储'
export const DATA_RESET = IS_DESKTOP ? '清理应用数据' : '清浏览器数据'

export async function confirmAction(text: string): Promise<boolean> {
  if (IS_TAURI) {
    const { confirm } = await import('@tauri-apps/plugin-dialog')
    return confirm(text, { title: 'ALL RIGHT 全对', kind: 'warning', okLabel: '确认', cancelLabel: '取消' })
  }
  return window.confirm(text)
}
