import type { AttemptRecord, QuestionStat, Workspace } from './types'

/**
 * 统计的键必须带上题库：两个题库里有同名题号是常事（都叫 q1），
 * 只用题号做键会让 A 库的作答记到 B 库头上，错题本和掌握度全串。
 */
export function statKey(bankId: string, questionId: string): string {
  return JSON.stringify([bankId, questionId])
}

/**
 * 读一道题在某题库里的统计。
 * 老数据里 stats 直接用题号做键，这里按题库逐个回退，保证升级后旧记录还在。
 */
export function statOf(
  workspace: Workspace,
  bankId: string,
  questionId: string,
): QuestionStat | undefined {
  const scoped = workspace.stats[statKey(bankId, questionId)]
  if (scoped) return scoped
  /* 老数据没有题库这一层：题号只在一个题库里出现过时，认下来。 */
  if (questionBelongsToOtherBank(workspace, questionId, bankId)) return undefined
  return workspace.stats[questionId]
}

/** 写入前的旧格式回退：新键下还没有记录时，老数据里那条同名记录算谁的。 */
export function legacyStatOf(
  workspace: Workspace,
  bankId: string,
  questionId: string,
): QuestionStat | undefined {
  if (workspace.stats[statKey(bankId, questionId)]) return undefined
  return statOf(workspace, bankId, questionId)
}

/** 同一个题号是不是还出现在别的题库里。是的话就不能当成老数据继承。 */
function questionBelongsToOtherBank(
  workspace: Workspace,
  questionId: string,
  bankId: string,
): boolean {
  for (const bank of workspace.banks) {
    if (bank.id === bankId) continue
    if (bank.questions.some((question) => question.id === questionId)) return true
  }
  return false
}

/**
 * 把整份统计迁移到带题库的新键。
 *
 * 旧格式的 stats 只有一个题号，没有题库维度；同名题出现在两个题库里时，
 * 根本没法拆开。所以旧数据直接用 attempts 重建——attempts 一直带 bankId，
 * 是最可靠的来源，stats 本来也只是它的缓存。
 */
export function migrateStats(workspace: Workspace): Workspace {
  const entries = Object.entries(workspace.stats ?? {})
  const legacy = entries.filter(([key, stat]) => key === stat.questionId)
  const canonicalKeys = new Set(workspace.banks.flatMap(bank => bank.questions.map(question => statKey(bank.id, question.id))))
  if (entries.every(([key]) => canonicalKeys.has(key))) return workspace

  /* 先用作答记录重建每个题库自己的统计——attempts 一直带 bankId，是最可靠的来源。 */
  const stats: Record<string, QuestionStat> = {}
  for (const attempt of [...(workspace.attempts ?? [])].sort((a, b) => a.at - b.at)) {
    const key = statKey(attempt.bankId, attempt.questionId)
    const prev = stats[key]
    const consecutiveCorrect = attempt.correct ? (prev?.consecutiveCorrect ?? 0) + 1 : 0
    stats[key] = {
      questionId: attempt.questionId,
      attempts: (prev?.attempts ?? 0) + 1,
      correctCount: (prev?.correctCount ?? 0) + (attempt.correct ? 1 : 0),
      wrongCount: (prev?.wrongCount ?? 0) + (attempt.correct ? 0 : 1),
      consecutiveCorrect,
      lastAt: Math.max(prev?.lastAt ?? 0, attempt.at),
      totalMs: (prev?.totalMs ?? 0) + (attempt.elapsedMs ?? 0),
    }
  }
  /* 旧统计里没有对应作答记录的，题号唯一时补回去。 */
  for (const [key, stat] of legacy) {
    const bankOwners = workspace.banks.filter((bank) =>
      bank.questions.some((question) => question.id === key))
    if (bankOwners.length !== 1) continue
    const nextKey = statKey(bankOwners[0].id, key)
    stats[nextKey] = { ...stat, questionId: key }
  }
  // 已迁移的统计可能包含手动移出错题本等状态，不能用历史重建覆盖。
  for (const [key, stat] of entries) {
    if (canonicalKeys.has(key)) {
      stats[key] = stat
      continue
    }
    if (key === stat.questionId) continue
    const owners = workspace.banks.filter(bank => key === `${bank.id}::${stat.questionId}`)
    if (owners.length === 1) {
      const nextKey = statKey(owners[0].id, stat.questionId)
      if (!Object.hasOwn(workspace.stats, nextKey)) stats[nextKey] = stat
    }
  }
  return { ...workspace, stats }
}

/** 这个题库里的题，各自的统计键。删题库时按这个清。 */
export function bankStatKeys(workspace: Workspace, bankId: string): string[] {
  const keys = new Set<string>()
  for (const bank of workspace.banks) {
    if (bank.id !== bankId) continue
    for (const question of bank.questions) keys.add(statKey(bank.id, question.id))
  }
  for (const attempt of workspace.attempts) {
    if (attempt.bankId === bankId) keys.add(statKey(bankId, attempt.questionId))
  }
  return [...keys]
}

/** 从旧格式里捞出这道题的作答记录（老记录的 attempts 也可能没有题库维度）。 */
export function attemptsFor(
  workspace: Workspace,
  bankId: string,
  questionId: string,
): AttemptRecord[] {
  return workspace.attempts.filter((attempt) =>
    attempt.bankId === bankId && attempt.questionId === questionId)
}
