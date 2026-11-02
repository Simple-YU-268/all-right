import { useMemo, useRef, useState } from 'react'
import { ArrowRight, Robot as Bot, Download, FileCode as FileJson, Delete as Trash2, Upload } from '@icon-park/react'
import { useApp } from '../domain/store'
import { readBankFile, type ParsedBank } from '../domain/parseBank'
import { computeDashboard, formatPercent } from '../domain/stats'
import { downloadJson } from '../domain/storage'
import { AI_PROMPT, TEMPLATE } from '../domain/bankTemplate'
import type { Bank } from '../domain/types'
import type { Route } from '../App'
import { CopyButton, EmptyState } from './bits'
import { confirmAction } from '../domain/shell'

export function Banks({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { workspace, activeBank, addBank, removeBank, setActiveBank } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedBank | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)

  const acceptFile = async (file: File) => {
    setError(null)
    const text = await file.text()
    const parsed = readBankFile(text, file.name.replace(/\.json$/i, ''))
    if (!parsed.valid.length && parsed.issues.length) {
      setPending(parsed)
      return
    }
    setPending(parsed)
  }

  const loadSample = async () => {
    setError(null)
    try {
      /* 跟着构建的 base 走：挂在子目录时也能找到示例题库 */
      const res = await fetch(`${import.meta.env.BASE_URL}sample-bank.json`)
      const text = await res.text()
      setPending(readBankFile(text, '示例题库'))
    } catch {
      setError('读取示例题库失败，请确认 dev server 正在运行。')
    }
  }

  const commit = () => {
    if (!pending || !pending.valid.length) return
    const bank: Bank = {
      id: `bank-${Date.now().toString(36)}`,
      name: pending.name,
      importedAt: Date.now(),
      questions: pending.valid,
    }
    addBank(bank)
    setPending(null)
    setPasted('')
    setPasteOpen(false)
    onNavigate('dashboard')
  }

  const parsedStats = useMemo(() => {
    if (!pending) return null
    const categories = new Set(pending.valid.map((q) => q.category)).size
    const types = { single: 0, multiple: 0, judge: 0 }
    for (const q of pending.valid) types[q.type] += 1
    return { categories, types, total: pending.valid.length }
  }, [pending])

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">题库</p>
          <p className="topbar__sub">{workspace.banks.length} 个题库 · 数据保存在本机</p>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn btn--sm" onClick={() => downloadJson('allright-工作区备份.json', workspace)}>
            <Download size={14} strokeWidth={2} />
            导出备份
          </button>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="banks">
            <section className="panel">
              <header className="panel__head">
                <h2 className="panel__title">导入 JSON 题库</h2>
                <p className="panel__hint">题库结构见下方说明，支持多种字段写法</p>
              </header>
              <div className="panel__body">
                <div
                  className={dragOver ? 'dropzone dropzone--over' : 'dropzone'}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files?.[0]
                    if (file) void acceptFile(file)
                  }}
                >
                  <FileJson size={22} strokeWidth={1.6} aria-hidden="true" style={{ color: 'var(--ink-400)' }} />
                  <p className="dropzone__title">把题库 JSON 文件拖到这里</p>
                  <p className="dropzone__hint">
                    或直接选择文件。导入前会先预览题量、分类与题型分布，有问题会逐条指出是哪一题。
                  </p>
                  <div className="dropzone__actions">
                    <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()}>
                      <Upload size={14} strokeWidth={2} />
                      选择 JSON 文件
                    </button>
                    <button type="button" className="btn" onClick={() => setPasteOpen((v) => !v)}>
                      {pasteOpen ? '收起' : '粘贴 JSON'}
                    </button>
                    <button type="button" className="btn" onClick={() => void loadSample()}>
                      载入示例题库
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => downloadJson('题库模板.json', TEMPLATE)}
                    >
                      <Download size={14} strokeWidth={2} />
                      下载模板
                    </button>
                  </div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void acceptFile(file)
                      e.target.value = ''
                    }}
                  />
                </div>

                {pasteOpen ? (
                  <div className="field" style={{ marginTop: 'var(--s4)' }}>
                    <label className="field__label" htmlFor="paste">
                      把题库 JSON 贴在这里
                    </label>
                    <textarea
                      id="paste"
                      className="textarea"
                      placeholder='{ "name": "我的题库", "questions": [ ... ] }'
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                    />
                    <div>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setPending(readBankFile(pasted, '粘贴的题库'))}
                        disabled={!pasted.trim()}
                      >
                        解析这段 JSON
                      </button>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="t-meta" style={{ marginTop: 'var(--s3)', color: 'var(--wrong)' }}>
                    {error}
                  </p>
                ) : null}
              </div>
            </section>

            {pending ? (
              <section className="preview">
                <header className="preview__head">
                  <p className="preview__title">导入预览</p>
                  <span className="chip chip--blue">{pending.name}</span>
                </header>
                {parsedStats ? (
                  <div className="preview__stats">
                    <div className="preview__stat">
                      <span className="t-label">可导入题目</span>
                      <b>{parsedStats.total}</b>
                    </div>
                    <div className="preview__stat">
                      <span className="t-label">分类数</span>
                      <b>{parsedStats.categories}</b>
                    </div>
                    <div className="preview__stat">
                      <span className="t-label">单选</span>
                      <b>{parsedStats.types.single}</b>
                    </div>
                    <div className="preview__stat">
                      <span className="t-label">多选</span>
                      <b>{parsedStats.types.multiple}</b>
                    </div>
                    <div className="preview__stat">
                      <span className="t-label">判断</span>
                      <b>{parsedStats.types.judge}</b>
                    </div>
                  </div>
                ) : null}

                {pending.issues.length > 0 ? (
                  <div className="issues">
                    <p className="t-label" style={{ color: 'var(--wrong)', marginBottom: 'var(--s2)' }}>
                      {pending.issues.length} 处需要确认
                    </p>
                    {pending.issues.slice(0, 40).map((issue, i) => (
                      <p className="issue" key={`${issue.index}-${i}`}>
                        <span className="issue__where">{issue.index ? `第 ${issue.index} 题` : '文件'}</span>
                        <span>
                          {issue.field}：{issue.message}
                        </span>
                      </p>
                    ))}
                    {pending.issues.length > 40 ? (
                      <p className="issue">还有 {pending.issues.length - 40} 处未显示</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="preview__actions">
                  <button type="button" className="btn btn--primary" onClick={commit} disabled={!pending.valid.length}>
                    导入 {pending.valid.length} 题
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                    取消
                  </button>
                  {pending.issues.length > 0 && pending.valid.length > 0 ? (
                    <span className="t-meta" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                      有问题的题目会被跳过，其余照常导入
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="panel">
              <header className="panel__head">
                <h2 className="panel__title">我的题库</h2>
              </header>
              <div className="panel__body panel__body--flush">
                {workspace.banks.length === 0 ? (
                  <EmptyState title="还没有题库" text="导入一份 JSON 文件就可以开始刷题了。也可以先载入示例题库，看看完整流程。" />
                ) : (
                  workspace.banks.map((bank) => {
                    const bankStats = computeDashboard(bank, workspace)
                    const current = bank.id === activeBank?.id
                    return (
                      <div className={current ? 'bankrow bankrow--current' : 'bankrow'} key={bank.id}>
                        <div>
                          <p className="bankrow__name">{bank.name}</p>
                          <p className="bankrow__meta">
                            {bank.questions.length} 题 ·{' '}
                            {new Set(bank.questions.map((q) => q.category)).size} 个分类 · 导入于{' '}
                            {new Date(bank.importedAt).toLocaleDateString('zh-CN')}
                          </p>
                        </div>
                        <span className="bankrow__num">{bankStats.attemptedQuestions} 已练</span>
                        <span className="bankrow__num">{formatPercent(bankStats.overallAccuracy)}</span>
                        <span className="bankrow__num">{bankStats.wrongBookCount} 错题</span>
                        <span className="bankrow__actions">
                          {current ? (
                            <span className="chip chip--blue">当前</span>
                          ) : (
                            <button type="button" className="btn btn--sm" onClick={() => setActiveBank(bank.id)}>
                              切到
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => downloadJson(`${bank.name}.json`, { name: bank.name, questions: bank.questions })}
                          >
                            <Download size={13} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--danger"
                            onClick={async () => {
                              if (await confirmAction(`删除题库「${bank.name}」？该题库的练习记录也会一并删除。`)) {
                                removeBank(bank.id)
                              }
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            <section className="panel">
              <header className="panel__head">
                <h2 className="panel__title">让 AI 助手帮你转译题库</h2>
                <p className="panel__hint">什么格式的题库都能转成这里能读的样子</p>
              </header>
              <div className="panel__body">
                <div className="schema">
                  <pre className="schema__code schema__code--prompt t-data">{AI_PROMPT}</pre>
                  <div className="settings__side">
                    <p className="t-meta">
                      把这段提示词连同你的题库文件一起发给你自己的 AI 助手，它会按这个软件的格式吐回一个
                      <code className="t-data">.json</code> 文件。提示词里已经写好了模板和转换规则。
                    </p>
                    <div className="settings__actions">
                      <CopyButton text={AI_PROMPT} className="btn btn--primary btn--sm">
                        复制提示词
                      </CopyButton>
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => onNavigate('settings')}>
                        查看 JSON 模板
                        <ArrowRight size={13} strokeWidth={2} />
                      </button>
                    </div>
                    <p className="t-meta settings__note">
                      <Bot size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                      助手转出来的文件，直接拖到上面的框里就行；导入前会先给你预览。
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}

