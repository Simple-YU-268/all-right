import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { IS_TAURI } from '../domain/shell'
import { CopyButton } from './bits'

export function McpSettings() {
  const [config, setConfig] = useState('')
  const [error, setError] = useState('')
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
          <div className="settings__actions"><CopyButton text={config} className="btn btn--sm">复制 MCP 配置</CopyButton></div>
        </> : null}
      </div>
    </section>
  )
}
