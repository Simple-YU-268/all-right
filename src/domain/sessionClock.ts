import type { ActiveSession } from './store'

/**
 * 秒表单独记在 store 外面。
 *
 * 计时每秒动一次，如果把这个变化放进工作区状态，每次 tick 都会触发整份
 * 工作区序列化写盘——练习十分钟就是几百次磁盘写入。改成：
 * - 秒表在模块里自己累加，界面从它读，读数照样每秒走；
 * - 只有真正需要落盘的时刻（切题、提交、作答记录变化）才把它合并进会话。
 */
export interface SessionClock {
  /** 本次练习累计毫秒。 */
  elapsedMs: number
  /** 每题累计毫秒，键是题号。 */
  elapsedByQuestion: Record<string, number>
  /** 上一次记账的时刻。 */
  lastTickAt: number
  /** 当前题目的起算时刻。 */
  questionStartedAt: number
  paused: boolean
}

export function createClock(session: ActiveSession): SessionClock {
  return {
    elapsedMs: session.elapsedMs ?? 0,
    elapsedByQuestion: { ...(session.elapsedByQuestion ?? {}) },
    lastTickAt: Date.now(),
    questionStartedAt: session.questionStartedAt ?? Date.now(),
    paused: !!session.paused,
  }
}

/** 当前题在秒表里已经走了多久。 */
export function currentQuestionElapsed(clock: SessionClock, questionId: string, answeredMs?: number): number {
  if (answeredMs !== undefined) return answeredMs
  const base = clock.elapsedByQuestion[questionId] ?? 0
  if (clock.paused) return base
  return base + Math.max(0, Date.now() - clock.questionStartedAt)
}

/** 本次练习一共走了多久。 */
export function sessionElapsed(clock: SessionClock): number {
  if (clock.paused) return clock.elapsedMs
  return clock.elapsedMs + Math.max(0, Date.now() - clock.lastTickAt)
}

/** 把秒表累加到当前时刻。暂停时不走表。 */
export function tickClock(clock: SessionClock): SessionClock {
  const now = Date.now()
  if (clock.paused) return { ...clock, lastTickAt: now }
  const delta = Math.max(0, now - clock.lastTickAt)
  return {
    ...clock,
    elapsedMs: clock.elapsedMs + delta,
    lastTickAt: now,
  }
}

/** 切题：把上一题的时间落账，从新题重新起算。 */
export function switchQuestion(
  clock: SessionClock,
  previousQuestionId: string | null,
): SessionClock {
  const now = Date.now()
  const next = tickClock(clock)
  const elapsedByQuestion = { ...next.elapsedByQuestion }
  if (previousQuestionId && !next.paused) {
    elapsedByQuestion[previousQuestionId] = (elapsedByQuestion[previousQuestionId] ?? 0) +
      Math.max(0, now - next.questionStartedAt)
  }
  return { ...next, elapsedByQuestion, questionStartedAt: now }
}

/** 暂停或继续。currentQuestionId 用来在暂停时把当前题的时间落账。 */
export function setPaused(clock: SessionClock, paused: boolean, currentQuestionId?: string): SessionClock {
  if (clock.paused === paused) return clock
  const next = tickClock(clock)
  if (paused) {
    /* 暂停时把当前题的时间落账，恢复时重新起算，暂停期间不计入。 */
    const elapsedByQuestion = { ...next.elapsedByQuestion }
    if (currentQuestionId && !clock.paused) {
      elapsedByQuestion[currentQuestionId] = (elapsedByQuestion[currentQuestionId] ?? 0) +
        Math.max(0, Date.now() - clock.questionStartedAt)
    }
    return { ...next, paused: true, elapsedByQuestion }
  }
  return { ...next, paused: false, questionStartedAt: Date.now() }
}

/** 把秒表合并回会话，准备落盘。 */
export function commitClock(clock: SessionClock, session: ActiveSession): ActiveSession {
  const now = Date.now()
  const id = session.questionIds[session.index]
  const elapsedByQuestion = { ...clock.elapsedByQuestion }
  if (id && !clock.paused && !session.answers[id]) {
    elapsedByQuestion[id] = (elapsedByQuestion[id] ?? 0) + Math.max(0, now - clock.questionStartedAt)
  }
  return {
    ...session,
    paused: clock.paused,
    clockAt: now,
    elapsedMs: sessionElapsed(clock),
    elapsedByQuestion,
    questionStartedAt: clock.questionStartedAt,
  }
}
