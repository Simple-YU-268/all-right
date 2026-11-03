/* 题库结构校验：应用导入、章节编辑、MCP 整理共用同一套规则，这里逐条盯住。 */
import assert from 'node:assert/strict'
import { loadAppModule } from './lib/load-app-module.mjs'

const { questionIssues, duplicateIdIssues } = await loadAppModule('src/domain/bankValidation.ts')
const { parseBank } = await loadAppModule('src/domain/parseBank.ts')

const baseQuestion = {
  id: 'q1',
  type: 'single',
  category: '第一章',
  stem: '题干',
  options: [
    { key: 'A', text: '甲' },
    { key: 'B', text: '乙' },
  ],
  answer: ['A'],
  explanation: '',
  difficulty: 1,
  tags: [],
}

const codes = (issues) => issues.map((issue) => issue.code)

/* 单选题塞两个答案，要被指出来。 */
const twoAnswers = questionIssues([{ ...baseQuestion, answer: ['A', 'B'] }])
assert.deepEqual(codes(twoAnswers), ['ANSWER_COUNT'])
assert.equal(twoAnswers[0].index, 1)

/* 多选题两个答案是正常的。 */
assert.deepEqual(codes(questionIssues([{ ...baseQuestion, type: 'multiple', answer: ['A', 'B'] }])), [])

/* 选项标记重复，要被指出来。 */
const duplicated = questionIssues([
  { ...baseQuestion, options: [{ key: 'A', text: '甲' }, { key: 'A', text: '乙' }] },
])
assert.deepEqual(codes(duplicated), ['DUPLICATE_OPTION'])

/* 选项没内容，要被指出来；有图块的选项算有内容。 */
const empty = questionIssues([
  { ...baseQuestion, options: [{ key: 'A', text: '' }, { key: 'B', text: '乙' }] },
])
assert.deepEqual(codes(empty), ['EMPTY_OPTION'])
assert.deepEqual(
  codes(
    questionIssues([
      {
        ...baseQuestion,
        options: [
          { key: 'A', text: '', blocks: [{ type: 'image', assetId: 'a'.repeat(64), alt: '图' }] },
          { key: 'B', text: '乙' },
        ],
      },
    ]),
  ),
  [],
)

/* 题号重复：只标后出现的那一题。 */
const duplicatedIds = duplicateIdIssues([
  { ...baseQuestion, id: 'same' },
  { ...baseQuestion, id: 'same' },
  { ...baseQuestion, id: 'other' },
])
assert.deepEqual(codes(duplicatedIds), ['DUPLICATE_ID'])
assert.equal(duplicatedIds[0].index, 2)

/* 整库导入：重复题号要拦下来，后一题被丢掉。 */
const bank = {
  name: '校验用例',
  questions: [
    { ...baseQuestion, id: 'dup', stem: '第一题' },
    { ...baseQuestion, id: 'dup', stem: '第二题' },
    { ...baseQuestion, id: 'fine', stem: '第三题' },
  ],
}
const parsedBank = parseBank(bank)
assert.equal(parsedBank.questions.length, 2)
assert.deepEqual(parsedBank.questions.map((question) => question.stem), ['第一题', '第三题'])
assert.ok(codes(parsedBank.issues).includes('DUPLICATE_ID'))
assert.deepEqual(parsedBank.sourceIndices, [0, 2])

/* 章节编辑：题号重复交给保存章节时的规则，这里不拦。 */
const parsedChapter = parseBank(bank, '校验用例', { scope: 'chapter' })
assert.equal(parsedChapter.questions.length, 3)
assert.equal(codes(parsedChapter.issues).includes('DUPLICATE_ID'), false)

/* 坏题丢掉以后，剩下的题号和源文件位置要对得上。 */
const mixed = {
  name: '混合用例',
  questions: [
    { ...baseQuestion, id: 'ok1', stem: '好题' },
    { ...baseQuestion, id: 'bad', stem: '坏题', options: [{ key: 'A', text: '' }, { key: 'B', text: '乙' }] },
    { ...baseQuestion, id: 'ok2', stem: '另一道好题' },
  ],
}
const parsedMixed = parseBank(mixed)
assert.deepEqual(parsedMixed.questions.map((question) => question.stem), ['好题', '另一道好题'])
assert.deepEqual(parsedMixed.sourceIndices, [0, 2])

/* 源文件里第几题，报错就写第几题，不是过滤后的序号。 */
const issue = parsedMixed.issues.find((entry) => entry.code === 'EMPTY_OPTION')
assert.equal(issue.index, 2)

console.log('PASS  题库结构校验：答案数量、选项重复与空选项、题号重复按作用域区分、坏题剔除后位置对齐')
