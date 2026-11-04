import { ThemedButton } from './ThemedButton'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Left as ChevronLeft, Help as CircleHelp, Time as Clock, CloseSmall as X, BookOpen } from '@icon-park/react'
import { useApp } from '../domain/store'
import type { ActiveSession } from '../domain/store'
import { collectWrongBook, formatDuration, formatPercent } from '../domain/stats'
import { buildSession, isAnswerCorrect, newId, remainingChapterQuestions } from '../domain/session'
import { collectAssetIds } from '../domain/content'
import type { Question, SessionMode } from '../domain/types'
import type { Route } from '../App'
import { EmptyState, MasteryMark, OptionKey, QuestionTypeMark, Segmented } from './bits'
import { MediaFigure, QuestionContent, splitOptionBlocks, useMissingAssets } from './QuestionContent'
import { MathText } from './MathText'
import { masteryOf } from '../domain/stats'
import { useTheme } from '../domain/theme'
import { StudyPaper } from './StudyPaper'
import { Paper } from '../vendor/looseleaf/ui/paper'
import { Progress } from '../vendor/looseleaf/ui/progress'
import { Button } from '../vendor/looseleaf/ui/button'
import { Icon as HandIcon } from '../vendor/looseleaf/ui/icon'
import { Ink } from '../vendor/looseleaf/ink/react'
import { handFrameRecipe } from './hand-frame'

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

/** 留出短暂的批改反馈，再自动进入下一题。 */
const AUTO_ADVANCE_MS = 800

interface Verdict {
  questionId: string
  hasExplanation: boolean
}

export interface PracticeSummary {
  total: number
  correct: number
  wrong: number
  elapsedMs: number
  mode: SessionMode
  category: string | null
  wrongQuestions: { question: Question; chosen: string[]; elapsedMs: number }[]
}

/** 结算口径只有一套：最后一题提交完和手动点「看本次结算」都从这里算。 */
function buildSummary(
  session: ActiveSession,
  questions: Question[],
  endedAt: number,
): PracticeSummary | null {
  const results = Object.values(session.answers)
  const correct = results.filter((answer) => answer.correct).length
  return {
    total: results.length,
    correct,
    wrong: results.length - correct,
    elapsedMs: (session.elapsedMs ?? 0) + (session.paused ? 0 : Math.max(0, endedAt - (session.clockAt ?? endedAt))),
    mode: session.mode,
    category: session.category,
    wrongQuestions: questions
      .filter((question) => session.answers[question.id] && !session.answers[question.id].correct)
      .map((question) => ({
        question,
        chosen: session.answers[question.id].chosen,
        elapsedMs: session.answers[question.id].elapsedMs,
      })),
  }
}

export function Practice({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const [theme] = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(() => window.innerWidth > 920)
  const { session, workspace, updateSession, endSession, recordAttempt, clockSession, setActiveBank } = useApp()
  const activeBank = workspace.banks.find(bank => bank.id === (session?.bankId ?? workspace.activeBankId)) ?? null
  const [selected, setSelected] = useState<string[]>([])
  const [summary, setSummary] = useState<PracticeSummary | null>(null)
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [pending, setPending] = useState<{ target: number; deadline: number } | null>(null)
  const [, refreshClock] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => clockSession(), 1000)
    const visibility = () => { if (document.hidden) clockSession(true) }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    setSummary(null)
    setVerdict(null)
    setPending(null)
  }, [session?.id])

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

  /* 读数每秒走一格；等着自动翻页时走得更细，倒计时才不跳格 */
  const waiting = pending !== null
  useEffect(() => {
    if (!session) return
    const step = waiting ? 100 : 1000
    const timer = window.setInterval(() => refreshClock((tick) => tick + 1), step)
    return () => window.clearInterval(timer)
  }, [session?.id, waiting])

  /* 提交之后先停一会儿给批改留位置，再自己翻到下一道没答过的题 */
  useEffect(() => {
    if (!pending || !session || session.paused) return
    const target = pending.target
    const jump = () => {
      setPending(null)
      if (target < 0) {
        const data = buildSummary(session, questions, Date.now())
        if (!data) return
        setSummary(data)
        endSession()
        return
      }
      const now = Date.now()
      setSelected(session.drafts?.[questions[target].id] ?? [])
      updateSession({ ...session, index: target, questionStartedAt: now })
    }
    const delay = pending.deadline - Date.now()
    if (delay <= 0) {
      jump()
      return
    }
    const timer = window.setTimeout(jump, delay)
    return () => window.clearTimeout(timer)
  }, [pending, session, questions, updateSession, endSession])

  if (summary) {
    return <Summary summary={summary} onNavigate={onNavigate} />
  }

  if (!session || !activeBank || !current) {
    return <PracticeStart onNavigate={onNavigate} />
  }

  if (session.paused) return <div className="content"><div className="content__inner"><StudyPaper className="practice">
    <h1 className="pagehead__title">继续未完成的练习</h1>
    <p>{activeBank.name} · 已答 {Object.keys(session.answers).length} / {questions.length} 题</p>
    <div className="practice__answer-actions">
      <ThemedButton className="btn btn--primary" onClick={() => { setActiveBank(session.bankId); clockSession(false) }}>继续练习</ThemedButton>
      <ThemedButton className="btn" onClick={() => { setSummary(buildSummary(session, questions, Date.now())); endSession() }}>结束并结算</ThemedButton>
    </div>
  </StudyPaper></div></div>

  const answered = session.answers[current.id]
  const stat = workspace.stats[current.id]
  const mastery = masteryOf(stat)
  const answeredCount = Object.keys(session.answers).length
  const correctCount = Object.values(session.answers).filter((a) => a.correct).length
  const elapsed = (session.elapsedMs ?? 0) + Math.max(0, Date.now() - (session.clockAt ?? Date.now()))
  const questionElapsed = answered?.elapsedMs ??
    (session.elapsedByQuestion?.[current.id] ?? 0) + Math.max(0, Date.now() - session.questionStartedAt)
  const remaining = pending ? Math.max(0, pending.deadline - Date.now()) : 0
  const allAnswered = answeredCount === questions.length
  const pendingTarget = pending ? pending.target : null
  const nextLabel = allAnswered ? '看本次结算' : '下一题'
  const nextDisabled = !revealed && pendingTarget === null && !allAnswered && session.index + 1 >= questions.length
  const onlyOneLeft = questions.length - answeredCount === 1
  const verdictIndex = verdict ? questions.findIndex((q) => q.id === verdict.questionId) : -1
  const showVerdict = verdictIndex >= 0 && verdictIndex !== session.index && !!verdict?.hasExplanation

  const finishNow = () => {
    const data = buildSummary(session, questions, Date.now())
    if (!data) return
    setPending(null)
    setSummary(data)
    endSession()
  }

  const toggle = (key: string) => {
    if (revealed) return
    const next = current.type === 'multiple'
      ? selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]
      : [key]
    setSelected(next)
    updateSession({ ...session, drafts: { ...session.drafts, [current.id]: next } })
  }

  /** 往后找下一道没答过的题；全答完了就回 -1。 */
  const nextUnanswered = (from: number) => {
    for (let step = 1; step <= questions.length; step += 1) {
      const index = (from + step) % questions.length
      if (!session.answers[questions[index].id]) return index
    }
    return -1
  }

  const jumpTo = (index: number) => {
    if (index < 0 || index >= questions.length) return
    setPending(null)
    if (index === session.index) return
    const now = Date.now()
    setSelected(session.answers[questions[index].id]?.chosen ?? session.drafts?.[questions[index].id] ?? [])
    updateSession({ ...session, index, questionStartedAt: now,
      drafts: { ...session.drafts, [current.id]: selected },
      elapsedByQuestion: { ...session.elapsedByQuestion, [current.id]: answered?.elapsedMs ?? (session.elapsedByQuestion?.[current.id] ?? 0) + Math.max(0, now - session.questionStartedAt) },
    })
  }

  const submit = () => {
    if (!selected.length || revealed || missingImages) return
    const now = Date.now()
    const correct = isAnswerCorrect(current, selected)
    const elapsedMs = (session.elapsedByQuestion?.[current.id] ?? 0) + Math.max(0, now - session.questionStartedAt)
    recordAttempt({
      id: `${session.id}:${current.id}`,
      bankId: session.bankId,
      questionId: current.id,
      chosen: selected,
      correct,
      at: now,
      elapsedMs,
    })
    const completed: ActiveSession = {
      ...session,
      answers: { ...session.answers, [current.id]: { chosen: selected, correct, elapsedMs } },
      elapsedByQuestion: { ...session.elapsedByQuestion, [current.id]: elapsedMs },
    }
    updateSession(completed)
    /* 保存上一题的解析入口，再翻到下一道未答题。 */
    setVerdict({
      questionId: current.id,
      hasExplanation: !!(current.explanation || current.explanationBlocks?.length),
    })
    const offset = questions.findIndex((_, step) => {
      const index = (session.index + 1 + step) % questions.length
      return !completed.answers[questions[index].id]
    })
    const target = offset === -1 ? -1 : (session.index + 1 + offset) % questions.length
    setPending(correct ? { target, deadline: now + AUTO_ADVANCE_MS } : null)
  }

  const goNext = () => {
    if (pendingTarget !== null) {
      setPending(null)
      if (pendingTarget < 0) {
        finishNow()
        return
      }
      jumpTo(pendingTarget)
      return
    }
    if (allAnswered) {
      finishNow()
      return
    }
    const next = session.index + 1
    if (next < questions.length) {
      jumpTo(next)
      return
    }
    const wrap = nextUnanswered(session.index)
    if (wrap >= 0) jumpTo(wrap)
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
          <ThemedButton type="button" className="btn btn--sm" onClick={finishNow}>结束并结算</ThemedButton>
          <ThemedButton type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={14} strokeWidth={2} />
            返回看板
          </ThemedButton>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <div className={theme === 'looseleaf' ? 'practice-layout' : undefined}>
          <StudyPaper className="practice">
            {theme !== 'looseleaf' ? <div className="practice__top">
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
                  本题用时 <b data-testid="question-time">{formatDuration(questionElapsed)}</b>
                </span>
                <span className="practice__stat">
                  本次练习 <b data-testid="session-time">{formatDuration(elapsed)}</b>
                </span>
              </div>
            </div> : null}

            {verdict && showVerdict ? (
              theme === 'looseleaf' ? (
                <div
                  className={`practice__verdict practice__verdict--hand practice__verdict--${session.answers[verdict.questionId]?.correct ? 'right' : 'wrong'}`}
                  role="status"
                >
                  <Ink recipe={handFrameRecipe} params={{ opacity: 0.94 }} seed={`verdict-${verdict.questionId}`} layers={['rest']} />
                  <span className="practice__verdict-mark" aria-hidden="true">
                    <HandIcon name={session.answers[verdict.questionId]?.correct ? 'circle-check' : 'circle-x'} size={17} />
                  </span>
                  <span className="practice__verdict-title">{session.answers[verdict.questionId]?.correct ? '上一题答对了' : '上一题答错了，已收进错题本'}</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="practice__verdict-link"
                    onClick={() => jumpTo(verdictIndex)}
                  >
                    看解析
                  </Button>
                </div>
              ) : (
                <div className={`practice__verdict practice__verdict--${session.answers[verdict.questionId]?.correct ? 'right' : 'wrong'}`} role="status">
                  <span className="practice__verdict-mark" aria-hidden="true">
                    {session.answers[verdict.questionId]?.correct ? <Check size={14} strokeWidth={2.6} /> : <X size={14} strokeWidth={2.6} />}
                  </span>
                  <span className="practice__verdict-title">{session.answers[verdict.questionId]?.correct ? '上一题答对了' : '上一题答错了，已收进错题本'}</span>
                  <ThemedButton
                    type="button"
                    className="practice__verdict-link"
                    onClick={() => jumpTo(verdictIndex)}
                  >
                    看解析
                  </ThemedButton>
                </div>
              )
            ) : null}

            {theme !== 'looseleaf' ? <div className="dotrail" role="img" aria-label={`共 ${questions.length} 题，已答 ${answeredCount} 题`}>
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
            </div> : null}

            <div className="practice__meta">
              <QuestionTypeMark type={current.type} />
              <span className="practice__category">{current.category}</span>
              <MasteryMark mastery={mastery} />
            </div>

            <QuestionContent
              blocks={current.stemBlocks}
              fallback={current.stem}
              className="t-stem practice__stem"
            />

            <div className={`options options--${current.type}`} role="group" aria-label="选项">
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
                    <ThemedButton
                      type="button"
                      className="option__pick"
                      onClick={() => toggle(opt.key)}
                      disabled={revealed}
                      aria-pressed={isChosen}
                    >
                      {current.type !== 'judge' ? <OptionKey label={opt.key} type={current.type} seed={`${current.id}-${opt.key}`} /> : null}
                      <span className="option__text">
                        {text.length
                          ? text.map((block, index) =>
                              block.type === 'text' ? <MathText text={block.text} key={index} /> : null,
                            )
                          : <MathText text={opt.text} />}
                      </span>
                      {revealed && isAnswer ? (
                        <Check className="option__mark" size={17} strokeWidth={2.6} aria-hidden="true" />
                      ) : null}
                      {revealed && !isAnswer && isChosen ? (
                        <X className="option__mark" size={17} strokeWidth={2.6} aria-hidden="true" />
                      ) : null}
                    </ThemedButton>
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

            <p className="practice__hint" role={missingImages && !revealed ? 'status' : undefined}>
              {pending ? (
                <span className="practice__countdown" data-testid="advance-countdown">
                  {(remaining / 1000).toFixed(1)}s 后自动{pendingTarget !== null && pendingTarget < 0 ? '结算' : '进入下一题'}
                </span>
              ) : missingImages && !revealed ? (
                '有图片没加载出来，这题先别提交。'
              ) : !revealed ? (
                onlyOneLeft
                  ? '这是最后一题，答完就能看本次结算。'
                  : current.type === 'multiple'
                    ? '可多选，选完再确认'
                    : '选一个选项'
              ) : null}
            </p>

            <div className="practice__actions practice__answer-actions">
              <ThemedButton
                type="button"
                className="btn btn--ghost btn--sm practice__step"
                disabled={session.index === 0}
                onClick={() => jumpTo(session.index - 1)}
              >
                <ChevronLeft size={14} strokeWidth={2} />上一题
              </ThemedButton>
              {revealed ? (
                <ThemedButton
                  type="button"
                  className="btn btn--primary btn--lg practice__submit"
                  onClick={goNext}
                  disabled={nextDisabled}
                  title={nextDisabled ? `还有 ${questions.length - answeredCount} 题未提交` : undefined}
                >
                  {nextLabel}
                  <ArrowRight size={16} strokeWidth={2} />
                </ThemedButton>
              ) : (
                <ThemedButton
                  type="button"
                  className="btn btn--primary btn--lg practice__submit"
                  onClick={submit}
                  disabled={!selected.length || missingImages}
                >
                  确认答案
                </ThemedButton>
              )}
              {!revealed ? (
                <ThemedButton
                  type="button"
                  className="btn btn--ghost btn--sm practice__step"
                  onClick={goNext}
                  disabled={nextDisabled}
                  title={nextDisabled ? `还有 ${questions.length - answeredCount} 题未提交` : undefined}
                >
                  下一题<ArrowRight size={14} strokeWidth={2} />
                </ThemedButton>
              ) : null}
            </div>
          </StudyPaper>
          {theme === 'looseleaf' ? <Paper as="aside" stock="pad" rules="none" tilt={false} className="answer-sheet">
            <h2>本次练习</h2>
            <div className="answer-sheet__summary"><p className="practice__counter answer-sheet__counter">第 {session.index + 1} / {questions.length} 题</p><Progress value={answeredCount} max={questions.length} tone="blue" size="sm" aria-label="本次已答进度" /></div>
            <div className="answer-sheet__timers">
              <div><span>本题用时</span><b data-testid="question-time">{formatDuration(questionElapsed)}</b></div>
              <div><span>本次练习</span><b data-testid="session-time">{formatDuration(elapsed)}</b></div>
              <div><span>已答</span><b>{answeredCount} 题</b></div>
              <div><span>答对</span><b>{correctCount} 题</b></div>
            </div>
            <details open={paletteOpen} onToggle={event => setPaletteOpen(event.currentTarget.open)}><summary>答题卡</summary>
              <div className="answer-sheet__grid">{questions.map((question, index) => {
                const answer = session.answers[question.id]
                const currentQuestion = index === session.index
                return <Button key={question.id} size="icon-sm" variant={currentQuestion ? 'default' : answer ? 'secondary' : 'outline'} className={answer ? answer.correct ? 'answer-right' : 'answer-wrong' : ''} aria-current={currentQuestion ? 'step' : undefined} aria-label={`第 ${index + 1} 题，${answer ? answer.correct ? '答对' : '答错' : '未答'}`} onClick={() => jumpTo(index)}>{index + 1}</Button>
              })}</div>
            </details>
            <p className="answer-sheet__legend">橙色 · 当前题　绿色 · 答对<br />红色 · 答错　空白 · 未答</p>
          </Paper> : null}
          </div>
        </div>
      </div>
    </>
  )
}

function Summary({ summary, onNavigate }: { summary: PracticeSummary; onNavigate: (route: Route) => void }) {
  const { activeBank, workspace, startSession } = useApp()
  const accuracy = summary.total ? summary.correct / summary.total : null
  const average = summary.total ? Math.round(summary.elapsedMs / summary.total) : 0

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
          <ThemedButton type="button" className="btn btn--ghost btn--sm" onClick={() => onNavigate('dashboard')}>
            <ChevronLeft size={14} strokeWidth={2} />
            返回看板
          </ThemedButton>
        </div>
      </header>

      <div className="content">
        <div className="content__inner">
          <StudyPaper className="practice">
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
                    <p className="t-label">{summary.mode === 'wrong' ? '已解决' : '答对'}</p>
                    <p className="summary__value">{summary.correct}</p>
                  </div>
                  <div className="summary__cell">
                    <p className="t-label">{summary.mode === 'wrong' ? '仍需复习' : '答错'}</p>
                    <p className="summary__value">{summary.wrong}</p>
                  </div>
                  <div className="summary__cell">
                    <p className="t-label">用时</p>
                    <p className="summary__value">{formatDuration(summary.elapsedMs)}</p>
                    <p className="t-meta">平均每题 {formatDuration(average)}</p>
                  </div>
                </div>

                <div className="summary__actions">
                  <ThemedButton type="button" className="btn btn--primary" onClick={repeat}>
                    再来一组
                  </ThemedButton>
                  <ThemedButton type="button" className="btn" onClick={() => onNavigate('dashboard')}>
                    去看板
                  </ThemedButton>
                  {summary.wrong > 0 ? (
                    <ThemedButton type="button" className="btn" onClick={() => onNavigate('wrong')}>
                      重刷错题
                    </ThemedButton>
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
                    {summary.wrongQuestions.map(({ question, chosen, elapsedMs }) => (
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
                            <QuestionTypeMark type={question.type} />
                            <span className="chip chip--wrong">你选了 {chosen.join('、')}</span>
                            <span className="chip chip--right">正确 {question.answer.join('、')}</span>
                            <span className="chip">用时 {formatDuration(elapsedMs)}</span>
                            <span>{question.category}</span>
                          </p>
                          {question.explanation || question.explanationBlocks?.length ? (
                            <div className="explain__body" style={{ marginTop: 'var(--s2)', fontSize: 'var(--t-sm)' }}>
                              <QuestionContent blocks={question.explanationBlocks} fallback={question.explanation ?? ''} />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : (
              <div className="panel" style={{ marginTop: 'var(--s5)' }}>
                <EmptyState title="这组全对" text="本次没有新增错题。换个分类继续练，或者去看板看看还有哪些知识点没碰过。" />
              </div>
            )}
          </StudyPaper>
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
  const [chapterStart, setChapterStart] = useState<'continue' | 'restart'>('continue')

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
                <ThemedButton type="button" className="btn btn--primary" onClick={() => onNavigate('banks')}>
                  去导入题库
                </ThemedButton>
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
    startSession(session, chapterStart === 'restart')
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
          <StudyPaper className="practice">
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
                    <Segmented options={[{ value: 'continue', label: '接着练' }, { value: 'restart', label: '从头重练' }]} value={chapterStart} onChange={setChapterStart} label="章节起点" />
                    <p className="field__label">选择章节，直接开始</p>
                    <div className="chapters__list">
                      {categories.map(({ name, total, practiced }, index) => {
                        const remaining = remainingChapterQuestions(activeBank, name, workspace)
                        const available = chapterStart === 'continue' && remaining.length ? remaining.length : total
                        const chapterSize = count === 0 ? available : Math.min(count, available)
                        return (
                          <ThemedButton
                            key={name}
                            type="button"
                            className="chapter-entry"
                            onClick={() => begin(name)}
                            aria-label={`${name}，共 ${total} 题，开始练习 ${chapterSize} 题`}
                          >
                            <span className="chapter-entry__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                            <span className="chapter-entry__body">
                              <span className="chapter-entry__name"><BookOpen size={16} aria-hidden="true" />{name}</span>
                              <span className="chapter-entry__meta">共 {total} 题 · 已练 {practiced} 题{chapterStart === 'continue' && remaining.length < total ? ` · ${remaining.length ? `剩余 ${remaining.length} 题` : '已练完'}` : ''}</span>
                            </span>
                            <span className="chapter-entry__action">{chapterStart === 'continue' && remaining.length < total && remaining.length > 0 ? '继续未做' : '练'} {chapterSize} 题<ArrowRight size={16} aria-hidden="true" /></span>
                          </ThemedButton>
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
                  {mode !== 'category' ? <ThemedButton type="button" className="btn btn--primary btn--lg" onClick={() => begin()} disabled={!canStart}>
                    开始练习（{size} 题）
                  </ThemedButton> : null}
                  <ThemedButton type="button" className="btn btn--ghost" onClick={() => onNavigate('dashboard')}>
                    返回看板
                  </ThemedButton>
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
          </StudyPaper>
        </div>
      </div>
    </>
  )
}
