import { useMemo, useState } from 'react'
import { ArrowRight, Refresh as RefreshCw, CloseSmall as X } from '@icon-park/react'
import { useApp } from '../domain/store'
import { collectWrongBook, computeDashboard, dayLabel, formatDuration, formatPercent } from '../domain/stats'
import { buildSession, newId } from '../domain/session'
import { DATA_PLACE } from '../domain/shell'
import type { Route } from '../App'
import { EmptyState, InkSteps, Segmented, masteryInk, masteryLabel } from './bits'

const COUNTS = [
  { value: 10, label: '10 题' },
  { value: 20, label: '20 题' },
  { value: 50, label: '50 题' },
  { value: 0, label: '全部' },
]

/** 日题量的墨阶分级：绝对阈值，跨天可比。 */
function volumeInk(count: number): string {
  if (count <= 2) return 'var(--blue-2)'
  if (count <= 5) return 'var(--blue-3)'
  if (count <= 10) return 'var(--blue-4)'
  if (count <= 20) return 'var(--blue-5)'
  return 'var(--ink-900)'
}

export function Dashboard({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { workspace, activeBank, startSession } = useApp()
  const [count, setCount] = useState(20)

  const data = useMemo(() => computeDashboard(activeBank, workspace), [activeBank, workspace])
  const wrong = useMemo(
    () => (activeBank ? collectWrongBook(activeBank, workspace) : []),
    [activeBank, workspace],
  )

  const beginRandom = () => {
    if (!activeBank) return
    const size = count === 0 ? activeBank.questions.length : count
    const session = buildSession(
      activeBank,
      { mode: 'random', category: null, count: size },
      activeBank.questions,
      newId('s'),
    )
    if (!session.questionIds.length) return
    startSession(session)
    onNavigate('practice')
  }

  if (!activeBank) {
    return (
      <>
        <header className="topbar">
          <div className="topbar__heading">
            <p className="topbar__title">看板</p>
            <p className="topbar__sub">还没有题库</p>
          </div>
        </header>
        <div className="content">
          <div className="content__inner">
            <div className="panel">
              <EmptyState
                title="先导入一份题库"
                text="ALL RIGHT 全对读 JSON 格式的题库文件。导入后可以按分类抽题、随机刷题，答错的题自动进错题本，进度与正确率会出现在看板上。"
              >
                <button type="button" className="btn btn--primary" onClick={() => onNavigate('banks')}>
                  去导入题库
                  <ArrowRight size={15} strokeWidth={2} />
                </button>
              </EmptyState>
            </div>
          </div>
        </div>
      </>
    )
  }

  const maxDaily = Math.max(1, ...data.daily.map((d) => d.answered))
  const maxMastery = Math.max(1, ...data.masteryBuckets)
  const ranked = [...data.categories].sort((a, b) => {
    if (a.accuracy === null && b.accuracy === null) return a.name.localeCompare(b.name, 'zh-Hans-CN')
    if (a.accuracy === null) return 1
    if (b.accuracy === null) return -1
    return a.accuracy - b.accuracy
  })
  const totalTime = data.bankAttempts.reduce((sum, a) => sum + a.elapsedMs, 0)

  return (
    <>
      <header className="topbar">
        <div className="topbar__heading">
          <p className="topbar__title">看板</p>
          <p className="topbar__sub">{activeBank.name}</p>
        </div>
        <div className="topbar__actions">
          <Segmented options={COUNTS} value={count} onChange={setCount} label="本次题量" />
          <button type="button" className="btn btn--primary" onClick={beginRandom}>
            开始随机练习
          </button>
        </div>
      </header>
      <DashboardBody
        data={data}
        wrong={wrong}
        ranked={ranked}
        maxDaily={maxDaily}
        maxMastery={maxMastery}
        totalTime={totalTime}
        onNavigate={onNavigate}
      />
    </>
  )
}

interface DashboardBodyProps {
  data: ReturnType<typeof computeDashboard>
  wrong: ReturnType<typeof collectWrongBook>
  ranked: ReturnType<typeof computeDashboard>['categories']
  maxDaily: number
  maxMastery: number
  totalTime: number
  onNavigate: (route: Route) => void
}

function DashboardBody({
  data,
  wrong,
  ranked,
  maxDaily,
  maxMastery,
  totalTime,
  onNavigate,
}: DashboardBodyProps) {
  const { activeBank, startSession } = useApp()

  return (
    <div className="content">
      <div className="content__inner">
        <div className="databar" style={{ '--cols': 5 } as React.CSSProperties}>
          <div className="databar__cell">
            <p className="t-label">已练题数</p>
            <p className="databar__value">
              {data.attemptedQuestions}
              <span className="databar__unit">/ {data.totalQuestions} 题</span>
            </p>
            <p className="databar__foot">
              <InkSteps ratio={data.totalQuestions ? data.attemptedQuestions / data.totalQuestions : null} size="sm" />
              还剩 {data.unseenQuestions} 题未练
            </p>
          </div>
          <div className="databar__cell">
            <p className="t-label">总正确率</p>
            <p className="databar__value">{data.overallAccuracy === null ? '—' : formatPercent(data.overallAccuracy)}</p>
            <p className="databar__foot">共 {data.totalAttempts} 次作答</p>
          </div>
          <div className="databar__cell">
            <p className="t-label">今日练习</p>
            <p className="databar__value">
              {data.todayAnswered}
              <span className="databar__unit">题</span>
            </p>
            <p className="databar__foot">
              {data.todayAnswered > 0 ? `正确率 ${formatPercent(data.todayAccuracy)}` : '今天还没开始'}
            </p>
          </div>
          <div className="databar__cell">
            <p className="t-label">连续练习</p>
            <p className="databar__value">
              {data.streak}
              <span className="databar__unit">天</span>
            </p>
            <p className="databar__foot">累计用时 {formatDuration(totalTime)}</p>
          </div>
          <div className="databar__cell">
            <p className="t-label">错题本</p>
            <p className="databar__value">
              {data.wrongBookCount}
              <span className="databar__unit">题待复习</span>
            </p>
            <p className="databar__foot">已掌握 {data.masteredQuestions} 题</p>
          </div>
        </div>
        <DashboardPanels
          data={data}
          wrong={wrong}
          ranked={ranked}
          maxDaily={maxDaily}
          maxMastery={maxMastery}
          onNavigate={onNavigate}
          onCategory={(name) => {
            if (!activeBank) return
            const pool = activeBank.questions.filter((q) => q.category === name)
            if (!pool.length) return
            const session = buildSession(
              activeBank,
              { mode: 'category', category: name, count: pool.length },
              pool,
              newId('s'),
            )
            startSession(session)
            onNavigate('practice')
          }}
        />
      </div>
    </div>
  )
}

interface DashboardPanelsProps {
  data: ReturnType<typeof computeDashboard>
  wrong: ReturnType<typeof collectWrongBook>
  ranked: ReturnType<typeof computeDashboard>['categories']
  maxDaily: number
  maxMastery: number
  onNavigate: (route: Route) => void
  onCategory: (name: string) => void
}

function DashboardPanels({
  data,
  wrong,
  ranked,
  maxDaily,
  maxMastery,
  onNavigate,
  onCategory,
}: DashboardPanelsProps) {
  const { activeBank, startSession } = useApp()
  const halfDaily = Math.round(maxDaily / 2)

  const beginWrong = () => {
    if (!activeBank) return
    const pool = wrong.map((entry) => entry.question)
    if (!pool.length) return
    const session = buildSession(
      activeBank,
      { mode: 'wrong', category: null, count: pool.length },
      pool,
      newId('s'),
    )
    startSession(session)
    onNavigate('practice')
  }

  return (
    <div className="dash">
      <div className="dash__col">
        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">近 14 天练习量</h2>
            <p className="panel__hint">
              <span className="panel__hint-part">单位：题 · 柱高为当日题量</span>{' '}
              <span className="panel__hint-part">靛蓝是答对、朱红是答错</span>
            </p>
          </header>
          <div className="panel__body">
            <div className="daily">
              <div className="daily__bars">
                <span className="daily__grid daily__grid--top" aria-hidden="true" />
                <span
                  className="daily__grid daily__grid--mid"
                  style={{ top: `${(halfDaily / maxDaily) * 100}%` }}
                  aria-hidden="true"
                />
                <span className="daily__tick daily__tick--top" aria-hidden="true">
                  {maxDaily}
                </span>
                <span
                  className="daily__tick daily__tick--mid"
                  style={{ top: `${(halfDaily / maxDaily) * 100}%` }}
                  aria-hidden="true"
                >
                  {halfDaily}
                </span>
                {data.daily.map((point) => {
                  const wrongCount = point.answered - point.correct
                  const wrongPct = (wrongCount / maxDaily) * 100
                  const rightPct = Math.max(0, ((point.answered - wrongCount) / maxDaily) * 100)
                  return (
                    <div className="daily__col" key={point.date}>
                      <div className="daily__stack">
                        {point.answered > 0 ? (
                          <>
                            {rightPct > 0 ? (
                              <div
                                className="daily__right"
                                style={
                                  {
                                    height: `${rightPct}%`,
                                    '--ink-level': volumeInk(point.answered),
                                  } as React.CSSProperties
                                }
                              />
                            ) : null}
                            {wrongPct > 0 ? (
                              <div className="daily__wrong" style={{ height: `${wrongPct}%` }} />
                            ) : null}
                          </>
                        ) : (
                          <div className="daily__empty" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="daily__labels">
                {data.daily.map((point, i) => {
                  const isToday = i === data.daily.length - 1
                  return (
                    <span
                      key={point.date}
                      className={isToday ? 'daily__label daily__label--today' : 'daily__label'}
                    >
                      {dayLabel(point.date)}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="daily__axis">
              <span>14 天前</span>
              <span>今天</span>
            </div>
            <div className="legend">
              <span className="legend__item">
                <span className="legend__swatch legend__swatch--ramp" aria-hidden="true">
                  <i style={{ background: 'var(--blue-2)' }} />
                  <i style={{ background: 'var(--blue-3)' }} />
                  <i style={{ background: 'var(--blue-4)' }} />
                  <i style={{ background: 'var(--blue-5)' }} />
                  <i style={{ background: 'var(--ink-900)' }} />
                </span>
                答对（色深＝当日题量）
              </span>
              <span className="legend__item">
                <span className="legend__swatch" style={{ background: 'var(--wrong)' }} aria-hidden="true" />
                答错
              </span>
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">分类正确率</h2>
            <p className="panel__hint">
              <span className="panel__hint-part">正确率最低的排在前面</span>{' '}
              <span className="panel__hint-part">阶梯条格数＝正确率，墨色＝掌握度</span>
            </p>
          </header>
          <div className="panel__body panel__body--flush">
            <div className="catrows">
              {ranked.map((cat) => (
                <button type="button" className="catrow" key={cat.name} onClick={() => onCategory(cat.name)}>
                  <span className="catrow__label">
                    <span className="catrow__name">{cat.name}</span>
                    <span className="catrow__meta">
                      <span className="catrow__sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="catrow__count">
                        {cat.attempted} / {cat.total} 题已练
                      </span>
                      {cat.wrong > 0 ? <span className="catrow__err">· 错 {cat.wrong} 次</span> : null}
                    </span>
                  </span>
                  <span className="catrow__steps">
                    <InkSteps ratio={cat.accuracy} level={cat.masteryLevel} />
                  </span>
                  <span className={cat.accuracy === null ? 'catrow__rate catrow__rate--none' : 'catrow__rate'}>
                    {formatPercent(cat.accuracy)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel__head">
            <h2 className="panel__title">掌握分布</h2>
            <p className="panel__hint">墨色越深，记得越牢</p>
          </header>
          <div className="panel__body">
            <div className="mastery">
              {data.masteryBuckets.map((n, i) => (
                <div className="mastery__row" key={i}>
                  <span className="mastery__label">{masteryLabel(i as 0)}</span>
                  <span className="mastery__track">
                    <span
                      className="mastery__fill"
                      style={{ width: `${(n / maxMastery) * 100}%`, background: masteryInk(i as 0) }}
                    />
                  </span>
                  <span className="mastery__count">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <DashboardSide data={data} wrong={wrong} onNavigate={onNavigate} onBeginWrong={beginWrong} />
    </div>
  )
}

interface DashboardSideProps {
  data: ReturnType<typeof computeDashboard>
  wrong: ReturnType<typeof collectWrongBook>
  onNavigate: (route: Route) => void
  onBeginWrong: () => void
}

function DashboardSide({ data, wrong, onNavigate, onBeginWrong }: DashboardSideProps) {
  return (
    <div className="dash__col">
      <section className="panel">
        <header className="panel__head">
          <h2 className="panel__title">错题本</h2>
          {wrong.length > 0 ? (
            <div className="panel__actions">
              <button type="button" className="btn btn--sm" onClick={onBeginWrong}>
                <RefreshCw size={13} strokeWidth={2} />
                重刷全部
              </button>
            </div>
          ) : null}
        </header>
        <div className="panel__body panel__body--flush">
          {wrong.length === 0 ? (
            <EmptyState
              title={data.attemptedQuestions === 0 ? '还没有作答记录' : '错题本是空的'}
              text={
                data.attemptedQuestions === 0
                  ? '答错的题会自动收进这里，并单独统计。练几道题就能看到。'
                  : '目前没有待复习的错题。答错一次就会自动进来。'
              }
            />
          ) : (
            <div className="wronglist">
              {wrong.slice(0, 6).map((entry) => (
                <div className="wrongrow" key={entry.question.id}>
                  <span className="wrongrow__mark" aria-hidden="true">
                    <X size={13} strokeWidth={2.4} />
                  </span>
                  <div className="wrongrow__body">
                    <p className="wrongrow__stem">{entry.question.stem}</p>
                    <p className="wrongrow__meta">
                      <span className="chip chip--wrong">错 {entry.stat.wrongCount} 次</span>
                      <span>{entry.question.category}</span>
                      <span>掌握度 {masteryLabel(entry.mastery)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {wrong.length > 6 ? (
          <div className="preview__actions">
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => onNavigate('wrong')}>
              查看全部 {wrong.length} 道错题
              <ArrowRight size={13} strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel__body">
          <p className="t-label">关于示例数据</p>
          <p className="t-meta" style={{ marginTop: 'var(--s2)', lineHeight: 1.7 }}>
            演示题库由 ALL RIGHT 全对合成，用来展示刷题与统计流程，不是任何考试的真题。导入你自己的
            JSON 题库后，这里显示的就是你的真实记录。
          </p>
          <p className="t-meta" style={{ marginTop: 'var(--s2)' }}>
            数据只保存在{DATA_PLACE}，不会上传。
          </p>
        </div>
      </section>
    </div>
  )
}
