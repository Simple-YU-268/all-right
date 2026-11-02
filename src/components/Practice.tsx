import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, ChevronLeft, CircleHelp, Clock, X } from 'lucide-react'
import { useApp } from '../domain/store'
import { collectWrongBook, formatDuration, formatPercent } from '../domain/stats'
import { buildSession, isAnswerCorrect, newId } from '../domain/session'
import type { Question, SessionMode } from '../domain/types'
import type { Route } from '../App'
import { EmptyState, MasteryMark, Segmented } from './bits'
import { masteryOf } from '../domain/stats'

const COUNTS = [
  { value: 10, label: '10 题' },
  { value: 20, label: '20 题' },
  { value: 50, label: '50 题' },
  { value: 0, label: '全部' },
]

const MODE_LABEL: Record<SessionMode, string> = {
  random: '随机练习',
  category: '分类练习',
  wrong: '错题重刷',
}

export interface PracticeSummary {
  total: number
  correct: number
  wrong: number
  elapsedMs: number
  mode: SessionMode
  category: string | null
  wrongQuestions: { question: Question; chosen: string[] }[]
}

export function Practice({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { session, activeBank, workspace, updateSession, endSession, recordAttempt } = useApp()
  const [selected, setSelected] = useState<string[]>([])
  const [summary, setSummary] = useState<PracticeSummary | null>(null)

  const questions = useMemo(() => {
    if (!session || !activeBank) return []
    const byId = new Map(activeBank.questions.map((q) => [q.id, q]))
    return session.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q)
  }, [session, activeBank])

  const current = questions[session?.index ?? 0]
  const revealed = current ? !!session?.answers[current.id] : false

  useEffect(() => {
    setSelected([])
  }, [session?.index, session?.id])

  if (summary) {
    return <Summary summary={summary} onNavigate={onNavigate} />
  }

  if (!session || !activeBank || !current) {
    return <PracticeStart onNavigate={onNavigate} />
  }

  const answered = session.answers[current.id]
  const stat = workspace.stats[current.id]
  const mastery = masteryOf(stat)
  const answeredCount = Object.keys(session.answers).length
  const correctCount = Object.values(session.answers).filter((a) => a.correct).length
  const elapsed = Date.now() - session.startedAt

  const toggle = (key: string) => {
    if (revealed) return
    if (current.type === 'multiple') {
      setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
    } else {
      setSelected([key])
    }
  }

  const submit = () => {
    if (!selected.length || revealed) return
    const correct = isAnswerCorrect(current, selected)
    const elapsedMs = Date.now() - session.questionStartedAt
    recordAttempt({
      id: newId('a'),
      bankId: session.bankId,
      questionId: current.id,
      chosen: selected,
      correct,
      at: Date.now(),
      elapsedMs,
    })
    updateSession({
      ...session,
      answers: { ...session.answers, [current.id]: { chosen: selected, correct, elapsedMs } },
    })
  }

  const advance = () => {
    const isLast = session.index + 1 >= questions.length
    if (isLast) {
      const wrongQuestions = questions
        .filter((q) => session.answers[q.id] && !session.answers[q.id].correct)
        .map((q) => ({ question: q, chosen: session.answers[q.id].chosen }))
      setSummary({
        total: questions.length,
        correct: correctCount,
        wrong: questions.length - correctCount,
        elapsedMs: elapsed,
        mode: session.mode,
        category: session.category,
        wrongQuestions,
      })
      endSession()
      return
    }
    updateSession({ ...session, index: session.index + 1, questionStartedAt: Date.now() })
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">{MODE_LABEL[session.mode]}</p>
          <p className="topbar__sub">
            {session.category ?? activeBank.name}
          </p>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={14} strokeWidth={2} />
            返回看板
          </button>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="practice">
            <div className="practice__top">
              <p className="practice__counter">
                第 {session.index + 1} / {questions.length} 题
              </p>
              <div className="practice__stats">
                <span className="practice__stat">
                  已答 <b>{answeredCount}</b>
                </span>
                <span className="practice__stat">
                  答对 <b>{correctCount}</b>
                </span>
                <span className="practice__stat">
                  用时 <b>{formatDuration(elapsed)}</b>
                </span>
              </div>
            </div>

            <div className="dotrail" role="img" aria-label={`共 ${questions.length} 题，已答 ${answeredCount} 题`}>
              {questions.map((q, i) => {
                const res = session.answers[q.id]
                const cls = res
                  ? res.correct
                    ? 'dotrail__dot dotrail__dot--right'
                    : 'dotrail__dot dotrail__dot--wrong'
                  : i === session.index
                    ? 'dotrail__dot dotrail__dot--current'
                    : 'dotrail__dot'
                return <span key={q.id} className={cls} />
              })}
            </div>

            <div className="practice__meta">
              <span className="chip chip--blue">{current.category}</span>
              <MasteryMark mastery={mastery} />
              {current.type === 'multiple' ? <span className="chip">多选</span> : null}
            </div>

            <p className="t-stem practice__stem">{current.stem}</p>

            <div className="options" role="group" aria-label="选项">
              {current.options.map((opt) => {
                const isChosen = selected.includes(opt.key)
                const isAnswer = current.answer.includes(opt.key)
                let cls = 'option'
                if (revealed) {
                  if (isAnswer) cls += ' option--right'
                  else if (isChosen) cls += ' option--wrong'
                  else cls += ' option--muted'
                } else if (isChosen) {
                  cls += ' option--selected'
                }
                /* 揭晓之后才需要标出「这是你划的那一条」，和老师批的对错分开记 */
                if (revealed && isChosen) cls += ' option--picked'
                return (
                  <button
                    type="button"
                    key={opt.key}
                    className={cls}
                    onClick={() => toggle(opt.key)}
                    disabled={revealed}
                    aria-pressed={isChosen}
                  >
                    <span className="option__key" aria-hidden="true">
                      {opt.key}
                    </span>
                    <span className="option__text">{opt.text}</span>
                    {revealed && isAnswer ? (
                      <Check className="option__mark" size={17} strokeWidth={2.6} aria-hidden="true" />
                    ) : null}
                    {revealed && !isAnswer && isChosen ? (
                      <X className="option__mark" size={17} strokeWidth={2.6} aria-hidden="true" />
                    ) : null}
                  </button>
                )
              })}
            </div>

            {revealed ? (
              <p className="optionkey">
                <span className="optionkey__item">
                  <span className="optionkey__rule optionkey__rule--picked" aria-hidden="true" />
                  你选的
                </span>
                <span className="optionkey__item">
                  <Check className="optionkey__mark optionkey__mark--right" size={13} strokeWidth={2.6} aria-hidden="true" />
                  正确答案
                </span>
                <span className="optionkey__item">
                  <X className="optionkey__mark optionkey__mark--wrong" size={13} strokeWidth={2.6} aria-hidden="true" />
                  选错了
                </span>
              </p>
            ) : null}

            {revealed && answered ? (
              <>
                <div className={answered.correct ? 'result result--right' : 'result result--wrong'}>
                  <span className={answered.correct ? 'result__mark result__mark--right' : 'result__mark result__mark--wrong'} aria-hidden="true">
                    {answered.correct ? <Check size={16} strokeWidth={2.6} /> : <X size={16} strokeWidth={2.6} />}
                  </span>
                  <span className="result__title">{answered.correct ? '答对了' : '答错了'}</span>
                  {!answered.correct ? (
                    <span className="result__detail">
                      {current.type === 'judge' ? '你应该选' : '正确答案'}{' '}
                      <b className="t-data">{current.answer.join('、')}</b>，已收进错题本
                    </span>
                  ) : (
                    <span className="result__detail">掌握度又进了一级</span>
                  )}
                </div>
                {current.explanation ? (
                  <div className="explain">
                    <p className="explain__label">解析</p>
                    <p className="explain__body">{current.explanation}</p>
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="practice__actions">
              {revealed ? (
                <button type="button" className="btn btn--primary btn--lg" onClick={advance}>
                  {session.index + 1 >= questions.length ? '看本次结算' : '下一题'}
                  <ArrowRight size={16} strokeWidth={2} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={submit}
                  disabled={!selected.length}
                >
                  确认答案
                </button>
              )}
              {!revealed ? (
                <span className="t-meta">
                  {current.type === 'multiple' ? '可多选，选完再确认' : '选一个选项'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Summary({ summary, onNavigate }: { summary: PracticeSummary; onNavigate: (route: Route) => void }) {
  const { activeBank, workspace, startSession } = useApp()
  const accuracy = summary.total ? summary.correct / summary.total : null

  const repeat = () => {
    if (!activeBank) return
    const pool =
      summary.mode === 'wrong'
        ? collectWrongBook(activeBank, workspace).map((entry) => entry.question)
        : activeBank.questions
    if (!pool.length) return
    const session = buildSession(
      activeBank,
      { mode: summary.mode, category: summary.category, count: pool.length },
      pool,
      newId('s'),
    )
    startSession(session)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">本次结算</p>
          <p className="topbar__sub">
            {MODE_LABEL[summary.mode]}
            {summary.category ? ` · ${summary.category}` : ''}
          </p>
        </div>
        <div className="topbar__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={14} strokeWidth={2} />
            返回看板
          </button>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="practice">
            <div className="summary summary--flip">
              <div className="summary__body">
                <p className="t-label">正确率</p>
                <p className="summary__score">{formatPercent(accuracy)}</p>
                <p className="summary__label">
                  {summary.mode === 'wrong'
                    ? `重刷了 ${summary.total} 道错题`
                    : `练了 ${summary.total} 题`}
                </p>

                <div className="summary__grid">
                  <div className="summary__cell">
                    <p className="t-label">答对</p>
                    <p className="summary__value">{summary.correct}</p>
                  </div>
                  <div className="summary__cell">
                    <p className="t-label">答错</p>
                    <p className="summary__value">{summary.wrong}</p>
                  </div>
                  <div className="summary__cell">
                    <p className="t-label">用时</p>
                    <p className="summary__value">{formatDuration(summary.elapsedMs)}</p>
                  </div>
                </div>

                <div className="summary__actions">
                  <button type="button" className="btn btn--primary" onClick={repeat}>
                    再来一组
                  </button>
                  <button type="button" className="btn" onClick={() => onNavigate('dashboard')}>
                    去看板
                  </button>
                  {summary.wrong > 0 ? (
                    <button type="button" className="btn" onClick={() => onNavigate('wrong')}>
                      重刷错题
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {summary.wrongQuestions.length > 0 ? (
              <section className="panel" style={{ marginTop: 'var(--s5)' }}>
                <header className="panel__head">
                  <h2 className="panel__title">这组答错的 {summary.wrongQuestions.length} 题</h2>
                  <p className="panel__hint">已进错题本，随时可以重刷</p>
                </header>
                <div className="panel__body panel__body--flush">
                  <div className="wronglist">
                    {summary.wrongQuestions.map(({ question, chosen }) => (
                      <div className="wrongrow" key={question.id}>
                        <span className="wrongrow__mark" aria-hidden="true">
                          <X size={13} strokeWidth={2.4} />
                        </span>
                        <div className="wrongrow__body">
                          <p className="wrongrow__stem">{question.stem}</p>
                          <p className="wrongrow__meta">
                            <span className="chip chip--wrong">你选了 {chosen.join('、')}</span>
                            <span className="chip chip--right">正确 {question.answer.join('、')}</span>
                            <span>{question.category}</span>
                          </p>
                          {question.explanation ? (
                            <p className="explain__body" style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-sm)' }}>
                              {question.explanation}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <div className="panel" style={{ marginTop: 'var(--s5)' }}>
                <EmptyState title="这组全对" text="错题本是空的。换个分类继续练，或者去看板看看还有哪些知识点没碰过。" />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const MODES = [
  { value: 'random' as SessionMode, label: '随机抽题' },
  { value: 'category' as SessionMode, label: '按分类' },
  { value: 'wrong' as SessionMode, label: '错题重刷' },
]

function PracticeStart({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { activeBank, workspace, startSession } = useApp()
  const [mode, setMode] = useState<SessionMode>('random')
  const [count, setCount] = useState(20)
  const [category, setCategory] = useState('')

  const categories = useMemo(
    () => (activeBank ? [...new Set(activeBank.questions.map((q) => q.category))] : []),
    [activeBank],
  )
  const wrongPool = useMemo(
    () => (activeBank ? collectWrongBook(activeBank, workspace) : []),
    [activeBank, workspace],
  )

  if (!activeBank) {
    return (
      <>
        <header className="topbar">
          <div className="topbar__heading">
            <p className="topbar__title">练习</p>
          </div>
        </header>
        <div className="content">
          <div className="content__inner">
            <div className="panel">
              <EmptyState title="还没有题库" text="先导入一份 JSON 题库，就能开始刷题了。">
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

  const pool =
    mode === 'wrong'
      ? wrongPool.map((entry) => entry.question)
      : mode === 'category'
        ? activeBank.questions.filter((q) => q.category === category)
        : activeBank.questions

  const size = count === 0 ? pool.length : Math.min(count, pool.length)

  const begin = () => {
    if (!pool.length) return
    const session = buildSession(
      activeBank,
      { mode, category: mode === 'category' ? category : null, count: size },
      pool,
      newId('s'),
    )
    if (!session.questionIds.length) return
    startSession(session)
  }

  const canStart = pool.length > 0 && (mode !== 'category' || !!category)

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">练习</p>
          <p className="topbar__sub">{activeBank.name}</p>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className="practice">
            <div className="panel">
              <div className="panel__body">
                <p className="t-label">这次怎么练</p>
                <div style={{ marginTop: 'var(--s3)' }}>
                  <Segmented options={MODES} value={mode} onChange={setMode} label="练习方式" />
                </div>

                {mode === 'category' ? (
                  <div className="field" style={{ marginTop: 'var(--s4)' }}>
                    <label className="field__label" htmlFor="category">
                      选择分类
                    </label>
                    <select
                      id="category"
                      className="select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">请选择…</option>
                      {categories.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className="field" style={{ marginTop: 'var(--s4)' }}>
                  <span className="field__label">题量</span>
                  <Segmented options={COUNTS} value={count} onChange={setCount} label="题量" />
                </div>

                <p className="t-meta" style={{ marginTop: 'var(--s4)', lineHeight: 1.7 }}>
                  {mode === 'random'
                    ? '从整个题库随机抽题，不重复已练过的题优先。想练覆盖面时用这个。'
                    : mode === 'category'
                      ? '只练一个分类，适合考前突击某一块知识点。'
                      : `只练错题本里的 ${wrongPool.length} 道题。答对一次就移出错题本。`}
                </p>

                <div className="practice__actions">
                  <button type="button" className="btn btn--primary btn--lg" onClick={begin} disabled={!canStart}>
                    开始练习（{size} 题）
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => onNavigate('dashboard')}>
                    返回看板
                  </button>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginTop: 'var(--s5)' }}>
              <div className="panel__body">
                <p className="t-label">练习规则</p>
                <ul style={{ marginTop: 'var(--s3)', display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
                  <li className="t-meta">
                    <CircleHelp size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                    答错的题自动进错题本，在错题本里答对一次即移出。
                  </li>
                  <li className="t-meta">
                    <Clock size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                    每题都会记录用时，看板上的用时统计来自这里。
                  </li>
                  <li className="t-meta">
                    <Check size={13} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                    连续答对会把掌握度往上提，看板上墨色越深就是记得越牢。
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
