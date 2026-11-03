import type { Question } from './types'

export interface BankIssue {
  code: string
  /** 源文件里的第几题（1 起）；0 表示整个文件。 */
  index: number
  field: string
  message: string
}

/** 选项是否真的有内容：文字或图片块都算。 */
function optionHasContent(option: Question['options'][number]): boolean {
  return Boolean(option.text) || Boolean(option.blocks?.length)
}

/**
 * 单题自身的问题：答案数量对不上、选项键重复、选项没内容。
 * 与作用域无关，任何入口都要查。
 */
export function questionIssues(questions: Question[], sourceIndices?: number[]): BankIssue[] {
  const issues: BankIssue[] = []
  questions.forEach((question, position) => {
    const index = (sourceIndices?.[position] ?? position) + 1
    if (question.type !== 'multiple' && question.answer.length !== 1) {
      issues.push({
        code: 'ANSWER_COUNT',
        index,
        field: 'answer',
        message: `是${question.type === 'judge' ? '判断题' : '单选题'}，但答案有 ${question.answer.length} 个。`,
      })
    }
    const keys = new Set<string>()
    question.options.forEach((option) => {
      const key = option.key.toUpperCase()
      if (keys.has(key)) {
        issues.push({ code: 'DUPLICATE_OPTION', index, field: 'options', message: `选项 ${option.key} 重复了。` })
      }
      keys.add(key)
    })
    if (question.options.some((option) => !optionHasContent(option))) {
      issues.push({ code: 'EMPTY_OPTION', index, field: 'options', message: '有选项没有内容。' })
    }
  })
  return issues
}

/**
 * 题号重复要看作用域：整库重复要拦下来，章节内部的重复交给章节保存时的规则，
 * 那边的提示更具体（会说明是「待保存章节」里的重复）。
 */
export function duplicateIdIssues(questions: Question[], sourceIndices?: number[]): BankIssue[] {
  const issues: BankIssue[] = []
  const seen = new Set<string>()
  questions.forEach((question, position) => {
    const index = (sourceIndices?.[position] ?? position) + 1
    if (seen.has(question.id)) {
      issues.push({ code: 'DUPLICATE_ID', index, field: 'id', message: `编号 ${question.id} 在本题库里重复了。` })
    }
    seen.add(question.id)
  })
  return issues
}

/** 有结构问题的题不能进题库，否则练习记录和错题本会串题。 */
export function dropBrokenQuestions(
  questions: Question[],
  sourceIndices?: number[],
  issues: BankIssue[] = [],
): { questions: Question[]; sourceIndices: number[]; issues: BankIssue[] } {
  const broken = new Set(issues.map((issue) => issue.index))
  const kept: Question[] = []
  const keptIndices: number[] = []
  questions.forEach((question, position) => {
    const index = sourceIndices?.[position] ?? position
    if (broken.has(index + 1)) return
    kept.push(question)
    keptIndices.push(index)
  })
  return { questions: kept, sourceIndices: keptIndices, issues }
}
