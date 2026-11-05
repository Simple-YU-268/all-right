import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const question = (id, category) => ({
  id, category, type: 'single', stem: `${category} · ${id}`,
  options: [{ key: 'A', text: '正确选项' }, { key: 'B', text: '错误选项' }],
  answer: ['A'], explanation: '原解析', difficulty: 2, tags: [],
})
const original = {
  version: 1, activeBankId: 'alpha',
  banks: [
    { id: 'alpha', name: '单章管理题库', importedAt: 1, questions: [
      question('shared', '第一章'), question('a1', '第一章'), question('a2', '第一章'), question('b1', '第二章'),
    ] },
    { id: 'beta', name: '其他题库', importedAt: 2, questions: [question('shared', '独立章')] },
  ],
  attempts: ['shared', 'a1', 'a2', 'b1'].map((questionId) => ({
    id: `attempt-${questionId}`, questionId, bankId: 'alpha', chosen: ['B'], correct: false, at: 100, elapsedMs: 500,
  })).concat([{ id: 'other-attempt', questionId: 'shared', bankId: 'beta', chosen: ['B'], correct: false, at: 100, elapsedMs: 500 }]),
  stats: Object.fromEntries(['shared', 'a1', 'a2', 'b1'].map((questionId) => [questionId, {
    questionId, attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
  }])),
  sessions: ['第一章', '第二章'].map((category) => ({
    id: `history-${category}`, bankId: 'alpha', mode: 'category', category,
    startedAt: 1, endedAt: 2, total: 1, answered: 1, correct: 0,
  })),
}
const browser = await chromium.launch({
  executablePath: process.env.EDGE_PATH ?? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: true,
})

/* 统计键现在带题库：「题库::题号」。同名题在两个题库里各算各的。 */
const statOf = (stats, bankId, questionId) => stats[`${bankId}::${questionId}`]
const alphaStat = (questionId) => ({
  questionId, attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
})

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(process.env.ALLRIGHT_TEST_URL ?? 'http://127.0.0.1:5173/')
  await page.getByRole('navigation').waitFor()
  await page.evaluate((workspace) => localStorage.setItem('allright.workspace.v1', JSON.stringify(workspace)), original)
  await page.reload()
  const navigate = (name) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  const bank = page.locator('.bankrow').filter({ hasText: '单章管理题库' })
  const editor = bank.locator('.chapter-editor')
  const row = (category) => bank.locator('.chapter-row').filter({ has: page.getByText(category, { exact: true }) })
  const workspace = () => page.evaluate(() => JSON.parse(localStorage.getItem('allright.workspace.v1')))
  const expand = async () => {
    if (!await bank.locator('details').evaluate((details) => details.open)) await bank.locator('summary').click()
  }
  const save = async () => {
    await editor.getByRole('button', { name: '保存章节', exact: true }).click()
    await editor.waitFor({ state: 'detached' })
  }
  const upload = async (data) => {
    const content = JSON.stringify(data)
    await editor.getByLabel('章节 JSON 文件', { exact: true }).setInputFiles({
      name: 'chapter.json', mimeType: 'application/json', buffer: Buffer.from(content),
    })
    /* 文件是异步读的：等编辑框真的写上去了，后面那些断言才不会踩空 */
    await page.waitForFunction((expected) => {
      const area = document.querySelector('.chapter-editor__json')
      return area?.value === expected
    }, content)
  }
  const confirmNext = (accept) => page.once('dialog', (dialog) => accept ? dialog.accept() : dialog.dismiss())

  await navigate('练习')
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').first().click()
  await page.locator('.practice__counter').waitFor()
  await navigate('题库')
  await expand()
  await row('第一章').getByRole('button', { name: '编辑章节', exact: true }).click()
  await editor.getByLabel('章节名称', { exact: true }).fill('第一章 已改名')
  await save()
  let current = await workspace()
  /* 改名不该动统计：键已经是「题库::题号」。 */
  assert.deepEqual(current.stats, {
    'alpha::shared': alphaStat('shared'),
    'alpha::a1': alphaStat('a1'),
    'alpha::a2': alphaStat('a2'),
    'alpha::b1': alphaStat('b1'),
    'beta::shared': {
      questionId: 'shared', attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
    },
  })
  assert.deepEqual(current.attempts, original.attempts)
  assert.equal(current.sessions[0].category, '第一章 已改名')
  assert.deepEqual([...new Set(current.banks[0].questions.map((entry) => entry.category))], ['第一章 已改名', '第二章'])
  await navigate('练习')
  await page.getByRole('button', { name: '继续练习', exact: true }).click()
  assert.equal(await page.locator('.practice__counter').count(), 1)
  await navigate('题库')
  current = await workspace()
  await expand()

  await row('第一章 已改名').getByRole('button', { name: '编辑章节', exact: true }).click()
  await editor.getByLabel('章节名称', { exact: true }).fill('第二章')
  await editor.getByRole('button', { name: '保存章节', exact: true }).click()
  assert.match(await editor.getByRole('alert').innerText(), /同名章节/)
  assert.deepEqual(await workspace(), current)
  await editor.getByLabel('章节题目 JSON', { exact: true }).fill('{')
  assert.equal(await editor.getByRole('button', { name: '保存章节', exact: true }).isDisabled(), true)
  await editor.getByRole('button', { name: '取消编辑', exact: true }).click()
  assert.deepEqual(await workspace(), current)

  await row('第一章 已改名').getByRole('button', { name: '编辑章节', exact: true }).click()
  const editedQuestions = current.banks[0].questions.filter((entry) => entry.category === '第一章 已改名' && entry.id !== 'a2')
    .map((entry) => ({ ...entry, stem: `${entry.stem}（修订）` }))
  await editor.getByLabel('章节题目 JSON', { exact: true }).fill(JSON.stringify({ questions: editedQuestions }))
  confirmNext(false)
  await editor.getByRole('button', { name: '保存章节', exact: true }).click()
  assert.deepEqual(await workspace(), current)
  confirmNext(true)
  await save()
  current = await workspace()
  assert.equal(current.banks[0].questions.length, 3)
  assert.equal(current.banks[0].questions.find((entry) => entry.stem.includes('shared')).id, 'shared~2')
  /* 甲库的 shared 改了题干，它的统计要作废；乙库的同名题不受影响。 */
  assert.equal(statOf(current.stats, 'alpha', 'shared'), undefined)
  assert.deepEqual(statOf(current.stats, 'beta', 'shared'), {
    questionId: 'shared', attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
  })
  assert.deepEqual(statOf(current.stats, 'alpha', 'b1'), alphaStat('b1'))
  assert.equal(statOf(current.stats, 'alpha', 'a1'), undefined)
  assert.equal(statOf(current.stats, 'alpha', 'a2'), undefined)
  assert.deepEqual(current.attempts.map((attempt) => attempt.id), ['attempt-b1', 'other-attempt'])
  await navigate('练习')
  assert.equal(await page.locator('.practice__counter').count(), 0)
  await navigate('题库')
  await expand()

  await row('第一章 已改名').getByRole('button', { name: '导入题目', exact: true }).click()
  await upload({ questions: [question('b1', '来源章')] })
  await save()
  current = await workspace()
  assert.equal(current.banks.length, 2)
  assert.equal(current.banks[0].questions.length, 4)
  assert.equal(current.banks[0].questions[2].id, 'b1~2')
  assert.equal(current.banks[0].questions[2].category, '第一章 已改名')
  assert.deepEqual(current.banks[0].questions.at(-1), original.banks[0].questions.at(-1))

  await row('第二章').getByRole('button', { name: '导入题目', exact: true }).click()
  await editor.getByLabel('替换该章', { exact: true }).check()
  await upload({ questions: [{ ...current.banks[0].questions.find((entry) => entry.id === 'b1'), category: '外部章节', explanation: '仅修订解析' }] })
  await save()
  current = await workspace()
  assert.deepEqual(statOf(current.stats, 'alpha', 'b1'), alphaStat('b1'))
  assert.equal(current.banks[0].questions.find((entry) => entry.id === 'b1').explanation, '仅修订解析')

  await bank.getByRole('button', { name: '导入章节', exact: true }).click()
  await upload({ questions: [question('x1', '外部章一'), question('b1', '外部章二')] })
  assert.equal(await editor.getByRole('checkbox', { checked: true }).count(), 2)
  await editor.getByRole('button', { name: '清空选择', exact: true }).click()
  assert.equal(await editor.getByRole('button', { name: '保存章节', exact: true }).isDisabled(), true)
  await editor.getByRole('checkbox', { name: /外部章二/ }).check()
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1), true)
  if (process.env.ALLRIGHT_CHAPTER_SCREENSHOT) {
    await editor.getByRole('button', { name: '保存章节', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: process.env.ALLRIGHT_CHAPTER_SCREENSHOT })
  }
  await save()
  await page.setViewportSize({ width: 1280, height: 900 })
  await row('外部章二').getByRole('button', { name: '编辑章节', exact: true }).click()
  await editor.getByLabel('章节名称', { exact: true }).fill('新章节')
  await save()
  current = await workspace()
  assert.equal(current.banks.length, 2)
  assert.equal(current.banks[0].questions.filter((entry) => entry.category === '新章节').length, 1)
  assert.equal(current.banks[0].questions.some((entry) => entry.id === 'x1'), false)
  assert.equal(current.banks[0].questions.at(-1).id, 'b1~3')

  await bank.getByRole('button', { name: '导入章节', exact: true }).click()
  await upload({ questions: [question('duplicate', '重复题号章'), question('duplicate', '重复题号章')] })
  await editor.getByRole('button', { name: '保存章节', exact: true }).click()
  assert.match(await editor.getByRole('alert').innerText(), /重复题号/)
  assert.deepEqual(await workspace(), current)
  await editor.getByRole('button', { name: '取消编辑', exact: true }).click()

  const downloadPromise = page.waitForEvent('download')
  await row('新章节').getByRole('button', { name: '导出章节「新章节」', exact: true }).click()
  const download = await downloadPromise
  const exported = JSON.parse(readFileSync(await download.path(), 'utf8'))
  assert.equal(exported.questions.length, 1)
  assert.equal(exported.questions[0].category, '新章节')

  confirmNext(false)
  await row('第一章 已改名').getByRole('button', { name: '删除章节', exact: true }).click()
  assert.deepEqual(await workspace(), current)
  confirmNext(true)
  await row('第一章 已改名').getByRole('button', { name: '删除章节', exact: true }).click()
  await row('第一章 已改名').waitFor({ state: 'detached' })
  current = await workspace()
  assert.deepEqual(current.banks[1], original.banks[1])
  assert.deepEqual(statOf(current.stats, 'beta', 'shared'), {
    questionId: 'shared', attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
  })
  assert.deepEqual(statOf(current.stats, 'alpha', 'b1'), alphaStat('b1'))
  assert.equal(current.sessions.length, 1)
  assert.equal(current.sessions[0].category, '第二章')
  await page.reload()
  await navigate('题库')
  await expand()
  assert.equal(await bank.locator('.chapter-row').count(), 2)
  for (const category of ['第二章', '新章节']) {
    confirmNext(true)
    await row(category).getByRole('button', { name: '删除章节', exact: true }).click()
    await row(category).waitFor({ state: 'detached' })
  }
  current = await workspace()
  assert.equal(current.banks.length, 2)
  assert.equal(current.banks[0].questions.length, 0)
  assert.equal(current.activeBankId, 'alpha')
  assert.deepEqual(current.attempts, original.attempts.filter((attempt) => attempt.bankId === 'beta'))
  assert.deepEqual(current.stats, {
    'beta::shared': {
      questionId: 'shared', attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
    },
  })
  await bank.getByRole('button', { name: '导入章节', exact: true }).click()
  await upload({ questions: [question('fresh', '恢复新章')] })
  await save()
  assert.equal((await workspace()).banks[0].questions.length, 1)

  await navigate('练习')
  await page.getByRole('button', { name: '按章节', exact: true }).click()
  await page.locator('.chapter-entry').first().click()
  await navigate('题库')
  await expand()
  await bank.getByRole('button', { name: '导入章节', exact: true }).click()
  const uncategorized = question('no-category', '占位章节')
  delete uncategorized.category
  await upload({ questions: [
    question('q1', '批量甲章'), question('q1', '批量乙章'), question('q2', '批量甲章'),
    question('shared', '恢复新章'), uncategorized,
  ] })
  assert.equal(await editor.getByRole('checkbox', { checked: true }).count(), 4)
  assert.equal(await editor.getByLabel('章节名称', { exact: true }).count(), 0)
  assert.match(await editor.innerText(), /已选 4 \/ 4 章 · 共 5 题；新增 3 章，追加 1 章/)
  await editor.getByRole('button', { name: '清空选择', exact: true }).click()
  assert.equal(await editor.getByRole('button', { name: '保存章节', exact: true }).isDisabled(), true)
  await editor.getByRole('checkbox', { name: /批量乙章/ }).check()
  await editor.getByRole('button', { name: '全选', exact: true }).click()
  assert.equal(await editor.getByRole('checkbox', { checked: true }).count(), 4)
  await save()
  current = await workspace()
  assert.equal(current.banks.length, 2)
  assert.equal(current.activeBankId, 'alpha')
  assert.deepEqual([...new Set(current.banks[0].questions.map((entry) => entry.category))], ['恢复新章', '批量甲章', '批量乙章', '未分类'])
  assert.equal(current.banks[0].questions.length, 6)
  assert.equal(current.banks[0].questions.filter((entry) => entry.category === '批量甲章').length, 2)
  assert.equal(current.banks[0].questions.find((entry) => entry.category === '批量乙章').id, 'q1~2')
  assert.equal(new Set(current.banks[0].questions.map((entry) => entry.id)).size, 6)
  assert.deepEqual(current.banks[1], original.banks[1])
  assert.deepEqual(current.stats, {
    'beta::shared': {
      questionId: 'shared', attempts: 1, correctCount: 0, wrongCount: 1, consecutiveCorrect: 0, lastAt: 100, totalMs: 500,
    },
  })
  assert.deepEqual(current.attempts, original.attempts.filter((attempt) => attempt.bankId === 'beta'))
  await navigate('练习')
  await page.getByRole('button', { name: '继续练习', exact: true }).click()
  assert.equal(await page.locator('.practice__counter').innerText(), '第 1 / 1 题')
  await navigate('题库')
  current = await workspace()
  await expand()

  await bank.getByRole('button', { name: '导入章节', exact: true }).click()
  await upload({ questions: [question('valid', '先合法章'), question('bad', '后非法章'), question('bad', '后非法章')] })
  await editor.getByRole('button', { name: '保存章节', exact: true }).click()
  assert.match(await editor.getByRole('alert').innerText(), /重复题号/)
  assert.deepEqual(await workspace(), current)
  await editor.getByRole('checkbox', { name: /后非法章/ }).uncheck()
  await save()
  current = await workspace()
  assert.equal(current.banks[0].questions.some((entry) => entry.category === '先合法章'), true)
  assert.equal(current.banks[0].questions.some((entry) => entry.category === '后非法章'), false)
  await page.reload()
  await navigate('题库')
  await expand()
  assert.equal(await bank.locator('.chapter-row').count(), 5)
  const restored = await workspace()
  assert.equal(restored.activeSession.elapsedMs, current.activeSession.elapsedMs)
  assert.deepEqual(restored.activeSession.questionIds, current.activeSession.questionIds)
  assert.deepEqual({ ...restored, activeSession: null }, { ...current, activeSession: null })
  assert.deepEqual(errors, [])
  console.log('PASS 单章编辑与导出删除、多选与全选批量导入、自动分章、同名追加、跨章题号冲突、原子校验、记录隔离、持久化、窄屏和进行中的练习保护')
} finally {
  await browser.close()
}
