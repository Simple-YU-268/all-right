import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { CloseSmall as X, Picture, ZoomIn, ZoomOut } from '@icon-park/react'
import {
  assetUrl,
  clearAssetMissing,
  getMissingSnapshot,
  markAssetMissing,
  subscribeMissing,
} from '../domain/assets'
import type { ContentBlock } from '../domain/types'
import { MathText } from './MathText'

/** 图片准备好了没有：题干的图要等齐，解析的图可以慢慢来。 */
export function useAssetUrl(assetId: string): { url: string | null; status: 'loading' | 'ready' | 'error' } {
  const [state, setState] = useState<{ url: string | null; status: 'loading' | 'ready' | 'error' }>({
    url: null,
    status: 'loading',
  })

  useEffect(() => {
    let active = true
    setState({ url: null, status: 'loading' })
    void assetUrl(assetId).then((url) => {
      if (!active) return
      if (url) {
        clearAssetMissing(assetId)
        setState({ url, status: 'ready' })
      } else {
        markAssetMissing(assetId)
        setState({ url: null, status: 'error' })
      }
    })
    return () => { active = false }
  }, [assetId])

  return state
}

/** 这几张图里有没有加载不出来的。 */
export function useMissingAssets(assetIds: string[]): boolean {
  const snapshot = useSyncExternalStore(subscribeMissing, getMissingSnapshot)
  const key = assetIds.join(',')
  return useMemo(() => {
    if (!snapshot) return false
    const missing = new Set(snapshot.split(','))
    return assetIds.some((id) => missing.has(id))
  }, [assetIds, key, snapshot])
}

export function MediaFigure({ block }: { block: Extract<ContentBlock, { type: 'image' }> }) {
  const { url, status } = useAssetUrl(block.assetId)
  const [open, setOpen] = useState(false)

  if (status === 'error') {
    return (
      <figure className="media media--missing">
        <div className="media__missing" role="img" aria-label={block.alt}>
          <Picture size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>这张图没加载出来</span>
        </div>
        <figcaption className="media__caption">{block.alt}</figcaption>
      </figure>
    )
  }

  return (
    <figure className="media">
      <button
        type="button"
        className="media__frame"
        onClick={() => setOpen(true)}
        aria-label={`放大查看：${block.alt}`}
      >
        {url ? (
          <img className="media__img" src={url} alt={block.alt} />
        ) : (
          <span className="media__loading">图片加载中…</span>
        )}
      </button>
      <figcaption className="media__caption">
        <button type="button" className="media__zoom" onClick={() => setOpen(true)}>
          <ZoomIn size={12} strokeWidth={2} aria-hidden="true" />
          放大
        </button>
        <span className="media__alt">{block.alt}</span>
      </figcaption>
      {open && url ? <ImageViewer src={url} alt={block.alt} onClose={() => setOpen(false)} /> : null}
    </figure>
  )
}

export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, index) =>
        block.type === 'text'
          ? <p className="content__text" key={index}><MathText text={block.text} /></p>
          : <MediaFigure block={block} key={index} />,
      )}
    </>
  )
}

/**
 * 题面正文：有内容块就按内容块排（图文交替），没有就退回老的纯文字字段。
 */
export function QuestionContent({
  blocks,
  fallback,
  className,
}: {
  blocks?: ContentBlock[]
  fallback: string
  className?: string
}) {
  if (!blocks?.length) {
    return <p className={className}><MathText text={fallback} /></p>
  }
  return (
    <div className={className ? `content ${className}` : 'content'}>
      <ContentBlocks blocks={blocks} />
    </div>
  )
}

/** 选项里的文字与图片要分开：选答案是选答案，放大图片是放大图片。 */
export function splitOptionBlocks(blocks?: ContentBlock[]): {
  text: ContentBlock[]
  media: Extract<ContentBlock, { type: 'image' }>[]
} {
  const text: ContentBlock[] = []
  const media: Extract<ContentBlock, { type: 'image' }>[] = []
  for (const block of blocks ?? []) {
    if (block.type === 'image') media.push(block)
    else text.push(block)
  }
  return { text, media }
}

export function ImageViewer({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault()
        setScale((value) => Math.min(4, value + 0.5))
      }
      if (event.key === '-') {
        event.preventDefault()
        setScale((value) => Math.max(1, value - 0.5))
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      restoreRef.current?.focus?.()
    }
  }, [])

  const reset = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  return (
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`图片预览：${alt}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current()
      }}
    >
      <div className="viewer__bar">
        <p className="viewer__title">{alt}</p>
        <div className="viewer__tools">
          <button
            type="button"
            className="btn btn--sm viewer__tool"
            onClick={() => setScale((value) => Math.max(1, value - 0.5))}
            disabled={scale <= 1}
            aria-label="缩小"
          >
            <ZoomOut size={13} strokeWidth={2} aria-hidden="true" />
          </button>
          <span className="viewer__scale t-data">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="btn btn--sm viewer__tool"
            onClick={() => setScale((value) => Math.min(4, value + 0.5))}
            disabled={scale >= 4}
            aria-label="放大"
          >
            <ZoomIn size={13} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn--sm viewer__tool" onClick={reset}>
            还原
          </button>
          <button
            ref={closeRef}
            type="button"
            className="btn btn--sm viewer__tool viewer__close"
            onClick={() => onCloseRef.current()}
            aria-label="关闭预览"
          >
            <X size={13} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="viewer__stage">
        <img
          className="viewer__img"
          src={src}
          alt={alt}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          onWheel={(event) => {
            event.preventDefault()
            const next = scale + (event.deltaY < 0 ? 0.25 : -0.25)
            setScale(Math.min(4, Math.max(1, next)))
            if (next <= 1) setOffset({ x: 0, y: 0 })
          }}
          onPointerDown={(event) => {
            if (scale <= 1) return
            drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            const state = drag.current
            if (!state) return
            setOffset({
              x: state.ox + (event.clientX - state.x),
              y: state.oy + (event.clientY - state.y),
            })
          }}
          onPointerUp={(event) => {
            drag.current = null
            event.currentTarget.releasePointerCapture(event.pointerId)
          }}
          draggable={false}
        />
      </div>
      <p className="viewer__hint">滚轮或 +/− 缩放，放大后可以拖动；按 Esc 关闭。</p>
    </div>
  )
}
