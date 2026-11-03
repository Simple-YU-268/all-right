// Attach a visually reviewed option image to a private PDF trial report.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadAppModule } from './lib/load-app-module.mjs'

const [reportPath, number, key, imagePath, destination, correctionsPath] = process.argv.slice(2)
if (!destination) throw new Error('Usage: node scripts/trial-attach-option.mjs report.json original-number option-key reviewed-image.png output.allright')
const report = JSON.parse(await readFile(reportPath, 'utf8'))
const target = report.items.filter(item => String(item.originalNumber) === number)
assert.equal(target.length, 1, 'Source question must be unambiguous')
const questions = report.items.map(item => structuredClone(item.source))
const corrections = correctionsPath ? JSON.parse(await readFile(correctionsPath, 'utf8')) : []
for (const correction of corrections) {
  assert.ok(['stem', 'explanation'].includes(correction.field), 'Only explicit text fields may be corrected')
  assert.ok(correction.reason && correction.before && typeof correction.after === 'string', 'Correction requires evidence and exact text')
  const matches = report.items.map((item, index) => ({ item, index })).filter(({ item }) => item.originalNumber === correction.number)
  assert.equal(matches.length, 1, 'Correction must identify one source question')
  const question = questions[matches[0].index]
  assert.equal(question[correction.field], correction.before, 'Source changed; review correction again')
  question[correction.field] = correction.after
}
const index = report.items.indexOf(target[0])
const options = questions[index].options.filter(option => option.key === key)
assert.equal(options.length, 1, 'Source option must be unambiguous')
assert.equal(options[0].text, '', 'Only an empty option can be repaired in this trial')
const bytes = new Uint8Array(await readFile(imagePath))
const id = createHash('sha256').update(bytes).digest('hex')
options[0].blocks = [{ type: 'image', assetId: id, alt: `原卷第 ${number} 题 ${key} 选项配图` }]
globalThis.window = { __TAURI_INTERNALS__: undefined, location: { protocol: 'http:' } }
const { parseBank } = await loadAppModule('src/domain/parseBank.ts')
const { writeBankPack, readPack } = await loadAppModule('src/domain/pack.ts')
const parsed = parseBank({ name: report.bank.name, questions }, report.bank.name, { assets: { [id]: {} } })
assert.deepEqual(parsed.issues, [], 'Every question must pass before export')
assert.equal(parsed.questions.length, report.sourceCount)
const packed = writeBankPack({ id: 'pdf-trial', name: parsed.name, importedAt: Date.now(), questions: parsed.questions }, new Map([[id, bytes]]))
const reopened = readPack(packed)
assert.equal(reopened.kind, 'bank')
assert.equal(reopened.parsed.questions.length, report.sourceCount)
assert.deepEqual(reopened.parsed.issues, [])
assert.equal(reopened.files.size, 1)
assert.deepEqual(reopened.parsed.questions.map(q => q.answer), parsed.questions.map(q => q.answer))
await writeFile(destination, packed)
await writeFile(`${destination}.report.json`, JSON.stringify({ sourceReport: path.resolve(reportPath), questionCount: parsed.questions.length, imageCount: 1, corrections, review: { question: number, option: key, image: path.resolve(imagePath), method: 'explicit image attachment after visual review; no OCR' }, originalCoverage: report.coverage, packRoundTrip: 'passed', originalPdfFullyReviewed: false }, null, 2) + '\n')
console.log(`PASS ${parsed.questions.length} questions, 1 image, pack round-trip; ${path.resolve(destination)}`)
