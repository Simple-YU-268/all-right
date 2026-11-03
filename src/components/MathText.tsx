import { useMemo } from 'react'
import katex from 'katex'
import { hasMath, splitMath } from '../domain/math'

/** KaTeX 原生没有的写法，先在这里补上。 */
const MACROS: Record<string, string> = {
  '\\celsius': '^{\\circ}\\mathrm{C}',
  '\\real': '\\mathbb{R}',
  '\\Rp': '\\mathbb{R}',
}

function renderFormula(source: string, display: boolean): string | null {
  try {
    return katex.renderToString(source, {
      displayMode: display,
      throwOnError: true,
      output: 'htmlAndMathml',
      trust: false,
      strict: 'ignore',
      macros: MACROS,
    })
  } catch {
    return null
  }
}

/**
 * 题面文字：夹在 $...$ 里的部分按公式排版，其余照旧是文字。
 * 排不了版就把原文还回去，别让人以为题目坏了。
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => (hasMath(text) ? splitMath(text) : null), [text])

  if (!parts) {
    return className ? <span className={className}>{text}</span> : <>{text}</>
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.kind === 'text') {
          return <span key={index}>{part.text}</span>
        }
        const html = renderFormula(part.source, part.display)
        if (html === null) {
          return (
            <span className="math__raw" key={index} title="这段公式没能排版，先把原文给你">
              {part.source}
            </span>
          )
        }
        return (
          <span
            className={part.display ? 'math math--display' : 'math math--inline'}
            key={index}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )
      })}
    </>
  )
}
