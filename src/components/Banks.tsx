import { useRef, useState } from 'react'
import { ArrowRight, Robot as Bot, Download, FileCode as FileJson, Delete as Trash2, Upload } from '@icon-park/react'
import { useApp } from '../domain/store'
import { readBankFile, type ParsedBank } from '../domain/parseBank'
import { computeDashboard, formatPercent } from '../domain/stats'
import { downloadBinary, downloadJson } from '../domain/storage'
import { AI_PROMPT, TEMPLATE } from '../domain/bankTemplate'
import { buildBankExport, buildWorkspaceBackup } from '../domain/backup'
import { looksLikePack, readPack } from '../domain/pack'
import { pruneAssetsExcept, referencedAssetIds, saveAsset } from '../domain/assets'
import type { AssetMeta, Bank } from '../domain/types'
import type { Route } from '../App'
import { CopyButton, EmptyState } from './bits'
import { confirmAction } from '../domain/shell'
import { ChapterGuide } from './ChapterGuide'
import { ChapterManager } from './ChapterManager'
import { ChapterDistribution, PreviewIssues, PreviewStats } from './ImportPreview'

interface PendingImport {
  parsed: ParsedBank
  /** 包里带的图片本体，落盘之后才真正进题库。 */
  files: Map<string, Uint8Array>
  assets: Record<string, AssetMeta>
}

export function Banks({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { workspace, activeBank, addBank, removeBank, setActiveBank } = useApp()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const acceptFile = async (file: File) => {
    setError(null)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (looksLikePack(bytes)) {
        const pack = readPack(bytes)
        if (pack.kind !== 'bank') {
          setError('这是一个工作区备份包，请到「设置」页恢复。')
          return
        }
        setPending({ parsed: pack.parsed, files: pack.files, assets: pack.assets })
        return
      }
      const text = new TextDecoder('utf-8').decode(bytes)
      setPending({
        parsed: readBankFile(text, file.name.replace(/\.(json|allright)$/i, '')),
        files: new Map(),
        assets: {},
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const loadSample = async () => {
    setError(null)
    try {
      /* 跟着构建的 base 走：挂在子目录时也能找到示例题库 */
      const res = await fetch(`${import.meta.env.BASE_URL}sample-bank.json`)
      const text = await res.text()
      setPending({ parsed: readBankFile(text, '示例题库'), files: new Map(), assets: {} })
    } catch {
      setError('读取示例题库失败，请确认 dev server 正在运行。')
    }
  }

  const loadImageSample = async () => {
    setError(null)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}sample-image-bank.allright`)
      if (!res.ok) throw new Error('找不到示例图片题库')
      const blob = await res.blob()
      const file = new File([blob], 'sample-image-bank.allright', { type: 'application/octet-stream' })
      await acceptFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const commit = async () => {
    if (!pending || !pending.parsed.valid.length || busy) return
    setBusy(true)
    try {
      /* 图片先落盘：存不下就别导题库，免得出现「题库在、图没了」。 */
      const assets: Record<string, AssetMeta> = {}
      for (const [id, bytes] of pending.files) {
        const stored = await saveAsset(bytes)
        assets[id] = { mime: stored.mime, bytes: stored.bytes }
      }
      const bank: Bank = {
        id: `bank-${Date.now().toString(36)}`,
        name: pending.parsed.name,
        importedAt: Date.now(),
        questions: pending.parsed.valid,
      }
      addBank(bank, { ...pending.assets, ...assets })
      setPending(null)
      setPasted('')
      setPasteOpen(false)
      onNavigate('dashboard')
    } catch (err) {
      /* 存到一半失败了：把已经落盘的图片清掉，别留下没人引用的孤儿。 */
      void pruneAssetsExcept(referencedAssetIds(workspace))
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">题库</p>
          <p className="topbar__sub">{workspace.banks.length} 个题库 · 数据保存在本机</p>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => {
              void buildWorkspaceBackup(workspace).then((backup) => {
                if (backup.isPack) downloadBinary(backup.filename, backup.bytes)
                else downloadJson(backup.filename, JSON.parse(new TextDecoder().decode(backup.bytes)))
              }).catch((error: unknown) => setError(`导出失败：${String(error)}`))
            }}
          >
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
                    或直接选择文件。每题的 category 是章节名；导入前会预览题量、章节与题型分布，有问题会逐条指出是哪一题。
                  </p>
                  <p className="dropzone__hint">
                    带图片的题库用 <code className="t-data">.allright</code> 题库包（一个 zip，里面是 bank.json 加 assets/），
                    拖进来一样能导入。
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
                    <button type="button" className="btn" onClick={() => void loadImageSample()}>
                      载入图片题示例
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
                    accept="application/json,.json,.allright,.zip"
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
                        onClick={() => setPending({
                          parsed: readBankFile(pasted, '粘贴的题库'),
                          files: new Map(),
                          assets: {},
                        })}
                        disabled={!pasted.trim()}
                      >
                        解析这段 JSON
                      </button>
                    </div>
                  </div>
                ) : null}

                {error ? (
                  <p className="t-meta" role="alert" style={{ marginTop: 'var(--s3)', color: 'var(--wrong)' }}>
                    {error}
                  </p>
                ) : null}
              </div>
            </section>

            {pending ? (
              <section className="preview">
                <header className="preview__head">
                  <p className="preview__title">导入预览</p>
                  <span className="chip chip--blue">{pending.parsed.name}</span>
                </header>
                <PreviewStats parsed={pending.parsed} imageCount={pending.files.size} />

                {pending.parsed.valid.length > 0 ? <ChapterDistribution questions={pending.parsed.valid} /> : null}

                <PreviewIssues parsed={pending.parsed} />

                <div className="preview__actions">
                  <button
                    type="button"
                    className="btn btn--primary"
                    onClick={() => void commit()}
                    disabled={!pending.parsed.valid.length || busy}
                  >
                    导入 {pending.parsed.valid.length} 题
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
                    取消
                  </button>
                  {pending.parsed.issues.length > 0 && pending.parsed.valid.length > 0 ? (
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
                            {new Set(bank.questions.map((q) => q.category)).size} 个章节 · 导入于{' '}
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
                            aria-label={`导出题库「${bank.name}」`}
                            onClick={() => {
                              void buildBankExport(bank).then((exported) => {
                                if (exported.isPack) downloadBinary(exported.filename, exported.bytes)
                                else downloadJson(exported.filename, JSON.parse(new TextDecoder().decode(exported.bytes)))
                              }).catch((error: unknown) => setError(`导出失败：${String(error)}`))
                            }}
                          >
                            <Download size={13} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--danger"
                            aria-label={`删除题库「${bank.name}」`}
                            onClick={async () => {
                              if (await confirmAction(`删除题库「${bank.name}」？该题库的练习记录也会一并删除。`)) {
                                removeBank(bank.id)
                              }
                            }}
                          >
                            <Trash2 size={13} strokeWidth={2} />
                          </button>
                        </span>
                        <ChapterManager bank={bank} />
                      </div>
                    )
                  })
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel__body">
                <ChapterGuide />
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
