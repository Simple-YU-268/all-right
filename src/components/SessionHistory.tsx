import { useMemo, useState } from 'react'
import { Down } from '@icon-park/react'
import { formatDuration, formatPercent } from '../domain/stats'
import type { SessionRecord } from '../domain/types'
import { ThemedButton } from './ThemedButton'

const MODE_LABEL: Record<SessionRecord['mode'], string> = {
  random: '随机练习',
  category: '章节练习',
  wrong: '错题重刷',
}

/** 练习历史：每次结算留一条，看得见自己练过什么、练得怎么样。 */
export function SessionHistory({ sessions, bankNames }: { sessions: SessionRecord[]; bankNames: Map<string, string> }) {
  const [expanded, setExpanded] = useState(false)

  const visible = useMemo(() => sessions.slice(0, expanded ? sessions.length : 8), [sessions, expanded])

  if (!sessions.length) {
    return (
      <div className="history">
        <p className="t-meta">还没有练习记录。完成一组练习后，这里会留下每组的题量、正确率和用时。</p>
      </div>
    )
  }

  const totalAnswered = sessions.reduce((sum, session) => sum + session.answered, 0)
  const totalCorrect = sessions.reduce((sum, session) => sum + session.correct, 0)
  const totalTime = sessions.reduce((sum, session) => sum + (session.elapsedMs ?? 0), 0)

  return (
    <div className="history">
      <div className="history__summary">
        <div><span>练习组数</span><strong>{sessions.length}</strong></div>
        <div><span>累计答题</span><strong>{totalAnswered}</strong></div>
        <div><span>累计正确率</span><strong>{formatPercent(totalAnswered ? totalCorrect / totalAnswered : null)}</strong></div>
        <div><span>累计用时</span><strong>{formatDuration(totalTime)}</strong></div>
      </div>
      <ul className="history__list">
        {visible.map((session) => {
          const accuracy = session.answered ? session.correct / session.answered : null
          const when = session.endedAt ?? session.startedAt
          return (
            <li key={session.id} className="history__row">
              <span className="history__mode">{MODE_LABEL[session.mode]}</span>
              <span className="history__scope">{session.category ?? bankNames.get(session.bankId) ?? '未知题库'}</span>
              <span className="history__num">{session.answered} 题</span>
              <span className="history__num">{formatPercent(accuracy)}</span>
              {session.elapsedMs !== undefined ? <span className="history__num">{formatDuration(session.elapsedMs)}</span> : null}
              <time className="history__when" dateTime={new Date(when).toISOString()}>
                {new Date(when).toLocaleDateString('zh-CN')}
              </time>
            </li>
          )
        })}
      </ul>
      {sessions.length > 8 ? (
        <ThemedButton type="button" className="btn btn--sm btn--ghost history__more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
          <Down size={13} strokeWidth={2} style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
          {expanded ? '收起' : `展开全部 ${sessions.length} 组`}
        </ThemedButton>
      ) : null}
    </div>
  )
}
