/**
 * 题面里的公式：$...$、$$...$$、\(...\)、\[...\] 四种写法都认。
 * 纯文字照旧走文字，只有真的像公式的那段才交给排版器。
 */

export type MathSegment =
  | { kind: 'text'; text: string }
  | { kind: 'math'; source: string; display: boolean }

const DELIMITERS: { open: string; close: string; display: boolean }[] = [
  { open: '$$', close: '$$', display: true },
  { open: '\\[', close: '\\]', display: true },
  { open: '\\(', close: '\\)', display: false },
  { open: '$', close: '$', display: false },
]

/** 单个 $ 包住的内容不能以空格开头或结尾，「售价 $100 和 $200」就不该被当成公式。 */
function plausibleInline(body: string): boolean {
  if (!body.trim()) return false
  if (/^\s/.test(body) || /\s$/.test(body)) return false
  return true
}

export function splitMath(source: string): MathSegment[] {
  const segments: MathSegment[] = []
  let text = ''
  let index = 0
  while (index < source.length) {
    const rest = source.slice(index)
    const delimiter = DELIMITERS.find((item) => rest.startsWith(item.open))
    if (!delimiter) {
      text += source[index]
      index += 1
      continue
    }
    const bodyStart = index + delimiter.open.length
    const close = source.indexOf(delimiter.close, bodyStart)
    if (close === -1) {
      text += source[index]
      index += 1
      continue
    }
    const body = source.slice(bodyStart, close)
    const usable = delimiter.open === '$' ? plausibleInline(body) : body.trim().length > 0
    if (!usable) {
      text += source[index]
      index += 1
      continue
    }
    if (text) {
      segments.push({ kind: 'text', text })
      text = ''
    }
    segments.push({ kind: 'math', source: body, display: delimiter.display })
    index = close + delimiter.close.length
  }
  if (text) segments.push({ kind: 'text', text })
  return segments
}

/** 看着像公式才值得去排版，省得每段文字都跑一遍解析。 */
export function hasMath(source: string): boolean {
  return /\$|\\\(|\\\[/.test(source)
}
