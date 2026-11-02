import type { Option, Question, QuestionType } from './types'

export interface ParseIssue {
  /** 1-based index of the offending question inside the source array. */
  index: number
  field: string
  message: string
}

export interface ParsedBank {
  name: string
  questions: Question[]
  issues: ParseIssue[]
  /** Questions that parsed cleanly, offered to the user when issues exist. */
  valid: Question[]
}

const STEM_KEYS = ['stem', 'question', 'title', '题干', '题目', '问题', 'content']
const OPTIONS_KEYS = ['options', 'choices', '选项', 'answers', 'answersList']
const ANSWER_KEYS = ['answer', 'correct', 'correctAnswer', '答案', '正确答案', 'right']
const EXPLANATION_KEYS = ['explanation', 'analysis', '解析', '答案解析', '说明', 'note']
const CATEGORY_KEYS = ['category', 'chapter', 'section', '分类', '章节', '目录', 'knowledge']
const TAG_KEYS = ['tags', 'label', 'labels', '标签', '知识点']
const DIFFICULTY_KEYS = ['difficulty', 'level', '难度', 'star', 'stars']
const ID_KEYS = ['id', 'key', 'code', '编号', '题号']

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key]
  }
  return undefined
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

const TYPE_ALIASES: Record<string, QuestionType> = {
  single: 'single',
  单选: 'single',
  单选题: 'single',
  multiple: 'multiple',
  multi: 'multiple',
  多选: 'multiple',
  多选题: 'multiple',
  judge: 'judge',
  truefalse: 'judge',
  boolean: 'judge',
  判断: 'judge',
  判断题: 'judge',
}

function resolveType(raw: unknown): QuestionType | null {
  const text = asText(raw).toLowerCase().replace(/[\s_-]/g, '')
  if (!text) return null
  return TYPE_ALIASES[text] ?? null
}

const DIFFICULTY_WORDS: Record<string, number> = {
  easy: 1,
  简单: 1,
  容易: 1,
  medium: 3,
  normal: 3,
  中等: 3,
  普通: 3,
  hard: 5,
  difficult: 5,
  困难: 5,
  难: 5,
}

function resolveDifficulty(raw: unknown): number {
  const text = asText(raw).toLowerCase()
  if (!text) return 3
  if (DIFFICULTY_WORDS[text]) return DIFFICULTY_WORDS[text]
  const num = Number(text)
  if (Number.isFinite(num) && num >= 1 && num <= 5) return Math.round(num)
  return 3
}

function normalizeOptions(raw: unknown): Option[] | null {
  if (raw === undefined || raw === null) return null
  if (Array.isArray(raw)) {
    return raw.map((entry, i) => {
      if (typeof entry === 'string' || typeof entry === 'number') {
        return { key: String.fromCharCode(65 + i), text: asText(entry) }
      }
      if (entry && typeof entry === 'object') {
        const rec = entry as Record<string, unknown>
        const text = asText(pick(rec, ['text', 'value', 'label', 'content', '选项', '文本']))
        const key = asText(pick(rec, ['key', 'label', 'id', '字母', '编号']))
        return { key: key || String.fromCharCode(65 + i), text }
      }
      return { key: String.fromCharCode(65 + i), text: '' }
    })
  }
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>).map(([key, value]) => ({
      key: key.trim().toUpperCase(),
      text: asText(value),
    }))
  }
  return null
}

function normalizeAnswer(raw: unknown): string[] {
  if (raw === undefined || raw === null) return []
  if (typeof raw === 'boolean') return [raw ? '正确' : '错误']
  if (typeof raw === 'number') {
    // 1-based index into A/B/C/D…
    return [String.fromCharCode(64 + raw)]
  }
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => normalizeAnswer(entry))
  }
  const text = asText(raw)
  if (!text) return []
  if (/^(正确|对|true|是|yes|y|t)$/i.test(text)) return ['正确']
  if (/^(错误|错|false|否|no|n|f)$/i.test(text)) return ['错误']
  // "A", "AB", "A,C", "A C" → split into single letters
  const letters = text
    .replace(/[，,\s、|]+/g, '')
    .split('')
    .map((c) => c.toUpperCase())
    .filter((c) => /[A-Z]/.test(c))
  if (letters.length) return [...new Set(letters)]
  return [text]
}

function normalizeTags(raw: unknown): string[] {
  if (raw === undefined || raw === null) return []
  if (Array.isArray(raw)) return raw.map(asText).filter(Boolean)
  const text = asText(raw)
  if (!text) return []
  return text
    .split(/[,，;；|]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

let counter = 0
function fallbackId(bankName: string, index: number): string {
  counter += 1
  return `${bankName}::${index}-${counter.toString(36)}`
}

export function parseBank(raw: unknown, fallbackName = '未命名题库'): ParsedBank {
  const issues: ParseIssue[] = []
  const valid: Question[] = []

  let bankName = fallbackName
  let rawQuestions: unknown[] = []
  let defaultCategory = ''

  if (Array.isArray(raw)) {
    rawQuestions = raw
  } else if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>
    bankName = asText(pick(rec, ['name', 'title', 'bank', '题库名', '题库', 'name_zh'])) || fallbackName
    defaultCategory = asText(pick(rec, ['category', 'chapter', '分类', '章节']))
    const list = pick(rec, ['questions', 'items', 'data', 'list', '题目', '试题'])
    if (Array.isArray(list)) rawQuestions = list
    else if (Array.isArray(rec)) rawQuestions = []
    else {
      issues.push({ index: 0, field: 'questions', message: '题库根节点里找不到题目数组。' })
    }
  } else {
    issues.push({ index: 0, field: 'root', message: 'JSON 根节点既不是数组也不是对象。' })
    return { name: bankName, questions: [], issues, valid: [] }
  }

  rawQuestions.forEach((entry, i) => {
    const index = i + 1
    if (!entry || typeof entry !== 'object') {
      issues.push({ index, field: '题目', message: '不是对象，无法解析。' })
      return
    }
    const rec = entry as Record<string, unknown>

    const stem = asText(pick(rec, STEM_KEYS))
    if (!stem) {
      issues.push({ index, field: 'stem', message: '缺少题干。' })
      return
    }

    let options = normalizeOptions(pick(rec, OPTIONS_KEYS))
    let type = resolveType(pick(rec, ['type', '题型', 'questionType']))
    const rawAnswer = pick(rec, ANSWER_KEYS)
    let answer = normalizeAnswer(rawAnswer)

    if (!options || options.length === 0) {
      if (type === 'judge') {
        options = [
          { key: '正确', text: '正确' },
          { key: '错误', text: '错误' },
        ]
      } else {
        issues.push({ index, field: 'options', message: '缺少选项。' })
        return
      }
    }

    const optionKeys = options.map((o) => o.key)
    const allOptionsEmpty = options.every((o) => !o.text)
    if (allOptionsEmpty) {
      issues.push({ index, field: 'options', message: '选项内容全为空。' })
      return
    }

    if (!answer.length) {
      issues.push({ index, field: 'answer', message: '缺少正确答案。' })
      return
    }

    // Judge questions whose options are 正确/错误 map onto 正确/错误 keys.
    const judgeLike =
      options.length === 2 &&
      options.every((o) => o.key === '正确' || o.key === '错误' || o.text === '正确' || o.text === '错误')

    let optionList: Option[]
    if (judgeLike) {
      optionList = [
        { key: '正确', text: '正确' },
        { key: '错误', text: '错误' },
      ]
      answer = answer.map((a) => (a === '对' || a === 'T' || a === '是' ? '正确' : '错误'))
      if (!answer.length) {
        issues.push({ index, field: 'answer', message: '判断题答案无法识别。' })
        return
      }
      type = 'judge'
    } else {
      optionList = options
      const known = new Set(optionKeys.map((k) => k.toUpperCase()))
      const unknown = answer.filter((a) => !known.has(a.toUpperCase()))
      if (unknown.length) {
        issues.push({
          index,
          field: 'answer',
          message: `答案里的 ${unknown.join('、')} 在选项中不存在（现有选项：${optionKeys.join('、')}）。`,
        })
        return
      }
      answer = answer.map((a) => {
        const match = optionList.find((o) => o.key.toUpperCase() === a.toUpperCase())
        return match ? match.key : a
      })
      if (!type) type = answer.length > 1 ? 'multiple' : 'single'
    }

    const id = asText(pick(rec, ID_KEYS)) || fallbackId(bankName, index)
    const category = asText(pick(rec, CATEGORY_KEYS)) || defaultCategory || '未分类'

    valid.push({
      id,
      type: type ?? 'single',
      stem,
      options: optionList,
      answer,
      explanation: asText(pick(rec, EXPLANATION_KEYS)),
      category,
      tags: normalizeTags(pick(rec, TAG_KEYS)),
      difficulty: resolveDifficulty(pick(rec, DIFFICULTY_KEYS)),
    })
  })

  return { name: bankName, questions: valid, issues, valid }
}

export function readBankFile(text: string, fallbackName: string): ParsedBank {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      name: fallbackName,
      questions: [],
      valid: [],
      issues: [{ index: 0, field: 'JSON', message: `JSON 解析失败：${message}` }],
    }
  }
  return parseBank(raw, fallbackName)
}
