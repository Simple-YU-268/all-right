import { strToU8 } from 'fflate'
import { readZip, writeZip, type ZipFile } from './zip'
import { sha256Hex } from './sha256'
import { sniffImageMime, normalizeMime } from './assets'
import { parseBank, type ParsedBank } from './parseBank'
import type { Bank, ContentBlock, Question, Workspace } from './types'

export const PACK_EXTENSION = '.allright'
export const PACK_SCHEMA_VERSION = 2

export interface PackAsset {
  file: string
  mime: string
  bytes: number
}

export interface BankPack {
  kind: 'bank'
  name: string
  assets: Record<string, PackAsset>
  parsed: ParsedBank
  files: Map<string, Uint8Array>
}

export interface WorkspacePack {
  kind: 'workspace'
  workspace: Workspace
  files: Map<string, Uint8Array>
}

export type Pack = BankPack | WorkspacePack

/** 是不是一个 zip 容器（题库包 / 备份包）。 */
export function looksLikePack(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
}

function remapBlocks(blocks: ContentBlock[] | undefined, mapping: Map<string, string>): ContentBlock[] | undefined {
  if (!blocks?.length) return blocks
  return blocks.map((block) =>
    block.type === 'image' && mapping.has(block.assetId)
      ? { ...block, assetId: mapping.get(block.assetId)! }
      : block,
  )
}

function remapQuestion(question: Question, mapping: Map<string, string>): Question {
  if (!mapping.size) return question
  return {
    ...question,
    stemBlocks: remapBlocks(question.stemBlocks, mapping),
    explanationBlocks: remapBlocks(question.explanationBlocks, mapping),
    options: question.options.map((option) => ({
      ...option,
      blocks: remapBlocks(option.blocks, mapping),
    })),
  }
}

interface LoadedAsset {
  id: string
  bytes: Uint8Array
  mime: string
}

/**
 * 把包里的图片按真实内容算 ID。
 * 清单里的 id 只是线索——真正的名字永远是内容的哈希，跨端才认得同一张图。
 */
function loadAssets(
  manifest: Record<string, PackAsset> | undefined,
  files: Map<string, Uint8Array>,
): {
  assets: Record<string, PackAsset>
  loaded: LoadedAsset[]
  mapping: Map<string, string>
  declared: Record<string, PackAsset>
} {
  const assets: Record<string, PackAsset> = {}
  const loaded: LoadedAsset[] = []
  const mapping = new Map<string, string>()
  if (!manifest || typeof manifest !== 'object') return { assets, loaded, mapping, declared: {} }

  for (const [declaredId, entry] of Object.entries(manifest)) {
    if (!entry || typeof entry.file !== 'string') {
      throw new Error(`资源 ${declaredId} 写得不对，缺少文件名。`)
    }
    const bytes = files.get(entry.file)
    if (!bytes?.length) {
      throw new Error(`资源 ${declaredId} 在包里找不到（${entry.file}）。`)
    }
    const sniffed = sniffImageMime(bytes)
    if (!sniffed) {
      throw new Error(`资源 ${declaredId} 不是能识别的图片（${entry.file}）。`)
    }
    const declared = normalizeMime(entry.mime ?? '')
    if (declared && declared !== sniffed) {
      throw new Error(`资源 ${declaredId} 类型对不上：清单写 ${declared}，实际是 ${sniffed}。`)
    }
    const id = sha256Hex(bytes)
    mapping.set(declaredId, id)
    assets[id] = { file: `assets/${id}`, mime: sniffed, bytes: bytes.length }
    loaded.push({ id, bytes, mime: sniffed })
  }
  return { assets, loaded, mapping, declared: manifest }
}

function parsePackJson(text: string): Record<string, unknown> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new Error(`包里的 JSON 读不出来：${error instanceof Error ? error.message : String(error)}`)
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('包里的 JSON 结构不对。')
  }
  const record = raw as Record<string, unknown>
  const version = Number(record.schemaVersion)
  if (!Number.isFinite(version) || version > PACK_SCHEMA_VERSION) {
    throw new Error(`这个包的版本比当前软件新（v${record.schemaVersion}），先升级软件再导入。`)
  }
  return record
}

export function readPack(data: Uint8Array): Pack {
  const files = readZip(data)
  const decoder = new TextDecoder('utf-8')

  const bankJson = files.get('bank.json')
  if (bankJson) {
    const record = parsePackJson(decoder.decode(bankJson))
    const { assets, loaded, mapping, declared } = loadAssets(
      record.assets as Record<string, PackAsset> | undefined,
      files,
    )
    const parsed = parseBank(record, String(record.name ?? '未命名题库'), { assets: declared })
    const questions = parsed.valid.map((question) => remapQuestion(question, mapping))
    return {
      kind: 'bank',
      name: parsed.name,
      assets,
      parsed: { ...parsed, questions, valid: questions },
      files: new Map(loaded.map((asset) => [asset.id, asset.bytes])),
    }
  }

  const workspaceJson = files.get('workspace.json')
  if (workspaceJson) {
    const record = parsePackJson(decoder.decode(workspaceJson))
    const rawWorkspace = record.workspace
    if (!rawWorkspace || typeof rawWorkspace !== 'object') {
      throw new Error('备份包里没有工作区数据。')
    }
    const workspaceRecord = rawWorkspace as Record<string, unknown>
    const { assets, loaded, mapping } = loadAssets(
      workspaceRecord.assets as Record<string, PackAsset> | undefined,
      files,
    )
    const banks = Array.isArray(workspaceRecord.banks)
      ? (workspaceRecord.banks as Bank[]).map((bank) => ({
        ...bank,
        questions: (bank.questions ?? []).map((question) => remapQuestion(question, mapping)),
      }))
      : []
    return {
      kind: 'workspace',
      workspace: {
        ...workspaceRecord,
        version: 2,
        banks,
        assets,
      } as unknown as Workspace,
      files: new Map(loaded.map((asset) => [asset.id, asset.bytes])),
    }
  }

  throw new Error('这个包里既没有 bank.json 也没有 workspace.json，不像是 ALL RIGHT 的文件。')
}

export function writeBankPack(bank: Bank, files: Map<string, Uint8Array>): Uint8Array {
  const assets: Record<string, PackAsset> = {}
  const entries: ZipFile[] = []
  for (const [id, bytes] of files) {
    const mime = sniffImageMime(bytes) ?? 'application/octet-stream'
    assets[id] = { file: `assets/${id}`, mime, bytes: bytes.length }
    entries.push({ name: `assets/${id}`, bytes, store: true })
  }
  const manifest = {
    schemaVersion: PACK_SCHEMA_VERSION,
    kind: 'bank',
    name: bank.name,
    assets,
    questions: bank.questions,
  }
  return writeZip([
    { name: 'bank.json', bytes: strToU8(JSON.stringify(manifest, null, 2)) },
    ...entries,
  ])
}

export function writeWorkspacePack(workspace: Workspace, files: Map<string, Uint8Array>): Uint8Array {
  const assets: Record<string, PackAsset> = {}
  const entries: ZipFile[] = []
  for (const [id, bytes] of files) {
    const mime = sniffImageMime(bytes) ?? 'application/octet-stream'
    assets[id] = { file: `assets/${id}`, mime, bytes: bytes.length }
    entries.push({ name: `assets/${id}`, bytes, store: true })
  }
  const manifest = {
    schemaVersion: PACK_SCHEMA_VERSION,
    kind: 'workspace',
    assets,
    workspace: { ...workspace, assets },
  }
  return writeZip([
    { name: 'workspace.json', bytes: strToU8(JSON.stringify(manifest, null, 2)) },
    ...entries,
  ])
}
