import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Left as ChevronLeft, Help as CircleHelp, Time as Clock, CloseSmall as X, BookOpen } from '@icon-park/react'
import { useApp } from '../domain/store'
import { collectWrongBook, formatDuration, formatPercent } from '../domain/stats'
import { buildSession, isAnswerCorrect, newId } from '../domain/session'
import { collectAssetIds } from '../domain/content'
import type { Question, SessionMode } from '../domain/types'
import type { Route } from '../App'
import { EmptyState, MasteryMark, Segmented } from './bits'
import { MediaFigure, QuestionContent, splitOptionBlocks, useMissingAssets } from './QuestionContent'
import { masteryOf } from '../domain/stats'

const COUNTS = [
  { value: 10, label: '10 题' },
  { value: 20, label: '20 题' },
  { value: 50, label: '50 题' },
  { value: 0, label: '全部' },
]

const MODE_LABEL: Record<SessionMode, string> = {
  random: '随机练习',
  category: '章节练习',
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
    setSelected(current ? session?.answers[current.id]?.chosen ?? session?.drafts?.[current.id] ?? [] : [])
  }, [session?.index, session?.id])

  /* 钩子要排在提前 return 之前，不然切页面时 React 会抱怨 */
  const requiredAssetIds = useMemo(
    () => (current
      ? [
        ...collectAssetIds(current.stemBlocks),
        ...current.options.flatMap((option) => collectAssetIds(option.blocks)),
      ]
      : []),
    [current],
  )
  const missingImages = useMissingAssets(requiredAssetIds)

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
    const elapsedMs = (session.elapsedByQuestion?.[current.id] ?? 0) + Date.now() - session.questionStartedAt
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

  const moveTo = (index: number) => {
    if (index < 0 || index >= questions.length) return
    updateSession({ ...session, index, questionStartedAt: Date.now(),
      drafts: { ...session.drafts, [current.id]: selected },
      elapsedByQuestion: { ...session.elapsedByQuestion, [current.id]: (session.elapsedByQuestion?.[current.id] ?? 0) + Date.now() - session.questionStartedAt },
    })
  }

  const advance = () => {
    const isLast = session.index + 1 >= questions.length
    if (isLast) {
      if (answeredCount !== questions.length) return
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
    moveTo(session.index + 1)
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

            <QuestionContent
              blocks={current.stemBlocks}
              fallback={current.stem}
              className="t-stem practice__stem"
            />

            <div className="options" role="group" aria-label="选项">
              {current.options.map((opt) => {
                const isChosen = selected.includes(opt.key)
                const isAnswer = current.answer.includes(opt.key)
                const { text, media } = splitOptionBlocks(opt.blocks)
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
                  <div className={cls} key={opt.key}>
                    <button
                      type="button"
                      className="option__pick"
                      onClick={() => toggle(opt.key)}
                      disabled={revealed}
                      aria-pressed={isChosen}
                    >
                      <span className="option__key" aria-hidden="true">
                        {opt.key}
                      </span>
                      <span className="option__text">
                        {text.length
                          ? text.map((block, index) =>
                              block.type === 'text' ? <span key={index}>{block.text}</span> : null,
                            )
                          : opt.text}
                      </span>
                      {revealed && isAnswer ? (
                        <Check className="option__mark" size={17} strokeWidth={2.6} aria-hidden="true" />
                      ) : null}
                      {revealed && !isAnswer && isChosen ? (
                        <X className="option__mark" size={17} strokeWidth={2.6} aria-hidden="true" />
                      ) : null}
                    </button>
                    {media.length ? (
                      <div className="option__media">
                        {media.map((block, index) => (
                          <MediaFigure block={block} key={index} />
                        ))}
                      </div>
                    ) : null}
                  </div>
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
                {current.explanation || current.explanationBlocks?.length ? (
                  <div className="explain">
                    <p className="explain__label">解析</p>
                    <QuestionContent
                      blocks={current.explanationBlocks}
                      fallback={current.explanation}
                      className="explain__body"
                    />
                  </div>
                ) : null}
              </>
            ) : null}

            <div className="practice__actions">
              <button type="button" className="btn btn--lg" disabled={session.index === 0} onClick={() => moveTo(session.index - 1)}>
                <ChevronLeft size={16} strokeWidth={2} />上一题
              </button>
              {!revealed ? (
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={submit}
                  disabled={!selected.length || missingImages}
                >
                  确认答案
                </button>
              ) : null}
              <button type="button" className={`btn btn--lg${revealed ? ' btn--primary' : ''}`} onClick={advance}
                disabled={session.index + 1 >= questions.length && answeredCount !== questions.length}
                title={session.index + 1 >= questions.length && answeredCount !== questions.length ? `还有 ${questions.length - answeredCount} 题未提交` : undefined}>
                {session.index + 1 >= questions.length ? '看本次结算' : '下一题'}
                <ArrowRight size={16} strokeWidth={2} />
              </button>
              {!revealed ? (
                missingImages ? (
                  <span className="t-meta" role="status">有图片没加载出来，这题先别提交。</span>
                ) : (
                  <span className="t-meta">
                    {current.type === 'multiple' ? '可多选，选完再确认' : '选一个选项'}
                  </span>
                )
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
                          <QuestionContent
                            blocks={question.stemBlocks}
                            fallback={question.stem}
                            className="wrongrow__stem"
                          />
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
  { value: 'category' as SessionMode, label: '按章节' },
  { value: 'wrong' as SessionMode, label: '错题重刷' },
]

function PracticeStart({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { activeBank, workspace, startSession } = useApp()
  const [mode, setMode] = useState<SessionMode>('random')
  const [count, setCount] = useState(20)

  const categories = useMemo(
    () => {
      const chapters = new Map<string, { name: string; total: number; practiced: number }>()
      for (const question of activeBank?.questions ?? []) {
        const chapter = chapters.get(question.category) ?? { name: question.category, total: 0, practiced: 0 }
        chapter.total += 1
        if (workspace.stats[question.id]?.attempts) chapter.practiced += 1
        chapters.set(question.category, chapter)
      }
      return [...chapters.values()]
    },
    [activeBank, workspace.stats],
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
      : activeBank.questions

  const size = count === 0 ? pool.length : Math.min(count, pool.length)

  const begin = (category: string | null = null) => {
    const selectedPool = mode === 'category'
      ? activeBank.questions.filter((question) => question.category === category)
      : pool
    if (!selectedPool.length) return
    const session = buildSession(
      activeBank,
      { mode, category: mode === 'category' ? category : null, count: count === 0 ? selectedPool.length : count },
      selectedPool,
      newId('s'),
    )
    if (!session.questionIds.length) return
    startSession(session)
  }

  const canStart = pool.length > 0

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

                <div className="field" style={{ marginTop: 'var(--s4)' }}>
                  <span className="field__label">题量</span>
                  <Segmented options={COUNTS} value={count} onChange={setCount} label="题量" />
                </div>

                {mode === 'category' ? (
                  <section className="chapters" aria-label="章节入口">
                    <p className="field__label">选择章节，直接开始</p>
                    <div className="chapters__list">
                      {categories.map(({ name, total, practiced }, index) => {
                        const chapterSize = count === 0 ? total : Math.min(count, total)
                        return (
                          <button
                            key={name}
                            type="button"
                            className="chapter-entry"
                            onClick={() => begin(name)}
                            aria-label={`${name}，共 ${total} 题，开始练习 ${chapterSize} 题`}
                          >
                            <span className="chapter-entry__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                            <span className="chapter-entry__body">
                              <span className="chapter-entry__name"><BookOpen size={16} aria-hidden="true" />{name}</span>
                              <span className="chapter-entry__meta">共 {total} 题 · 已练 {practiced} 题</span>
                            </span>
                            <span className="chapter-entry__action">练 {chapterSize} 题<ArrowRight size={16} aria-hidden="true" /></span>
                          </button>
                        )
                      })}
                    </div>
                    {!categories.length ? <p className="t-meta">当前题库没有可练习的章节，请先导入题目。</p> : null}
                  </section>
                ) : null}

                <p className="t-meta" style={{ marginTop: 'var(--s4)', lineHeight: 1.7 }}>
                  {mode === 'random'
                    ? '从整个题库随机抽题，不重复已练过的题优先。想练覆盖面时用这个。'
                    : mode === 'category'
                      ? '点击章节入口即可按所选题量开始，题目按题库顺序排列。'
                      : `只练错题本里的 ${wrongPool.length} 道题。答对一次就移出错题本。`}
                </p>

                <div className="practice__actions">
                  {mode !== 'category' ? <button type="button" className="btn btn--primary btn--lg" onClick={() => begin()} disabled={!canStart}>
                    开始练习（{size} 题）
                  </button> : null}
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
