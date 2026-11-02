import { invoke } from '@tauri-apps/api/core'
import { IS_TAURI } from './shell'
import { sha256Hex } from './sha256'
import { questionAssetIds } from './content'
import type { AssetMeta, Question, Workspace } from './types'

/** 单张图片的上限。超过就当导入失败，别把内存吃穿。 */
export const MAX_ASSET_BYTES = 8 * 1024 * 1024
/** 一个题库包里图片总量上限。 */
export const MAX_TOTAL_ASSET_BYTES = 64 * 1024 * 1024
/** 一个工作区里图片张数上限。 */
export const MAX_ASSET_COUNT = 2000

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
}

export function normalizeMime(mime: string): string {
  const lower = mime.trim().toLowerCase()
  return MIME_ALIASES[lower] ?? lower
}

/** 看真实字节认图片类型：不认扩展名，也不认清单里写的 MIME。 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp'
  }
  return null
}

export const SUPPORTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp']

export interface AssetStore {
  put(id: string, bytes: Uint8Array, mime: string): Promise<void>
  get(id: string): Promise<Uint8Array | null>
  remove(ids: string[]): Promise<void>
  keys(): Promise<string[]>
}

/* ── 桌面端：图片落在应用数据目录，按内容哈希命名，同一张图只存一份 ── */

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function toBytes(raw: unknown): Uint8Array | null {
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  if (ArrayBuffer.isView(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  if (Array.isArray(raw)) return new Uint8Array(raw)
  return null
}

const tauriStore: AssetStore = {
  async put(id, bytes, mime) {
    await invoke('save_asset', { id, data: toBase64(bytes), mime })
  },
  async get(id) {
    try {
      return toBytes(await invoke<unknown>('read_asset', { id }))
    } catch {
      return null
    }
  },
  async remove(ids) {
    if (!ids.length) return
    await invoke('delete_assets', { ids })
  },
  async keys() {
    try {
      return await invoke<string[]>('list_assets')
    } catch {
      return []
    }
  },
}

/* ── 网页端：图片存 IndexedDB，不塞 localStorage（那儿只有 5 MiB 上下） ── */

const DB_NAME = 'allright-assets'
const DB_VERSION = 1
const STORE = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  const pending = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('这个浏览器没有 IndexedDB，存不下图片。'))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('打不开本地图片库'))
    request.onblocked = () => reject(new Error('本地图片库正被别的标签页占用'))
  })
  dbPromise = pending
  pending.catch(() => { dbPromise = null })
  return pending
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本地图片库读写失败'))
  })
}

const webStore: AssetStore = {
  async put(id, bytes, mime) {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put({ id, mime, bytes })
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('本地图片库写入失败'))
      tx.onabort = () => reject(tx.error ?? new Error('本地图片库写入被中断'))
    })
  },
  async get(id) {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const record = await requestResult<{ id: string; mime: string; bytes: ArrayBuffer } | undefined>(
      tx.objectStore(STORE).get(id) as IDBRequest<{ id: string; mime: string; bytes: ArrayBuffer } | undefined>,
    )
    if (!record?.bytes) return null
    return new Uint8Array(record.bytes)
  },
  async remove(ids) {
    if (!ids.length) return
    const db = await openDb()
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    for (const id of ids) store.delete(id)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('本地图片库删除失败'))
      tx.onabort = () => reject(tx.error ?? new Error('本地图片库删除被中断'))
    })
  },
  async keys() {
    const db = await openDb()
    const tx = db.transaction(STORE, 'readonly')
    const records = await requestResult<{ id: string }[]>(
      tx.objectStore(STORE).getAll() as IDBRequest<{ id: string }[]>,
    )
    return records.map((record) => record.id)
  },
}

export const assetStore: AssetStore = IS_TAURI ? tauriStore : webStore

/* ── 对外的资源仓库接口 ── */

export interface StoredAsset extends AssetMeta {
  id: string
}

/** 存一张图：按真实字节算 ID，声明的类型和实际不符就拒绝。 */
export async function saveAsset(bytes: Uint8Array, declaredMime?: string): Promise<StoredAsset> {
  const sniffed = sniffImageMime(bytes)
  if (!sniffed) {
    throw new Error('只认 PNG、JPEG、WebP 三种图片格式。')
  }
  if (declaredMime) {
    const declared = normalizeMime(declaredMime)
    if (declared && declared !== sniffed) {
      throw new Error(`文件类型对不上：写的是 ${declared}，实际是 ${sniffed}。`)
    }
  }
  if (bytes.length > MAX_ASSET_BYTES) {
    throw new Error(`单张图片不能超过 ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)} MB。`)
  }
  const id = sha256Hex(bytes)
  await assetStore.put(id, bytes, sniffed)
  return { id, mime: sniffed, bytes: bytes.length }
}

export async function readAsset(id: string): Promise<Uint8Array | null> {
  return assetStore.get(id)
}

export async function hasAsset(id: string): Promise<boolean> {
  return (await assetStore.get(id)) !== null
}

const urlCache = new Map<string, string>()

/** TS 把 Uint8Array 的 buffer 类型收紧了，这里统一转成 Blob 能收的那一种。 */
function toBlobPart(bytes: Uint8Array): BlobPart {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

/** 展示用地址。同一张图只建一次 object URL，删资源时才回收。 */
export async function assetUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached
  const bytes = await assetStore.get(id)
  if (!bytes?.length) return null
  const mime = sniffImageMime(bytes) ?? 'application/octet-stream'
  const url = URL.createObjectURL(new Blob([toBlobPart(bytes)], { type: mime }))
  urlCache.set(id, url)
  return url
}

export function releaseAssetUrl(id: string): void {
  const url = urlCache.get(id)
  if (!url) return
  URL.revokeObjectURL(url)
  urlCache.delete(id)
}

/** 删掉再没人引用的图片。 */
export async function pruneAssetsExcept(used: Set<string>): Promise<void> {
  const existing = await assetStore.keys()
  const orphans = existing.filter((id) => !used.has(id))
  if (!orphans.length) return
  for (const id of orphans) releaseAssetUrl(id)
  await assetStore.remove(orphans)
}

/** 工作区里所有题目用到的图片 id。 */
export function referencedAssetIds(workspace: Workspace): Set<string> {
  const used = new Set<string>()
  for (const bank of workspace.banks) {
    for (const question of bank.questions) {
      for (const id of questionAssetIds(question)) used.add(id)
    }
  }
  return used
}

export function bankAssetIds(questions: Question[]): string[] {
  const ids = new Set<string>()
  for (const question of questions) {
    for (const id of questionAssetIds(question)) ids.add(id)
  }
  return [...ids]
}

/* ── 加载失败的登记：题干或选项缺图时，这题先不让人提交 ── */

const missingIds = new Set<string>()
const missingListeners = new Set<() => void>()
let missingSnapshot = ''

function refreshMissing(): void {
  missingSnapshot = [...missingIds].sort().join(',')
  for (const listener of missingListeners) listener()
}

export function markAssetMissing(id: string): void {
  if (missingIds.has(id)) return
  missingIds.add(id)
  refreshMissing()
}

export function clearAssetMissing(id: string): void {
  if (!missingIds.has(id)) return
  missingIds.delete(id)
  refreshMissing()
}

export function subscribeMissing(listener: () => void): () => void {
  missingListeners.add(listener)
  return () => { missingListeners.delete(listener) }
}

export function getMissingSnapshot(): string {
  return missingSnapshot
}

export function missingSet(): Set<string> {
  return missingSnapshot ? new Set(missingSnapshot.split(',')) : new Set()
}
