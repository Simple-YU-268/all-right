/* 统计必须按题库隔离：同名题在两个题库里各算各的。 */
import assert from 'node:assert/strict'

import { loadAppModule } from './lib/load-app-module.mjs'
const { statKey, migrateStats } = await loadAppModule('src/domain/statKey.ts')

const question = (id, category) => ({ id, category, type: 'single', stem: `${category} ${id}`,
  options: [{ key: 'A', text: '对' }, { key: 'B', text: '错' }], answer: ['A'], explanation: '', difficulty: 3, tags: [] })

const original = {
  version: 2,
  activeBankId: 'alpha',
  banks: [
    { id: 'alpha', name: '甲', importedAt: 1, questions: [question('shared', '一章'), question('only-a', '一章')] },
    { id: 'beta', name: '乙', importedAt: 2, questions: [question('shared', '二章')] },
  ],
  attempts: [
    { id: 'a1', bankId: 'alpha', questionId: 'shared', chosen: ['B'], correct: false, at: 100, elapsedMs: 500 },
    { id: 'a2', bankId: 'alpha', questionId: 'only-a', chosen: ['A'], correct: true, at: 110, elapsedMs: 300 },
    { id: 'b1', bankId: 'beta', questionId: 'shared', chosen: ['A'], correct: true, at: 120, elapsedMs: 200 },
  ],
  /* 旧格式：只有题号，没有题库维度。 */
  stats: {
    shared: { questionId: 'shared', attempts: 2, correctCount: 1, wrongCount: 1, consecutiveCorrect: 0, lastAt: 120, totalMs: 700 },
    'only-a': { questionId: 'only-a', attempts: 1, correctCount: 1, wrongCount: 0, consecutiveCorrect: 1, lastAt: 110, totalMs: 300 },
  },
  sessions: [],
  assets: {},
}

const migrated = migrateStats(original)
console.log('迁移后的键：', Object.keys(migrated.stats))
assert.ok(migrated.stats[statKey('alpha', 'shared')], '甲题库的 shared 有自己的统计')
assert.ok(migrated.stats[statKey('beta', 'shared')], '乙题库的 shared 有自己的统计')
assert.equal(migrated.stats[statKey('alpha', 'shared')].wrongCount, 1)
assert.equal(migrated.stats[statKey('beta', 'shared')].correctCount, 1)
assert.ok(!('shared' in migrated.stats), '旧键被清掉了')
assert.ok(migrated.stats[statKey('alpha', 'only-a')], '题号唯一的旧记录补回去了')
console.log('PASS stat isolation: legacy stats split per bank by attempts')
const scoped = { ...migrated.stats['beta::shared'], totalMs: 999 }
const mixed = migrateStats({ ...original, stats: { ...original.stats, 'beta::shared': scoped } })
assert.deepEqual(mixed.stats['beta::shared'], scoped, '混合迁移保留已迁移状态')
const complex = { ...original, banks: [{ ...original.banks[0], questions: [question('x::y', '一章')] }], attempts: [], stats: { 'x::y': { ...scoped, questionId: 'x::y' } } }
assert.ok(migrateStats(complex).stats[statKey('alpha', 'x::y')], '带分隔符的旧题号仍可迁移')
