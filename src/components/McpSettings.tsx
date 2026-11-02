import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { IS_TAURI } from '../domain/shell'
import { CopyButton } from './bits'
import { CheckOne } from '@icon-park/react'

export function McpSettings() {
  const [config, setConfig] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (!IS_TAURI) return
    let active = true
    void invoke('get_mcp_config').then(value => {
      if (active) setConfig(JSON.stringify(value, null, 2))
    }).catch((reason: unknown) => { if (active) setError(String(reason)) })
    return () => { active = false }
  }, [])
  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Agent / MCP</h2>
        <p className="panel__hint">{IS_TAURI ? '本地 stdio · 无需 Node.js' : '桌面安装版提供内置 MCP'}</p>
      </header>
      <div className="panel__body">
        {error ? <p className="t-meta" role="alert">{error}</p> : null}
        {IS_TAURI && !config && !error ? <p className="t-meta" role="status">正在读取配置…</p> : null}
        {config ? <>
          <pre className="schema__code t-data" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{config}</pre>
          <div className="settings__actions">
            <CopyButton text={config} className="btn btn--sm">复制 MCP 配置</CopyButton>
            <button type="button" className="btn btn--sm" disabled={checking} onClick={() => {
              setChecking(true)
              setStatus('')
              void invoke<string>('check_mcp').then(setStatus).catch((reason: unknown) => setStatus(String(reason))).finally(() => setChecking(false))
            }}><CheckOne size={14} />{checking ? '检测中…' : '检测 MCP'}</button>
          </div>
          {status ? <p className="t-meta settings__note" role="status">{status}</p> : null}
        </> : null}
      </div>
    </section>
  )
}
