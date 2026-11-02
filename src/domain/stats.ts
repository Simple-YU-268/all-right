import type { AttemptRecord, Bank, Mastery, Question, QuestionStat, Workspace } from './types'

export function masteryOf(stat: QuestionStat | undefined): Mastery {
  if (!stat || stat.attempts === 0) return 0
  if (stat.consecutiveCorrect === 0) return 1
  if (stat.consecutiveCorrect >= 4) return 5
  return (stat.consecutiveCorrect + 1) as Mastery
}

export function isInWrongBook(stat: QuestionStat | undefined): boolean {
  return !!stat && stat.attempts > 0 && stat.consecutiveCorrect === 0
}

export interface DayPoint {
  /** yyyy-mm-dd */
  date: string
  answered: number
  correct: number
}

export function dayKey(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dayLabel(key: string): string {
  const [, m, d] = key.split('-')
  return `${Number(m)}/${Number(d)}`
}

export function buildDailySeries(attempts: AttemptRecord[], days: number, now = Date.now()): DayPoint[] {
  const buckets = new Map<string, DayPoint>()
  const today = new Date(now)
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
    const key = dayKey(d.getTime())
    buckets.set(key, { date: key, answered: 0, correct: 0 })
  }
  for (const a of attempts) {
    const key = dayKey(a.at)
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.answered += 1
    if (a.correct) bucket.correct += 1
  }
  return [...buckets.values()]
}

export function computeStreak(attempts: AttemptRecord[], now = Date.now()): number {
  if (!attempts.length) return 0
  const days = new Set(attempts.map((a) => dayKey(a.at)))
  const cursor = new Date(now)
  let streak = 0
  // A streak stays alive if the user practised today or yesterday.
  if (!days.has(dayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(dayKey(cursor.getTime()))) return 0
  }
  while (days.has(dayKey(cursor.getTime()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export interface CategoryStat {
  name: string
  total: number
  attempted: number
  correct: number
  attempts: number
  wrong: number
  accuracy: number | null
  /** 该分类下所有题目（含没练过的）的掌握度均值，0–5 */
  mastery: number
  /** 均值取整后的墨阶，0–5 */
  masteryLevel: Mastery
}

export function computeCategoryStats(bank: Bank, workspace: Workspace): CategoryStat[] {
  const map = new Map<string, CategoryStat>()
  const masterySums = new Map<string, number>()
  const ensure = (name: string): CategoryStat => {
    let entry = map.get(name)
    if (!entry) {
      entry = {
        name,
        total: 0,
        attempted: 0,
        correct: 0,
        attempts: 0,
        wrong: 0,
        accuracy: null,
        mastery: 0,
        masteryLevel: 0,
      }
      map.set(name, entry)
    }
    return entry
  }
  for (const q of bank.questions) {
    const entry = ensure(q.category)
    entry.total += 1
    const stat = workspace.stats[q.id]
    const mastery = masteryOf(stat)
    masterySums.set(q.category, (masterySums.get(q.category) ?? 0) + mastery)
    if (stat && stat.attempts > 0) {
      entry.attempted += 1
      entry.correct += stat.correctCount
      entry.attempts += stat.attempts
      entry.wrong += stat.wrongCount
    }
  }
  const list = [...map.values()]
  for (const entry of list) {
    entry.accuracy = entry.attempts > 0 ? entry.correct / entry.attempts : null
    // 没练过的题按 0 计：一个分类的掌握度，取决于还有多少没碰过
    entry.mastery = entry.total > 0 ? (masterySums.get(entry.name) ?? 0) / entry.total : 0
    entry.masteryLevel = Math.max(0, Math.min(5, Math.round(entry.mastery))) as Mastery
  }
  list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
  return list
}

export interface DashboardData {
  totalQuestions: number
  attemptedQuestions: number
  unseenQuestions: number
  masteredQuestions: number
  wrongBookCount: number
  totalAttempts: number
  overallAccuracy: number | null
  todayAnswered: number
  todayAccuracy: number | null
  streak: number
  daily: DayPoint[]
  categories: CategoryStat[]
  masteryBuckets: number[]
  bankAttempts: AttemptRecord[]
}

export function computeDashboard(bank: Bank | null, workspace: Workspace, now = Date.now()): DashboardData {
  const bankAttempts = bank
    ? workspace.attempts.filter((a) => a.bankId === bank.id)
    : workspace.attempts
  const masteryBuckets = [0, 0, 0, 0, 0, 0]
  let attemptedQuestions = 0
  let masteredQuestions = 0
  let wrongBookCount = 0

  for (const q of bank?.questions ?? []) {
    const stat = workspace.stats[q.id]
    const m = masteryOf(stat)
    masteryBuckets[m] += 1
    if (m > 0) attemptedQuestions += 1
    if (m === 5) masteredQuestions += 1
    if (isInWrongBook(stat)) wrongBookCount += 1
  }

  const totalAttempts = bankAttempts.length
  const correctAttempts = bankAttempts.filter((a) => a.correct).length
  const today = dayKey(now)
  const todayAttempts = bankAttempts.filter((a) => dayKey(a.at) === today)
  const todayCorrect = todayAttempts.filter((a) => a.correct).length

  return {
    totalQuestions: bank?.questions.length ?? 0,
    attemptedQuestions,
    unseenQuestions: (bank?.questions.length ?? 0) - attemptedQuestions,
    masteredQuestions,
    wrongBookCount,
    totalAttempts,
    overallAccuracy: totalAttempts > 0 ? correctAttempts / totalAttempts : null,
    todayAnswered: todayAttempts.length,
    todayAccuracy: todayAttempts.length > 0 ? todayCorrect / todayAttempts.length : null,
    streak: computeStreak(bankAttempts, now),
    daily: buildDailySeries(bankAttempts, 14, now),
    categories: bank ? computeCategoryStats(bank, workspace) : [],
    masteryBuckets,
    bankAttempts,
  }
}

export interface WrongEntry {
  question: Question
  stat: QuestionStat
  mastery: Mastery
}

export function collectWrongBook(bank: Bank, workspace: Workspace): WrongEntry[] {
  const entries: WrongEntry[] = []
  for (const q of bank.questions) {
    const stat = workspace.stats[q.id]
    if (!isInWrongBook(stat)) continue
    entries.push({ question: q, stat: stat as QuestionStat, mastery: masteryOf(stat) })
  }
  entries.sort((a, b) => b.stat.wrongCount - a.stat.wrongCount || b.stat.lastAt - a.stat.lastAt)
  return entries
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${`${m}`.padStart(2, '0')}:${`${s}`.padStart(2, '0')}`
}

export function formatPercent(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}
