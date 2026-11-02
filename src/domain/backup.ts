import { readAsset, saveAsset } from './assets'
import { bankAssetIds } from './assets'
import { questionAssetIds } from './content'
import { looksLikePack, readPack, writeBankPack, writeWorkspacePack } from './pack'
import { parseWorkspace } from './storage'
import type { AssetMeta, Bank, Question, Workspace } from './types'

/** 工作区里所有题目用到的图片 id。 */
export function workspaceAssetIds(workspace: Workspace): string[] {
  const ids = new Set<string>()
  for (const bank of workspace.banks) {
    for (const question of bank.questions) {
      for (const id of questionAssetIds(question)) ids.add(id)
    }
  }
  return [...ids]
}

/** 工作区的图片清单：按题目实际引用重建，删题库时不会留下野条目。 */
export function workspaceAssetManifest(workspace: Workspace): Record<string, AssetMeta> {
  const manifest: Record<string, AssetMeta> = {}
  for (const id of workspaceAssetIds(workspace)) {
    const meta = workspace.assets?.[id]
    if (meta) manifest[id] = meta
  }
  return manifest
}

/** 把图片本体从资源仓库里取出来，缺一张就说明备份不完整，直接报错。 */
export async function collectAssetBytes(ids: string[]): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>()
  const missing: string[] = []
  for (const id of ids) {
    const bytes = await readAsset(id)
    if (bytes?.length) files.set(id, bytes)
    else missing.push(id)
  }
  if (missing.length) {
    throw new Error(`有 ${missing.length} 张图片读不出来，导出的备份会缺东西，请先修复这些图片。`)
  }
  return files
}

export interface BackupFile {
  filename: string
  bytes: Uint8Array
  isPack: boolean
}

/** 导出工作区备份：带图就导 .allright 包，纯文字还是 JSON。 */
export async function buildWorkspaceBackup(workspace: Workspace): Promise<BackupFile> {
  const ids = workspaceAssetIds(workspace)
  if (!ids.length) {
    const text = JSON.stringify({ ...workspace, assets: workspaceAssetManifest(workspace) }, null, 2)
    return {
      filename: 'allright-工作区备份.json',
      bytes: new TextEncoder().encode(text),
      isPack: false,
    }
  }
  const files = await collectAssetBytes(ids)
  const packed = writeWorkspacePack({ ...workspace, assets: workspaceAssetManifest(workspace) }, files)
  return { filename: 'allright-工作区备份.allright', bytes: packed, isPack: true }
}

/** 导出单个题库：带图就导 .allright 包，纯文字还是 JSON。 */
export async function buildBankExport(bank: Bank): Promise<BackupFile> {
  const ids = bankAssetIds(bank.questions)
  if (!ids.length) {
    const text = JSON.stringify({ name: bank.name, questions: bank.questions }, null, 2)
    return { filename: `${bank.name}.json`, bytes: new TextEncoder().encode(text), isPack: false }
  }
  const files = await collectAssetBytes(ids)
  return {
    filename: `${bank.name}.allright`,
    bytes: writeBankPack(bank, files),
    isPack: true,
  }
}

export interface RestoredBackup {
  workspace: Workspace
  /** 包里带的图片本体，导入时先落盘再切工作区。 */
  files: Map<string, Uint8Array>
  isPack: boolean
}

/** 读一个备份文件：JSON 备份和 .allright 包都认。 */
export async function readBackupFile(file: File | Blob): Promise<RestoredBackup> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (looksLikePack(bytes)) {
    const pack = readPack(bytes)
    if (pack.kind === 'workspace') {
      return { workspace: pack.workspace, files: pack.files, isPack: true }
    }
    /* 题库包当备份恢复时，只取题库本身，练习记录不动。 */
    return {
      workspace: {
        version: 2,
        banks: [{
          id: `bank-${Date.now().toString(36)}`,
          name: pack.name,
          importedAt: Date.now(),
          questions: pack.parsed.valid,
        }],
        activeBankId: null,
        attempts: [],
        stats: {},
        sessions: [],
        assets: pack.assets,
      },
      files: pack.files,
      isPack: true,
    }
  }
  const text = new TextDecoder('utf-8').decode(bytes)
  return { workspace: parseWorkspace(text), files: new Map(), isPack: false }
}

/** 图片先落盘，全部成功了再切工作区——不会出「题库在、图没了」的半截状态。 */
export async function commitRestoredAssets(
  workspace: Workspace,
  files: Map<string, Uint8Array>,
): Promise<Workspace> {
  const manifest: Record<string, AssetMeta> = {}
  for (const [id, bytes] of files) {
    const stored = await saveAsset(bytes)
    manifest[id] = { mime: stored.mime, bytes: stored.bytes }
  }
  const merged = { ...workspace, assets: { ...workspace.assets, ...manifest } }
  return merged
}

/** 检查题目引用的图片是不是都在。 */
export function missingAssetIds(questions: Question[], known: Set<string>): string[] {
  const missing = new Set<string>()
  for (const question of questions) {
    for (const id of questionAssetIds(question)) {
      if (!known.has(id)) missing.add(id)
    }
  }
  return [...missing]
}
