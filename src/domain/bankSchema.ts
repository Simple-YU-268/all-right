import { z } from 'zod'

/** 导出给 Agent 的标准题库结构：字段名固定，类型收紧。 */
export const bankSchema = z.object({
  name: z.string().min(1).describe('题库名称，显示在题库列表里'),
  questions: z.array(
    z.object({
      id: z.string().min(1).describe('全题库唯一的题目编号'),
      type: z.enum(['single', 'multiple', 'judge']).describe('题型：单选、多选、判断'),
      category: z.string().min(1).describe('章节名，同名即同一章'),
      stem: z.string().min(1).describe('题干文字'),
      options: z
        .array(z.object({ key: z.string().min(1).describe('选项标记，如 A'), text: z.string().describe('选项文字') }))
        .min(2)
        .describe('选项；判断题固定用 正确 / 错误'),
      answer: z.array(z.string().min(1)).min(1).describe('正确答案，必须出现在选项 key 里；判断题写 正确 或 错误'),
      explanation: z.string().describe('解析，没有就留空字符串，不要自己编'),
      difficulty: z.number().int().min(1).max(5).describe('难度 1–5'),
      tags: z.array(z.string()).describe('知识点标签，没有就空数组'),
    }),
  ).min(1),
})

export type BankDocument = z.infer<typeof bankSchema>

/** 供 scripts/generate-bank-schema.mjs 生成 src/domain/bankSchema.json，界面只读那份 JSON。 */
export const BANK_JSON_SCHEMA = z.toJSONSchema(bankSchema, {
  target: 'draft-2020-12',
  io: 'output',
})
