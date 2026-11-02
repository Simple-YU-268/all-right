import type { Question, Workspace } from './types'

export interface ChapterChange {
  bankId: string
  category: string | null
  name: string
  mode: 'create' | 'append' | 'replace'
  questions: Question[]
}

export interface ChapterImport {
  bankId: string
  questions: Question[]
}

export interface ChapterResult {
  workspace: Workspace
  invalidatedIds: Set<string>
  bankId: string
  previousCategory: string | null
  category: string | null
}

function sameQuestion(left: Question, right: Question): boolean {
  return left.type === right.type && left.stem === right.stem &&
    JSON.stringify(left.options) === JSON.stringify(right.options) &&
    JSON.stringify([...left.answer].sort()) === JSON.stringify([...right.answer].sort())
}

function updateQuestions(
  workspace: Workspace, bankId: string, questions: Question[], invalidatedIds: Set<string>,
  previousCategory: string | null, category: string | null,
): ChapterResult {
  const banks = workspace.banks.map((bank) => bank.id === bankId ? { ...bank, questions } : bank)
  const otherChapterIds = new Set(questions.filter((question) => question.category !== category).map((question) => question.id))
  const otherQuestionIds = new Set([
    ...otherChapterIds,
    ...banks.filter((bank) => bank.id !== bankId).flatMap((bank) => bank.questions.map((question) => question.id)),
  ])
  const stats = { ...workspace.stats }
  for (const questionId of invalidatedIds) {
    if (!otherQuestionIds.has(questionId)) delete stats[questionId]
  }
  return {
    bankId, previousCategory, category, invalidatedIds,
    workspace: {
      ...workspace, banks, stats,
      attempts: workspace.attempts.filter((attempt) => attempt.bankId !== bankId ||
        !invalidatedIds.has(attempt.questionId) || otherChapterIds.has(attempt.questionId)),
      sessions: workspace.sessions
        .filter((session) => !(category === null && session.bankId === bankId && session.category === previousCategory))
        .map((session) => session.bankId === bankId && session.category === previousCategory && previousCategory !== null
          ? { ...session, category } : session),
    },
  }
}

export function saveChapter(workspace: Workspace, change: ChapterChange): ChapterResult {
  const bank = workspace.banks.find((entry) => entry.id === change.bankId)
  if (!bank) throw new Error('题库不存在，请重新打开章节管理。')
  const name = change.name.trim()
  if (!name) throw new Error('请填写章节名称。')
  if (!change.questions.length) throw new Error('章节至少需要一道有效题目；清空章节请使用删除章节。')
  const oldQuestions = bank.questions.filter((question) => question.category === change.category)
  if (change.mode !== 'create' && !oldQuestions.length) throw new Error('原章节不存在，请重新打开章节管理。')
  if (change.mode === 'append' && name !== change.category) throw new Error('追加题目不能同时重命名章节。')
  if ((change.mode === 'create' || name !== change.category) && bank.questions.some((question) => question.category === name)) {
    throw new Error('已存在同名章节，请在该章使用「导入题目」追加，或换一个名称。')
  }
  const incomingIds = change.questions.map((question) => question.id)
  if (new Set(incomingIds).size !== incomingIds.length) throw new Error('待保存章节中存在重复题号，请先修改 JSON 中的 id。')

  const oldById = new Map(oldQuestions.map((question) => [question.id, question]))
  const otherQuestionIds = new Set(workspace.banks.flatMap((entry) => entry.questions
    .filter((question) => entry.id !== bank.id || question.category !== change.category).map((question) => question.id)))
  const usedIds = new Set([
    ...workspace.banks.flatMap((entry) => entry.questions.map((question) => question.id)),
    ...Object.keys(workspace.stats), ...workspace.attempts.map((attempt) => attempt.questionId),
  ])
  const invalidatedIds = new Set<string>()
  const retainedIds = new Set<string>()
  const imported = change.questions.map((question) => {
    const previous = change.mode === 'replace' ? oldById.get(question.id) : undefined
    const unchanged = previous !== undefined && sameQuestion(previous, question)
    const retainId = previous !== undefined && (unchanged || !otherQuestionIds.has(question.id))
    let questionId = question.id
    if (!retainId) {
      let suffix = 2
      while (usedIds.has(questionId)) {
        questionId = `${question.id}~${suffix}`
        suffix += 1
      }
    }
    usedIds.add(questionId)
    if (previous) {
      retainedIds.add(previous.id)
      if (!unchanged) invalidatedIds.add(previous.id)
    }
    return { ...question, id: questionId, category: name }
  })
  if (change.mode === 'replace') {
    for (const question of oldQuestions) if (!retainedIds.has(question.id)) invalidatedIds.add(question.id)
  }

  let questions: Question[]
  if (change.mode === 'create') {
    questions = [...bank.questions, ...imported]
  } else if (change.mode === 'append') {
    const lastIndex = bank.questions.reduce((last, question, index) => question.category === change.category ? index : last, -1)
    questions = [...bank.questions.slice(0, lastIndex + 1), ...imported, ...bank.questions.slice(lastIndex + 1)]
  } else {
    const firstIndex = bank.questions.findIndex((question) => question.category === change.category)
    questions = bank.questions.flatMap((question, index) => index === firstIndex ? imported
      : question.category === change.category ? [] : [question])
  }
  return updateQuestions(workspace, bank.id, questions, invalidatedIds, change.category, name)
}

export function deleteChapter(workspace: Workspace, bankId: string, category: string): ChapterResult {
  const bank = workspace.banks.find((entry) => entry.id === bankId)
  if (!bank) throw new Error('题库不存在。')
  const deleted = bank.questions.filter((question) => question.category === category)
  if (!deleted.length) throw new Error('章节不存在。')
  return updateQuestions(workspace, bankId, bank.questions.filter((question) => question.category !== category),
    new Set(deleted.map((question) => question.id)), category, null)
}

export function importChapters(workspace: Workspace, change: ChapterImport): ChapterResult {
  if (!change.questions.length) throw new Error('请至少选择一个包含题目的章节。')
  const chapters = new Map<string, Question[]>()
  for (const question of change.questions) {
    const category = question.category.trim() || '未分类'
    const questions = chapters.get(category) ?? []
    questions.push(question)
    chapters.set(category, questions)
  }
  let updated = workspace
  for (const [category, questions] of chapters) {
    const bank = updated.banks.find((entry) => entry.id === change.bankId)
    if (!bank) throw new Error('题库不存在，请重新打开章节管理。')
    const exists = bank.questions.some((question) => question.category === category)
    updated = saveChapter(updated, {
      bankId: change.bankId, category: exists ? category : null,
      name: category, mode: exists ? 'append' : 'create', questions,
    }).workspace
  }
  return {
    workspace: updated, bankId: change.bankId, invalidatedIds: new Set(),
    previousCategory: null, category: null,
  }
}
