import { useMemo, useState } from 'react'
import { useApp } from '../domain/store'
import { buildSession, newId } from '../domain/session'
import { masteryOf } from '../domain/stats'
import { questionAssetIds } from '../domain/content'
import { QuestionContent } from './QuestionContent'
import { ThemedButton } from './ThemedButton'
import type { Route } from '../App'
import { ChapterEditor } from './ChapterManager'

export function QuestionSearch({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { activeBank, workspace, startSession } = useApp()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [type, setType] = useState('')
  const [mastery, setMastery] = useState('')
  const [images, setImages] = useState(false)
  const [limit, setLimit] = useState(30)
  const [editing, setEditing] = useState<string | null>(null)
  const matches = useMemo(() => activeBank?.questions.filter(question => {
    const text = [question.stem, question.explanation, ...question.options.map(option => option.text), ...question.tags].join(' ').toLocaleLowerCase()
    return (!query.trim() || text.includes(query.trim().toLocaleLowerCase())) && (!category || question.category === category) &&
      (!type || question.type === type) && (!mastery || (mastery === 'new' ? !workspace.stats[question.id]?.attempts : masteryOf(workspace.stats[question.id]) >= 4)) &&
      (!images || questionAssetIds(question).length > 0)
  }) ?? [], [activeBank, workspace.stats, query, category, type, mastery, images])
  if (!activeBank) return null
  return <section className="panel question-search" aria-label="题库检索">
    <header className="panel__head"><h2 className="panel__title">题库检索</h2><span className="t-meta">{matches.length} 道</span></header>
    <div className="panel__body">
      <div className="filters">
        <label>搜索<input className="input" aria-label="搜索题目" value={query} onChange={event => { setQuery(event.target.value); setLimit(30) }} /></label>
        <label>章节<select className="select" value={category} onChange={event => setCategory(event.target.value)}><option value="">全部章节</option>{[...new Set(activeBank.questions.map(question => question.category))].map(name => <option key={name}>{name}</option>)}</select></label>
        <label>题型<select className="select" value={type} onChange={event => setType(event.target.value)}><option value="">全部题型</option><option value="single">单选</option><option value="multiple">多选</option><option value="judge">判断</option></select></label>
        <label>掌握度<select className="select" value={mastery} onChange={event => setMastery(event.target.value)}><option value="">全部掌握度</option><option value="new">未练习</option><option value="mastered">已掌握</option></select></label>
        <label><input type="checkbox" checked={images} onChange={event => setImages(event.target.checked)} />含图片</label>
      </div>
      <ThemedButton className="btn btn--primary" disabled={!matches.length} onClick={() => { startSession(buildSession(activeBank, { mode: 'random', category: null, count: matches.length }, matches, newId('s'))); onNavigate('practice') }}>练习检索结果</ThemedButton>
      {editing !== null ? <ChapterEditor key={editing} bank={activeBank} editor={{ kind: 'edit', category: editing }} onCancel={() => setEditing(null)} onSaved={() => setEditing(null)} /> : null}
      {matches.slice(0, limit).map(question => <details key={question.id} className="chapter-entry"><summary>{question.id} · {question.category} · {question.stem}</summary><QuestionContent blocks={question.stemBlocks} fallback={question.stem} />{question.options.map(option => <div key={option.key}><b>{option.key}. </b><QuestionContent blocks={option.blocks} fallback={option.text} /></div>)}<p>答案：{question.answer.join('、')}</p><QuestionContent blocks={question.explanationBlocks} fallback={question.explanation ?? ''} /><div className="filters"><ThemedButton className="btn btn--sm" onClick={() => { startSession(buildSession(activeBank, { mode: 'random', category: null, count: 1 }, [question], newId('s'))); onNavigate('practice') }}>练习这题</ThemedButton><ThemedButton className="btn btn--sm" onClick={() => setEditing(question.category)}>编辑所在章节</ThemedButton></div></details>)}
      {!matches.length ? <p role="status">没有匹配题目</p> : null}
      {matches.length > limit ? <ThemedButton className="btn" onClick={() => setLimit(limit + 30)}>加载更多</ThemedButton> : null}
    </div>
  </section>
}
