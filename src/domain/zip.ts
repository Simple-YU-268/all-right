import { unzipSync, zipSync, type Zippable } from 'fflate'

export interface ZipLimits {
  maxEntries: number
  maxEntryBytes: number
  maxTotalBytes: number
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 2000,
  maxEntryBytes: 16 * 1024 * 1024,
  maxTotalBytes: 64 * 1024 * 1024,
}

/** 只认包内的相对路径：绝对路径、盘符、.. 一律拒绝。 */
export function isSafeEntryPath(name: string): boolean {
  if (!name || name.length > 200) return false
  if (name.includes('\0') || name.includes('\\')) return false
  if (name.startsWith('/')) return false
  if (/^[a-zA-Z]:/.test(name)) return false
  for (const segment of name.split('/')) {
    if (segment === '' || segment === '.' || segment === '..') return false
  }
  return true
}

/**
 * 先只读中央目录，把条目名和解压后大小查清楚再解压。
 * 压缩炸弹靠这一步挡住——限额不过，连一个字节都不展开。
 */
export function readZip(data: Uint8Array, limits: ZipLimits = DEFAULT_ZIP_LIMITS): Map<string, Uint8Array> {
  const catalog: { name: string; originalSize: number }[] = []
  try {
    unzipSync(data, {
      filter: (file) => {
        catalog.push({ name: file.name, originalSize: file.originalSize })
        return false
      },
    })
  } catch (error) {
    throw new Error(`压缩包读不出来：${error instanceof Error ? error.message : String(error)}`)
  }

  if (catalog.length > limits.maxEntries) {
    throw new Error(`压缩包里文件太多（${catalog.length} 个）。`)
  }

  const seen = new Set<string>()
  const allowed = new Set<string>()
  let total = 0
  for (const entry of catalog) {
    if (!isSafeEntryPath(entry.name)) {
      throw new Error(`压缩包里有一条非法路径：${entry.name}`)
    }
    const key = entry.name.toLowerCase()
    if (seen.has(key)) {
      throw new Error(`压缩包里出现了重复文件：${entry.name}`)
    }
    seen.add(key)
    if (entry.originalSize > limits.maxEntryBytes) {
      throw new Error(`压缩包里有文件太大：${entry.name}`)
    }
    total += entry.originalSize
    if (total > limits.maxTotalBytes) {
      throw new Error('压缩包解压后太大了，不导入。')
    }
    allowed.add(entry.name)
  }

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data, { filter: (file) => allowed.has(file.name) })
  } catch (error) {
    throw new Error(`压缩包解不开：${error instanceof Error ? error.message : String(error)}`)
  }
  return new Map(Object.entries(files))
}

export interface ZipFile {
  name: string
  bytes: Uint8Array
  /** 图片本身已经压过了，再压一遍纯属浪费cpu。 */
  store?: boolean
}

export function writeZip(files: ZipFile[]): Uint8Array {
  const payload: Zippable = {}
  for (const file of files) {
    payload[file.name] = file.store ? [file.bytes, { level: 0 }] : file.bytes
  }
  return zipSync(payload, { level: 9 })
}
