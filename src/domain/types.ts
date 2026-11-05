export type QuestionType = 'single' | 'multiple' | 'judge'

/** 内容块：题干、选项、解析既能是纯文字，也能图文交替。 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; assetId: string; alt: string }

export interface Option {
  key: string
  text: string
  /** 有内容块时按内容块排版，没有就退回 text。 */
  blocks?: ContentBlock[]
}

export interface Question {
  id: string
  type: QuestionType
  stem: string
  stemBlocks?: ContentBlock[]
  options: Option[]
  answer: string[]
  explanation: string
  explanationBlocks?: ContentBlock[]
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

/** 一张图片的登记信息：内容哈希当 ID，字节数只用来显示体积。 */
export interface AssetMeta {
  mime: string
  bytes: number
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
  /** 本组一共花了多久（毫秒）。 */
  elapsedMs?: number
}

export interface Workspace {
  activeSession?: import('./store').ActiveSession | null
  version: 2
  banks: Bank[]
  activeBankId: string | null
  attempts: AttemptRecord[]
  stats: Record<string, QuestionStat>
  sessions: SessionRecord[]
  /** 工作区里用到的图片清单；图片本体存在资源仓库里，不塞进这份 JSON。 */
  assets: Record<string, AssetMeta>
}

export const EMPTY_WORKSPACE: Workspace = {
  version: 2,
  banks: [],
  activeBankId: null,
  attempts: [],
  stats: {},
  sessions: [],
  assets: {},
}

export const MASTERY_LABELS = ['未练习', '生疏', '眼熟', '熟练', '牢固', '已掌握'] as const

export type Mastery = 0 | 1 | 2 | 3 | 4 | 5
