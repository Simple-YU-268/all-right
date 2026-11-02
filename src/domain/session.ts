import type { Bank, Question, SessionMode } from './types'
import type { ActiveSession } from './store'

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function isAnswerCorrect(question: Question, chosen: string[]): boolean {
  if (chosen.length !== question.answer.length) return false
  const picked = new Set(chosen)
  return question.answer.every((key) => picked.has(key))
}

export interface SessionPlan {
  mode: SessionMode
  category: string | null
  count: number
}

export function buildSession(
  bank: Bank,
  plan: SessionPlan,
  pool: Question[],
  sessionId: string,
): ActiveSession {
  let picked: Question[]
  if (plan.mode === 'random') {
    picked = shuffle(pool).slice(0, plan.count)
  } else if (plan.mode === 'category') {
    picked = pool
  } else {
    picked = pool
  }
  return {
    id: sessionId,
    bankId: bank.id,
    mode: plan.mode,
    category: plan.category,
    questionIds: picked.map((q) => q.id),
    index: 0,
    startedAt: Date.now(),
    answers: {},
    questionStartedAt: Date.now(),
  }
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
