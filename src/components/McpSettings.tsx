import { ThemedButton } from './ThemedButton'
import { useCallback, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { CheckOne, Download, Refresh } from '@icon-park/react'
import { IS_TAURI } from '../domain/shell'
import { readBankFile } from '../domain/parseBank'
import BANK_JSON_SCHEMA from '../domain/bankSchema.json'
import { downloadJson } from '../domain/storage'
import { useApp } from '../domain/store'
import type { Bank } from '../domain/types'
import { CopyButton } from './bits'
import { ChapterDistribution, PreviewIssues, PreviewStats } from './ImportPreview'

interface McpOutput {
  name: string
  bytes: number
  modifiedAt: number
}

export function McpSettings() {
  const { addBank } = useApp()
  const [config, setConfig] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState('')
  const [connection, setConnection] = useState<{ ok: boolean; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState('')
  const [outputs, setOutputs] = useState<McpOutput[]>([])
  const [selected, setSelected] = useState<{ name: string; parsed: ReturnType<typeof readBankFile> } | null>(null)

  const loadOutputs = useCallback(async () => {
    if (!IS_TAURI) return
    setLoading(true)
    try {
      setOutputs(await invoke<McpOutput[]>('list_mcp_outputs'))
      setError('')
    } catch (reason) {
      setError(String(reason))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!IS_TAURI) return
    let active = true
    void invoke('get_mcp_config').then(value => {
      if (active) setConfig(JSON.stringify(value, null, 2))
    }).catch((reason: unknown) => { if (active) setError(String(reason)) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    void loadOutputs()
  }, [loadOutputs])

  const openOutput = async (name: string) => {
    setOpening(name)
    setSelected(null)
    try {
      const text = await invoke<string>('read_mcp_output', { name })
      setSelected({ name, parsed: readBankFile(text, name.replace(/\.json$/i, '')) })
      setError('')
    } catch (reason) {
      setError(String(reason))
    } finally {
      setOpening('')
    }
  }

  const importSelected = () => {
    if (!selected?.parsed.valid.length) return
    const bank: Bank = {
      id: `bank-${Date.now().toString(36)}`,
      name: selected.parsed.name,
      importedAt: Date.now(),
      questions: selected.parsed.valid,
    }
    addBank(bank)
    setSelected(null)
    setStatus(`已导入题库「${bank.name}」，共 ${bank.questions.length} 题。`)
  }

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">Agent / MCP</h2>
        <p className="panel__hint">{IS_TAURI ? '本地 stdio · 无需 Node.js' : '桌面安装版提供内置 MCP'}</p>
      </header>
      <div className="panel__body mcp">
        {error ? <p className="t-meta" role="alert">{error}</p> : null}
        {IS_TAURI && !config && !error ? <p className="t-meta" role="status">正在读取配置…</p> : null}
        {config ? <>
          <div className="mcp__heading"><h3 className="t-label">连接配置</h3><span className="mcp__badge">本地 stdio</span></div>
          <div className="settings__actions">
            <CopyButton text={config} className="btn btn--sm">复制 MCP 配置</CopyButton>
            <ThemedButton type="button" className="btn btn--sm" disabled={checking} onClick={() => {
              setChecking(true)
              setConnection(null)
              void invoke<string>('check_mcp').then(text => setConnection({ ok: true, text })).catch((reason: unknown) => setConnection({ ok: false, text: String(reason) })).finally(() => setChecking(false))
            }}><CheckOne size={14} />{checking ? '检测中…' : '检测 MCP'}</ThemedButton>
            <ThemedButton
              type="button"
              className="btn btn--sm"
              onClick={() => downloadJson('allright-题库结构.json', BANK_JSON_SCHEMA)}
            >
              <Download size={13} strokeWidth={2} />
              下载 JSON Schema
            </ThemedButton>
          </div>
          {connection ? <p className={`mcp__feedback ${connection.ok ? 'mcp__feedback--success' : 'mcp__feedback--error'}`} role={connection.ok ? 'status' : 'alert'}>{connection.text}</p> : null}
          <details className="mcp__config"><summary>查看连接配置</summary><pre className="schema__code t-data">{config}</pre></details>
        </> : null}

        {IS_TAURI ? (
          <div className="mcp__outputs" aria-busy={loading}>
            <div className="mcp__heading">
              <h3 className="t-label">Agent 生成的题库 <span className="mcp__count">{outputs.length}</span></h3>
              <ThemedButton type="button" className="btn btn--sm mcp__refresh" disabled={loading} title="刷新题库列表" aria-label="刷新题库列表" onClick={() => void loadOutputs()}><Refresh size={14} /></ThemedButton>
            </div>
            {status ? <p className="mcp__feedback mcp__feedback--success" role="status">{status}</p> : null}
            {outputs.length === 0 ? (
              <p className="mcp__empty" role="status">{loading ? '正在读取题库…' : '暂无生成的题库'}</p>
            ) : (
              <ul className="filelist" aria-label="MCP 生成的题库">
                {outputs.map((file) => (
                  <li className={`filerow${selected?.name === file.name ? ' filerow--selected' : ''}`} key={file.name}>
                    <div>
                      <p className="filerow__name">{file.name}</p>
                      <p className="filerow__meta">
                        {Math.max(1, Math.round(file.bytes / 1024))} KB · {new Date(file.modifiedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                    <ThemedButton type="button" className="btn btn--sm" aria-pressed={selected?.name === file.name} disabled={Boolean(opening)} onClick={() => void openOutput(file.name)}>{opening === file.name ? '读取中…' : '查看'}</ThemedButton>
                  </li>
                ))}
              </ul>
            )}
            {selected ? (
              <div className="mcp__preview">
                <header className="preview__head">
                  <p className="preview__title">{selected.name}</p>
                  <span className="chip chip--blue">{selected.parsed.name}</span>
                </header>
                <PreviewStats parsed={selected.parsed} />
                {selected.parsed.valid.length > 0 ? <ChapterDistribution questions={selected.parsed.valid} /> : null}
                <PreviewIssues parsed={selected.parsed} />
                <div className="preview__actions">
                  <ThemedButton
                    type="button"
                    className="btn btn--primary"
                    onClick={importSelected}
                    disabled={!selected.parsed.valid.length}
                  >
                    导入 {selected.parsed.valid.length} 题
                  </ThemedButton>
                  <ThemedButton type="button" className="btn btn--ghost" onClick={() => setSelected(null)}>取消</ThemedButton>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
