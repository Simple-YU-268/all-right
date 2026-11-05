import assert from 'node:assert/strict'
import { loadAppModule } from './lib/load-app-module.mjs'
const { createClock, commitClock, currentQuestionElapsed } = await loadAppModule('src/domain/sessionClock.ts')
const realNow = Date.now
let now = 1000
Date.now = () => now
try {
  const session = { id: 's', questionIds: ['q'], index: 0, answers: {}, elapsedMs: 0, questionStartedAt: now }
  const clock = createClock(session)
  now = 4000
  const saved = commitClock(clock, session)
  const restored = createClock(saved)
  assert.equal(currentQuestionElapsed(restored, 'q'), 3000, 'snapshot restore must not count the same interval twice')
  assert.deepEqual(commitClock(clock, session), saved, 'snapshot reads are idempotent')
  console.log('PASS clock snapshot restore and idempotence')
} finally { Date.now = realNow }
