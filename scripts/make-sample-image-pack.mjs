/* 生成示例图片题库包（public/sample-image-bank.allright）。
   图片是脚本现画的 PNG，题库结构用的是软件自己的题库包格式。
   跑法：node scripts/make-sample-image-pack.mjs */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAppModule } from './lib/load-app-module.mjs'

/* 应用里的模块会摸 window（判断是不是 Tauri），Node 里先搭个假的 */
globalThis.window = { __TAURI_INTERNALS__: undefined, location: { protocol: 'http:' } }

const { writeBankPack } = await loadAppModule('src/domain/pack.ts')
const { sha256Hex } = await loadAppModule('src/domain/sha256.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ---- 最小 PNG 编码器：够画示意图就行 ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let c = -1
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeBuffer = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgb) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 3 + 1)
    raw[rowStart] = 0
    rgb.copy(raw, rowStart + 1, y * width * 3, (y + 1) * width * 3)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* ---- 画布 ---- */

const PAPER = [0xff, 0xff, 0xff]
const INK = [0x1b, 0x24, 0x50]
const BLUE = [0x2a, 0x3e, 0x8f]
const RED = [0xb5, 0x34, 0x2a]
const GREEN = [0x2c, 0x73, 0x55]

function canvas(width, height, fill = PAPER) {
  const rgb = Buffer.alloc(width * height * 3)
  for (let i = 0; i < width * height; i += 1) {
    rgb[i * 3] = fill[0]
    rgb[i * 3 + 1] = fill[1]
    rgb[i * 3 + 2] = fill[2]
  }
  return { width, height, rgb }
}

function pixel(picture, x, y, color) {
  if (x < 0 || y < 0 || x >= picture.width || y >= picture.height) return
  const offset = (y * picture.width + x) * 3
  picture.rgb[offset] = color[0]
  picture.rgb[offset + 1] = color[1]
  picture.rgb[offset + 2] = color[2]
}

function frame(picture, x0, y0, x1, y1, thickness, color) {
  for (let t = 0; t < thickness; t += 1) {
    for (let x = x0; x <= x1; x += 1) {
      pixel(picture, x, y0 + t, color)
      pixel(picture, x, y1 - t, color)
    }
    for (let y = y0; y <= y1; y += 1) {
      pixel(picture, x0 + t, y, color)
      pixel(picture, x1 - t, y, color)
    }
  }
}

function line(picture, x0, y0, x1, y1, color, weight = 2) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let i = 0; i <= steps; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps)
    const y = Math.round(y0 + ((y1 - y0) * i) / steps)
    for (let w = 0; w < weight; w += 1) {
      pixel(picture, x, y + w - Math.floor(weight / 2), color)
      pixel(picture, x + w - Math.floor(weight / 2), y, color)
    }
  }
}

/* 电阻：方框里一段折线 */
function resistor(picture, x0, y0, x1, y1, color) {
  frame(picture, x0, y0, x1, y1, 2, color)
  const mid = Math.round((y0 + y1) / 2)
  const steps = 6
  const span = Math.round((x1 - x0) / steps)
  for (let i = 0; i < steps; i += 1) {
    const x = x0 + span * i
    const y = i % 2 === 0 ? mid - 12 : mid + 12
    line(picture, x, y, x + span, y, color, 2)
  }
}

/* ---- 三张图 ---- */

function circuitDiagram() {
  const picture = canvas(520, 240)
  const top = 60
  const bottom = 180
  const left = 60
  const right = 460
  line(picture, left, top, right, top, INK, 3)
  line(picture, left, bottom, right, bottom, INK, 3)
  line(picture, left, top, left, bottom, INK, 3)
  line(picture, right, top, right, bottom, INK, 3)
  resistor(picture, 130, top - 26, 230, top + 26, BLUE)
  resistor(picture, 300, top - 26, 400, top + 26, BLUE)
  /* 电流箭头 */
  line(picture, 245, top - 40, 275, top - 40, GREEN, 3)
  line(picture, 275, top - 40, 265, top - 46, GREEN, 3)
  line(picture, 275, top - 40, 265, top - 34, GREEN, 3)
  /* 电源 */
  frame(picture, 238, bottom - 40, 262, bottom + 40, 2, INK)
  return encodePng(picture.width, picture.height, picture.rgb)
}

function sineWave() {
  const picture = canvas(520, 220)
  line(picture, 40, 110, 480, 110, INK, 2)
  for (let x = 40; x <= 480; x += 1) {
    const y = 110 - Math.round(Math.sin(((x - 40) / 440) * Math.PI * 4) * 60)
    line(picture, x, y, x, y + 1, BLUE, 2)
  }
  return encodePng(picture.width, picture.height, picture.rgb)
}

function flatLine() {
  const picture = canvas(520, 220)
  line(picture, 40, 110, 480, 110, RED, 3)
  return encodePng(picture.width, picture.height, picture.rgb)
}

/* ---- 组装题库 ---- */

const circuit = circuitDiagram()
const wave = sineWave()
const flat = flatLine()

const files = new Map()
const register = (bytes) => {
  const id = sha256Hex(bytes)
  files.set(id, bytes)
  return id
}

const circuitId = register(circuit)
const waveId = register(wave)
const flatId = register(flat)

const questions = [
  {
    id: 'img-current',
    type: 'single',
    category: '第一章 电路基础',
    stem: '观察下图，判断串联电路里各处的电流关系。',
    stemBlocks: [
      { type: 'text', text: '观察下图，判断串联电路里各处的电流关系。' },
      { type: 'image', assetId: circuitId, alt: '两个电阻串联在一条回路上的电路示意图' },
    ],
    options: [
      { key: 'A', text: '各处电流相等' },
      { key: 'B', text: '各处电流一定不同' },
      { key: 'C', text: '电阻越大电流越大' },
    ],
    answer: ['A'],
    explanation: '串联电路只有一条通路，各处电流相等。',
    explanationBlocks: [
      { type: 'text', text: '串联电路只有一条通路，各处电流相等。' },
      { type: 'image', assetId: circuitId, alt: '同一张电路图，用来说明电流方向' },
    ],
    difficulty: 2,
    tags: ['电路', '串联'],
  },
  {
    id: 'img-signal',
    type: 'single',
    category: '第一章 电路基础',
    stem: '看这张波形图，选出正确的结论。',
    stemBlocks: [
      { type: 'text', text: '看这张波形图，选出正确的结论。' },
      { type: 'image', assetId: waveId, alt: '一段来回起伏的正弦波信号' },
    ],
    options: [
      { key: 'A', text: '这段信号是直流量' },
      { key: 'B', text: '这段信号是交流量' },
    ],
    answer: ['B'],
    explanation: '电压随时间来回变化，是交流信号。',
    difficulty: 3,
    tags: ['信号'],
  },
  {
    id: 'img-picture-option',
    type: 'single',
    category: '第二章 图像判断',
    stem: '下面哪条线是直流量？',
    stemBlocks: [{ type: 'text', text: '下面哪条线是直流量？' }],
    options: [
      {
        key: 'A',
        text: '水平的一条直线',
        blocks: [{ type: 'image', assetId: flatId, alt: '一条水平的直线' }],
      },
      {
        key: 'B',
        text: '来回起伏的曲线',
        blocks: [{ type: 'image', assetId: waveId, alt: '来回起伏的曲线' }],
      },
    ],
    answer: ['A'],
    explanation: '不随时间变化的量才是直流量。',
    difficulty: 1,
    tags: ['图像判断'],
  },
]

const bank = {
  id: 'sample-image-bank',
  name: '图片题示例',
  importedAt: 0,
  questions,
}

const bytes = writeBankPack(bank, files)
const target = join(ROOT, 'public', 'sample-image-bank.allright')
mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, bytes)
console.log(`已生成 ${target}（${bytes.length} 字节，${files.size} 张图片）`)
