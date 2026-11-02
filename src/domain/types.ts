export type QuestionType = 'single' | 'multiple' | 'judge'

export interface Option {
  key: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  stem: string
  options: Option[]
  answer: string[]
  explanation: string
  category: string
  tags: string[]
  difficulty: number
}

export interface Bank {
  id: string
  name: string
  importedAt: number
  questions: Question[]
}

export interface AttemptRecord {
  id: string
  bankId: string
  questionId: string
  chosen: string[]
  correct: boolean
  at: number
  elapsedMs: number
}

export interface QuestionStat {
  questionId: string
  attempts: number
  correctCount: number
  wrongCount: number
  consecutiveCorrect: number
  lastAt: number
  totalMs: number
}

export type SessionMode = 'random' | 'category' | 'wrong'

export interface SessionRecord {
  id: string
  bankId: string
  mode: SessionMode
  category: string | null
  startedAt: number
  endedAt: number | null
  total: number
  answered: number
  correct: number
}

export interface Workspace {
  version: 1
  banks: Bank[]
  activeBankId: string | null
  attempts: AttemptRecord[]
  stats: Record<string, QuestionStat>
  sessions: SessionRecord[]
}

export const EMPTY_WORKSPACE: Workspace = {
  version: 1,
  banks: [],
  activeBankId: null,
  attempts: [],
  stats: {},
  sessions: [],
}

export const MASTERY_LABELS = ['未练习', '生疏', '眼熟', '熟练', '牢固', '已掌握'] as const

export type Mastery = 0 | 1 | 2 | 3 | 4 | 5
