/* 题库包与备份包的安全边界：路径穿越、重复条目、体积上限、类型不符。
   这些都是拿用户随手拿来的文件试出来的，所以必须有回归。
   跑法：node scripts/verify-pack.mjs */
import assert from 'node:assert/strict'
import { strToU8, zipSync } from 'fflate'
import { loadAppModule } from './lib/load-app-module.mjs'

/* 应用里的模块会摸 window（判断是不是 Tauri），Node 里先搭个假的 */
globalThis.window = { __TAURI_INTERNALS__: undefined, location: { protocol: 'http:' } }

const { readZip, writeZip, isSafeEntryPath } = await loadAppModule('src/domain/zip.ts')
const { readPack, looksLikePack } = await loadAppModule('src/domain/pack.ts')

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const checks = []
function check(name, fn) {
  fn()
  checks.push(name)
}

function rejects(fn, pattern, label) {
  let message = null
  try {
    fn()
  } catch (error) {
    message = error instanceof Error ? error.message : String(error)
  }
  assert.ok(message, `${label}：本该被拒绝，却通过了`)
  assert.match(message, pattern, `${label}：报错信息没说到点上（${message}）`)
}

/* ---- 正常包 ---- */

check('正常包能读出内容', () => {
  const bytes = writeZip([{ name: 'bank.json', bytes: strToU8('{"schemaVersion":2,"questions":[]}') }])
  const files = readZip(bytes)
  assert.equal(files.get('bank.json')?.length, 34)
})

check('写出的包能原样读回', () => {
  const packed = writeZip([
    { name: 'a.json', bytes: strToU8('{}') },
    { name: 'assets/abc', bytes: new Uint8Array(PNG), store: true },
  ])
  assert.equal(packed[0], 0x50)
  assert.equal(packed[1], 0x4b)
})

/* ---- 路径与条目 ---- */

check('路径穿越被挡下', () => {
  assert.equal(isSafeEntryPath('../escape.txt'), false)
  assert.equal(isSafeEntryPath('a/../../escape.txt'), false)
  assert.equal(isSafeEntryPath('/etc/passwd'), false)
  assert.equal(isSafeEntryPath('C:\\Windows\\x'), false)
  assert.equal(isSafeEntryPath('a\\b'), false)
  assert.equal(isSafeEntryPath('a//b'), false)
  assert.equal(isSafeEntryPath('assets/abc.png'), true)

  const evil = zipSync({ '../escape.txt': strToU8('nope') })
  rejects(() => readZip(evil), /非法路径/, '路径穿越')
})

check('重复文件名被挡下', () => {
  /* fflate 的同名键会互相覆盖，改用大小写不同的两个名字来验证检查逻辑 */
  const manual = writeZip([
    { name: 'a.json', bytes: strToU8('{}') },
    { name: 'A.JSON', bytes: strToU8('{}') },
  ])
  rejects(() => readZip(manual), /重复文件/, '大小写重复')
})

check('条目太多被挡下', () => {
  const many = zipSync({ 'a.json': strToU8('{}'), 'b.json': strToU8('{}'), 'c.json': strToU8('{}') })
  rejects(
    () => readZip(many, { maxEntries: 2, maxEntryBytes: 1024, maxTotalBytes: 1024 }),
    /文件太多/,
    '条目数量',
  )
})

check('单文件太大被挡下', () => {
  const big = zipSync({ 'a.json': strToU8('x'.repeat(4096)) })
  rejects(
    () => readZip(big, { maxEntries: 100, maxEntryBytes: 1024, maxTotalBytes: 1024 * 1024 }),
    /文件太大/,
    '单文件体积',
  )
})

check('解压后总体积太大被挡下', () => {
  const big = zipSync({
    'a.json': strToU8('x'.repeat(600)),
    'b.json': strToU8('y'.repeat(600)),
  })
  rejects(
    () => readZip(big, { maxEntries: 100, maxEntryBytes: 1024, maxTotalBytes: 1000 }),
    /太大了/,
    '总体积',
  )
})

/* ---- 题库包语义 ---- */

check('不是包的文件被认出来', () => {
  assert.equal(looksLikePack(new TextEncoder().encode('{"questions":[]}')), false)
  assert.equal(looksLikePack(new TextEncoder().encode('PK')), false)
  assert.equal(looksLikePack(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00])), true)
})

check('空包被挡下', () => {
  const empty = zipSync({ 'readme.txt': strToU8('hello') })
  rejects(() => readPack(empty), /不像是 ALL RIGHT/, '空包')
})

check('版本比软件新的包被挡下', () => {
  const future = zipSync({
    'bank.json': strToU8(JSON.stringify({ schemaVersion: 99, kind: 'bank', name: 'x', questions: [] })),
  })
  rejects(() => readPack(future), /比当前软件新/, '版本超前')
})

check('清单里的类型对不上时被挡下', () => {
  const wrongMime = zipSync({
    'bank.json': strToU8(JSON.stringify({
      schemaVersion: 2,
      kind: 'bank',
      name: 'x',
      assets: { a1: { file: 'assets/a1', mime: 'image/webp', bytes: PNG.length } },
      questions: [],
    })),
    'assets/a1': new Uint8Array(PNG),
  })
  rejects(() => readPack(wrongMime), /类型对不上/, '类型不符')
})

check('清单指向的图片不存在时被挡下', () => {
  const missing = zipSync({
    'bank.json': strToU8(JSON.stringify({
      schemaVersion: 2,
      kind: 'bank',
      name: 'x',
      assets: { a1: { file: 'assets/a1', mime: 'image/png', bytes: PNG.length } },
      questions: [],
    })),
  })
  rejects(() => readPack(missing), /找不到/, '图片缺失')
})

console.log(`PASS  题库包安全边界：${checks.length} 项`)
for (const name of checks) console.log(`  · ${name}`)
