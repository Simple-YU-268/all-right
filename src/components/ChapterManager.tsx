import { useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { Download, Edit, Delete, Upload } from '@icon-park/react'
import type { Bank } from '../domain/types'
import { useApp } from '../domain/store'
import { readBankFile } from '../domain/parseBank'
import { questionAssetIds } from '../domain/content'
import { saveChapter as prepareChapter, type ChapterChange } from '../domain/chapters'
import { downloadJson } from '../domain/storage'
import { confirmAction } from '../domain/shell'

type EditorState = { kind: 'create' | 'edit' | 'import'; category: string | null }

export function ChapterManager({ bank }: { bank: Bank }) {
  const { deleteChapter } = useApp()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const chapters = new Map<string, number>()
  for (const question of bank.questions) chapters.set(question.category, (chapters.get(question.category) ?? 0) + 1)

  const openEditor = (next: EditorState) => {
    setNotice('')
    setError('')
    setEditor(next)
  }

  const remove = async (category: string, count: number) => {
    if (!await confirmAction(`删除题库「${bank.name}」中的章节「${category}」及其 ${count} 道题？该章的练习记录也会删除，其他章节保留。`)) return
    try {
      deleteChapter(bank.id, category)
      if (editor?.category === category) setEditor(null)
      setError('')
      setNotice(`已删除章节「${category}」。`)
    } catch (failure) {
      setError(String(failure instanceof Error ? failure.message : failure))
    }
  }

  return (
    <div className="chapter-manager">
      <div className="chapter-manager__head">
        <button type="button" className="btn btn--sm" onClick={() => openEditor({ kind: 'create', category: null })}>
          <Upload size={13} />导入章节
        </button>
        <span className="t-meta">只修改本题库选中的章节</span>
      </div>
      <details className="chapter-distribution">
        <summary>查看章节（{chapters.size}）</summary>
        <ul aria-label="章节分布">
          {[...chapters].map(([category, count]) => (
            <li className="chapter-row" key={category}>
              <span className="chapter-row__name">{category}</span>
              <span className="t-data">{count} 题</span>
              <span className="chapter-row__actions">
                <button type="button" className="btn btn--sm" onClick={() => openEditor({ kind: 'import', category })}>
                  <Upload size={13} />导入题目
                </button>
                <button type="button" className="btn btn--sm" onClick={() => openEditor({ kind: 'edit', category })}>
                  <Edit size={13} />编辑章节
                </button>
                <button type="button" className="btn btn--sm" aria-label={`导出章节「${category}」`}
                  onClick={() => downloadJson(`${bank.name}-${category}.json`, {
                    name: `${bank.name} · ${category}`, category,
                    questions: bank.questions.filter((question) => question.category === category),
                  })}>
                  <Download size={13} />导出
                </button>
                <button type="button" className="btn btn--sm btn--danger" onClick={() => void remove(category, count)}>
                  <Delete size={13} />删除章节
                </button>
              </span>
            </li>
          ))}
        </ul>
        {chapters.size === 0 ? <p className="t-meta">暂无章节，导入 JSON 后可自动分章。</p> : null}
      </details>
      {notice ? <p className="t-meta" role="status">{notice}</p> : null}
      {error ? <p className="chapter-editor__error" role="alert">{error}</p> : null}
      {editor ? (
        <ChapterEditor key={`${editor.kind}:${editor.category}`} bank={bank} editor={editor}
          onCancel={() => setEditor(null)} onSaved={(message) => {
            setEditor(null)
            setNotice(message)
          }} />
      ) : null}
    </div>
  )
}

function ChapterEditor({ bank, editor, onCancel, onSaved }: {
  bank: Bank; editor: EditorState; onCancel: () => void; onSaved: (name: string) => void
}) {
  /* 题库里已有的图片：章节编辑只认这些现成的资源，图片本身从题库包来。 */
  const knownAssets = useMemo(() => {
    const ids = new Set<string>()
    for (const question of bank.questions) {
      for (const id of questionAssetIds(question)) ids.add(id)
    }
    return Object.fromEntries([...ids].map((id) => [id, {}]))
  }, [bank])
  const { workspace, saveChapter, importChapters } = useApp()
  const formId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(editor.category ?? '')
  const [text, setText] = useState(editor.kind === 'edit' ? JSON.stringify({
    name: bank.name, questions: bank.questions.filter((question) => question.category === editor.category),
  }, null, 2) : '')
  const [source, setSource] = useState('')
  const [sources, setSources] = useState<string[] | null>(null)
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const parsed = useMemo(
    () => (text.trim() ? readBankFile(text, bank.name, { assets: knownAssets }) : null),
    [text, bank.name, knownAssets],
  )
  const sourceChapters = [...new Set(parsed?.valid.map((question) => question.category) ?? [])]
  const selectedSource = sourceChapters.includes(source) ? source : sourceChapters.length === 1 ? sourceChapters[0] : ''
  const batch = editor.kind === 'create' && sourceChapters.length > 1
  const selectedSources = batch ? sourceChapters.filter((category) => sources === null || sources.includes(category))
    : selectedSource ? [selectedSource] : []
  const selectedSet = new Set(selectedSources)
  const questions = parsed?.valid.filter((question) => selectedSet.has(question.category)) ?? []
  const existingCount = selectedSources.filter((category) => bank.questions.some((question) => question.category === category)).length
  const title = batch ? '批量导入章节' : editor.kind === 'create' ? '导入新章节' : editor.kind === 'edit' ? '编辑章节' : '导入章节题目'

  const readFile = async (file: File) => {
    try {
      const content = await file.text()
      const result = readBankFile(content, bank.name, { assets: knownAssets })
      const categories = [...new Set(result.valid.map((question) => question.category))]
      setText(content)
      setSource('')
      setSources(null)
      setError('')
      if (editor.kind === 'create' && categories.length === 1) setName(categories[0])
    } catch (failure) {
      setError(`无法读取章节文件：${String(failure)}`)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!parsed || parsed.issues.length || !questions.length) {
      setError('请提供有效的题目 JSON，并选择要导入的来源章节。存在错误时不会保存。')
      return
    }
    if (batch) {
      setBusy(true)
      try {
        importChapters({ bankId: bank.id, questions })
        onSaved(`已导入 ${selectedSources.length} 个章节，共 ${questions.length} 题。同名章节已追加，其他章节保持不变。`)
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : String(failure))
      } finally {
        setBusy(false)
      }
      return
    }
    const change: ChapterChange = {
      bankId: bank.id, category: editor.category, name,
      mode: editor.kind === 'create' ? 'create' : editor.kind === 'edit' ? 'replace' : mode,
      questions,
    }
    setBusy(true)
    try {
      const result = prepareChapter(workspace, change)
      if (result.invalidatedIds.size && !await confirmAction(
        `保存章节「${name.trim()}」将清理 ${result.invalidatedIds.size} 道被修改或移除题目的练习记录。未改动题目和其他章节的记录保留，是否保存？`,
      )) return
      saveChapter(change)
      onSaved(`已保存章节「${name.trim()}」。其他章节保持不变。`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="chapter-editor" aria-label={`${title}：${bank.name}`} onSubmit={(event) => void submit(event)}>
      <h3 className="panel__title">{title}{editor.category ? ` · ${editor.category}` : ''}</h3>
      <p className="t-meta">目标题库：{bank.name}。只保存所选章节，不会新建或覆盖整个题库。</p>
      {!batch ? <div className="field">
        <label className="field__label" htmlFor={`${formId}-name`}>章节名称</label>
        <input className="input" id={`${formId}-name`} value={name} maxLength={200} required
          readOnly={editor.kind === 'import'} onChange={(event) => setName(event.target.value)} />
      </div> : null}
      {editor.kind === 'import' ? (
        <fieldset className="chapter-editor__modes">
          <legend className="field__label">导入方式</legend>
          <label><input type="radio" name={`${formId}-mode`} checked={mode === 'append'} onChange={() => setMode('append')} /> 追加到该章</label>
          <label><input type="radio" name={`${formId}-mode`} checked={mode === 'replace'} onChange={() => setMode('replace')} /> 替换该章</label>
        </fieldset>
      ) : null}
      <div className="chapter-editor__actions">
        <button type="button" className="btn btn--sm" onClick={() => inputRef.current?.click()}>
          <Upload size={13} />选择章节 JSON 文件
        </button>
        <input ref={inputRef} type="file" className="sr-only" accept="application/json,.json" aria-label="章节 JSON 文件"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void readFile(file)
            event.target.value = ''
          }} />
      </div>
      <div className="field">
        <label className="field__label" htmlFor={`${formId}-json`}>章节题目 JSON</label>
        <textarea className="textarea chapter-editor__json t-data" id={`${formId}-json`} value={text} spellCheck={false}
          placeholder='粘贴题目数组，或 { "questions": [...] }。也可以选择 JSON 文件。'
          onChange={(event) => { setText(event.target.value); setError('') }} />
      </div>
      {batch ? (
        <fieldset className="chapter-editor__sources">
          <legend className="field__label">选择要导入的章节（可多选，默认全选）</legend>
          <div className="chapter-editor__actions">
            <button type="button" className="btn btn--sm" onClick={() => setSources([...sourceChapters])}>全选</button>
            <button type="button" className="btn btn--sm" onClick={() => setSources([])}>清空选择</button>
          </div>
          {sourceChapters.map((category) => (
            <label key={category}>
              <input type="checkbox" checked={selectedSet.has(category)} onChange={(event) => {
                setSources(event.target.checked ? [...selectedSources, category] : selectedSources.filter((entry) => entry !== category))
              }} /> {category}（{parsed?.valid.filter((question) => question.category === category).length} 题）
              {bank.questions.some((question) => question.category === category) ? ' · 追加到已有章' : ' · 新章节'}
            </label>
          ))}
        </fieldset>
      ) : sourceChapters.length > 1 ? (
        <fieldset className="chapter-editor__sources">
          <legend className="field__label">文件包含多个章节，只选择一个导入</legend>
          {sourceChapters.map((category) => (
            <label key={category}>
              <input type="radio" name={`${formId}-source`} checked={selectedSource === category} onChange={() => {
                setSource(category)
                if (editor.kind === 'create' && !name.trim()) setName(category)
              }} /> {category}（{parsed?.valid.filter((question) => question.category === category).length} 题）
            </label>
          ))}
        </fieldset>
      ) : null}
      {parsed ? <p className="t-meta">{batch
        ? `已选 ${selectedSources.length} / ${sourceChapters.length} 章 · 共 ${questions.length} 题；新增 ${selectedSources.length - existingCount} 章，追加 ${existingCount} 章`
        : selectedSource ? `来源章节：${selectedSource} · 已选 ${questions.length} 题` : '请选择来源章节'}
        {!batch && name.trim() ? ` → 保存到「${name.trim()}」` : ''}</p> : null}
      {parsed?.issues.length ? (
        <div className="chapter-editor__error" role="alert">
          <p>JSON 有 {parsed.issues.length} 处问题，修正后才能保存：</p>
          {parsed.issues.slice(0, 10).map((issue, index) => <p key={index}>
            {issue.index ? `第 ${issue.index} 题 · ` : ''}{issue.field}：{issue.message}
          </p>)}
        </div>
      ) : null}
      <p className="t-meta">{batch ? '按文件中的章节名称自动分章；同名章节追加题目，已有题目和记录保留。全部选中章节校验通过后一起导入。'
        : '题目统一归入上方章节名称。'}新导入的题号若与已有题目重复，会自动重新编号。
        编辑或替换时保留未改动题目的记录；修改题干、题型、选项、答案或移除题目会清理对应记录。仅改章名、解析、标签或难度会保留记录。</p>
      {error ? <p className="chapter-editor__error" role="alert">{error}</p> : null}
      <div className="chapter-editor__actions">
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy || (!batch && !name.trim()) || !questions.length || !!parsed?.issues.length}>
          保存章节
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={onCancel}>取消编辑</button>
      </div>
    </form>
  )
}
