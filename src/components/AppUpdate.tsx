import { useEffect, useRef, useState } from 'react'
import { getVersion } from '@tauri-apps/api/app'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { IS_TAURI } from '../domain/shell'
import { useApp } from '../domain/store'
import { saveWorkspace } from '../domain/storage'
import { ThemedButton } from './ThemedButton'
import { version as webVersion } from '../../package.json'
import { runUpdate, updateErrorMessage, type UpdateStage } from '../domain/updateFlow'

export function AppUpdate() {
  const { clockSession, snapshotWorkspace } = useApp()
  const [version, setVersion] = useState(webVersion)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [available, setAvailable] = useState<string | null>(null)
  const update = useRef<Update | null>(null)
  const lock = useRef(false)

  const checkUpdate = async () => {
    if (lock.current || !IS_TAURI) return
    lock.current = true
    setBusy(true)
    setStatus('正在检查更新…')
    try {
      const next = await check({ timeout: 15000 })
      await update.current?.close()
      update.current = next
      setAvailable(next?.version ?? null)
      setStatus(next ? `发现 v${next.version}` : '已是最新版本')
    } catch {
      setStatus('检查失败，请重试')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!IS_TAURI) return
    void getVersion().then(setVersion).catch(() => {})
    void checkUpdate()
    return () => { void update.current?.close() }
  }, [])

  const install = async () => {
    if (lock.current || !update.current) return
    lock.current = true
    setBusy(true)
    let stage: UpdateStage = 'save'
    try {
      // 保存失败时禁止退出安装，避免丢失未完成练习。
      const snapshot = snapshotWorkspace()
      let received = 0
      let total = 0
      const next = update.current
      await runUpdate({
        save: () => saveWorkspace({ ...snapshot, activeSession: snapshot.activeSession ? { ...snapshot.activeSession, paused: true } : null }),
        pause: () => clockSession(true),
        download: async () => {
          stage = 'download'
          setStatus('正在下载更新…')
          await next.download(event => {
            if (event.event === 'Started') total = event.data.contentLength ?? 0
            if (event.event === 'Progress') {
              received += event.data.chunkLength
              setStatus(total ? `下载中 ${Math.min(100, Math.round(received / total * 100))}%` : `已下载 ${(received / 1048576).toFixed(1)} MB`)
            }
          }, { timeout: 60000 })
        },
        install: async () => { stage = 'install'; setStatus('校验完成，正在安装…'); await next.install() },
      })
    } catch (error) {
      setStatus(updateErrorMessage(error, stage))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <div className="app-update">
    <span>当前版本 v{version}</span>
    {IS_TAURI ? <>
      <ThemedButton className="app-update__button" disabled={busy} onClick={() => void (available ? install() : checkUpdate())}>
        {busy ? '请稍候…' : available ? `更新至 v${available}` : '检查更新'}
      </ThemedButton>
      <span className="app-update__status" role="status" aria-live="polite">{status}</span>
    </> : <span>网页版</span>}
  </div>
}
