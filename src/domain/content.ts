import type { ContentBlock } from './types'

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/** 内容块的宽松写法：认 type，也认「只有 text / 只有 assetId」的简写。 */
export function normalizeBlocks(raw: unknown): ContentBlock[] {
  if (!Array.isArray(raw)) return []
  const blocks: ContentBlock[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const rec = entry as Record<string, unknown>
    const type = asText(rec.type).toLowerCase()
    if (type === 'image' || (!type && (rec.assetId || rec.image || rec.src))) {
      const assetId = asText(rec.assetId ?? rec.image ?? rec.src ?? rec.id)
      if (!assetId) continue
      const alt = asText(rec.alt ?? rec.altText ?? rec.description ?? rec.caption ?? rec.title)
      blocks.push({ type: 'image', assetId, alt: alt || '题目配图' })
      continue
    }
    if (type === 'text' || (!type && typeof rec.text === 'string')) {
      const text = asText(rec.text)
      if (text) blocks.push({ type: 'text', text })
      continue
    }
  }
  return blocks
}

export function isImageBlock(block: ContentBlock): block is Extract<ContentBlock, { type: 'image' }> {
  return block.type === 'image'
}

/** 内容块里的文字摘要：给搜索、错题本列表和纯图片题的无障碍说明用。 */
export function blocksToText(blocks: ContentBlock[] | undefined): string {
  if (!blocks?.length) return ''
  return blocks
    .map((block) => (block.type === 'text' ? block.text : block.alt))
    .filter(Boolean)
    .join(' ')
    .trim()
}

export function collectAssetIds(blocks: ContentBlock[] | undefined): string[] {
  if (!blocks?.length) return []
  const ids: string[] = []
  for (const block of blocks) if (block.type === 'image') ids.push(block.assetId)
  return ids
}

/** 一道题用到的全部图片：题干、选项、解析都算上。 */
export function questionAssetIds(question: {
  stemBlocks?: ContentBlock[]
  explanationBlocks?: ContentBlock[]
  options: { blocks?: ContentBlock[] }[]
}): string[] {
  const ids = [
    ...collectAssetIds(question.stemBlocks),
    ...collectAssetIds(question.explanationBlocks),
  ]
  for (const option of question.options) ids.push(...collectAssetIds(option.blocks))
  return [...new Set(ids)]
}
