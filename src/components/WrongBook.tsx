import { useMemo, useState } from 'react'
import { Check, Time as Clock, Refresh as RefreshCw, CloseSmall as X } from '@icon-park/react'
import { useApp } from '../domain/store'
import { collectWrongBook, formatPercent } from '../domain/stats'
import { buildSession, newId } from '../domain/session'
import type { Route } from '../App'
import { EmptyState, MasteryMark } from './bits'
import { QuestionContent } from './QuestionContent'

type SortKey = 'wrong' | 'recent' | 'category'

const SORTS = [
  { value: 'wrong' as SortKey, label: '错得最多' },
  { value: 'recent' as SortKey, label: '最近答错' },
  { value: 'category' as SortKey, label: '按分类' },
]

export function WrongBook({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { workspace, activeBank, startSession, removeFromWrongBook } = useApp()
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<SortKey>('wrong')

  const entries = useMemo(
    () => (activeBank ? collectWrongBook(activeBank, workspace) : []),
    [activeBank, workspace],
  )
  const categories = useMemo(() => [...new Set(entries.map((e) => e.question.category))], [entries])

  const shown = useMemo(() => {
    const filtered = category ? entries.filter((e) => e.question.category === category) : entries
    const sorted = [...filtered]
    if (sort === 'wrong') sorted.sort((a, b) => b.stat.wrongCount - a.stat.wrongCount || b.stat.lastAt - a.stat.lastAt)
    if (sort === 'recent') sorted.sort((a, b) => b.stat.lastAt - a.stat.lastAt)
    if (sort === 'category') sorted.sort((a, b) => a.question.category.localeCompare(b.question.category, 'zh-Hans-CN'))
    return sorted
  }, [entries, category, sort])

  const beginAll = () => {
    if (!activeBank || !shown.length) return
    const session = buildSession(
      activeBank,
      { mode: 'wrong', category: null, count: shown.length },
      shown.map((e) => e.question),
      newId('s'),
    )
    startSession(session)
    onNavigate('practice')
  }

  const beginOne = (questionId: string) => {
    if (!activeBank) return
    const question = activeBank.questions.find((q) => q.id === questionId)
    if (!question) return
    const session = buildSession(
      activeBank,
      { mode: 'wrong', category: null, count: 1 },
      [question],
      newId('s'),
    )
    startSession(session)
    onNavigate('practice')
  }

  if (!activeBank) {
    return (
      <>
        <header className="topbar">
          <div className="topbar__heading">
            <p className="topbar__title">错题本</p>
          </div>
        </header>
        <div className="content">
          <div className="content__inner">
            <div className="panel">
              <EmptyState title="还没有题库" text="导入题库并练几道题，答错的题会自动收进这里。">
                <button type="button" className="btn btn--primary" onClick={() => onNavigate('banks')}>
                  去导入题库
                </button>
              </EmptyState>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">错题本</p>
          <p className="topbar__sub">
            {entries.length ? `${entries.length} 道待复习` : '暂无待复习的题'}
          </p>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn btn--primary" onClick={beginAll} disabled={!shown.length}>
            <RefreshCw size={14} strokeWidth={2} />
            重刷{shown.length ? ` ${shown.length} 题` : ''}
          </button>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="pagehead">
            <div>
              <h1 className="pagehead__title">把不熟的题做熟</h1>
              <p className="pagehead__sub">
                答错一次就进来，答对一次就出去。也可以按分类挑着刷。
              </p>
            </div>
          </div>

          {entries.length > 0 ? (
            <div className="filters">
              <div className="filters__field">
                <label className="filters__label" htmlFor="wrong-cat">
                  分类
                </label>
                <select
                  id="wrong-cat"
                  className="select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">全部分类</option>
                  {categories.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="filters__field">
                <label className="filters__label" htmlFor="wrong-sort">
                  排序
                </label>
                <select
                  id="wrong-sort"
                  className="select"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="t-meta">共 {shown.length} 道</span>
            </div>
          ) : null}

          <section className="panel">
            <div className="panel__body panel__body--flush">
              {shown.length === 0 ? (
                <EmptyState
                  title={entries.length === 0 ? '错题本是空的' : '这个分类下没有错题'}
                  text={
                    entries.length === 0
                      ? '答错的题会自动收进这里，并在你答对一次后移出。'
                      : '换个分类看看，或者回到全部错题。'
                  }
                >
                  {entries.length === 0 ? (
                    <button type="button" className="btn btn--primary" onClick={() => onNavigate('practice')}>
                      去练几道题
                    </button>
                  ) : (
                    <button type="button" className="btn" onClick={() => setCategory('')}>
                      看全部错题
                    </button>
                  )}
                </EmptyState>
              ) : (
                <div className="wronglist">
                  {shown.map((entry) => {
                    const last = entry.stat
                    const rate = last.attempts ? last.correctCount / last.attempts : 0
                    return (
                      <article className="wrongrow" key={entry.question.id}>
                        <span className="wrongrow__mark" aria-hidden="true">
                          <X size={13} strokeWidth={2.4} />
                        </span>
                        <div className="wrongrow__body">
                          <QuestionContent
                            blocks={entry.question.stemBlocks}
                            fallback={entry.question.stem}
                            className="wrongrow__stem"
                          />
                          <p className="wrongrow__meta">
                            <span className="chip chip--wrong">错 {last.wrongCount} 次</span>
                            <span className="chip">正确 {entry.question.answer.join('、')}</span>
                            <span>{entry.question.category}</span>
                            <span>
                              <Clock size={11} strokeWidth={2} style={{ verticalAlign: '-1px', marginRight: 4 }} />
                              {new Date(last.lastAt).toLocaleDateString('zh-CN')}
                            </span>
                            <span>正确率 {formatPercent(rate)}</span>
                            <MasteryMark mastery={entry.mastery} />
                          </p>
                          {entry.question.explanation ? (
                            <p className="explain__body" style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-sm)' }}>
                              {entry.question.explanation}
                            </p>
                          ) : null}
                        </div>
                        <div className="wrongrow__actions">
                          <button type="button" className="btn btn--sm" onClick={() => beginOne(entry.question.id)}>
                            重刷这题
                          </button>
                          <button
                            type="button"
                            className="btn btn--sm btn--ghost"
                            onClick={() => removeFromWrongBook(entry.question.id)}
                          >
                            <Check size={13} strokeWidth={2} />
                            移出
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
