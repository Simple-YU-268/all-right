import { ThemedButton } from './ThemedButton'
import { useState, type ReactNode } from 'react'
import { Check, Copy } from '@icon-park/react'
import { MASTERY_LABELS, type Mastery } from '../domain/types'
import { useTheme } from '../domain/theme'
import { Tabs, TabsList, TabsTrigger } from '../vendor/looseleaf/ui/tabs'
import { Badge } from '../vendor/looseleaf/ui/badge'

/** 剪贴板：优先用 Clipboard API，不可用时退回选区复制。 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* 退回下面的老办法 */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** 复制一段文字，按钮自己反馈成功或失败。 */
export function CopyButton({
  text,
  children,
  className = 'btn btn--sm',
}: {
  text: string
  children: ReactNode
  className?: string
}) {
  const [state, setState] = useState<'idle' | 'ok' | 'fail'>('idle')

  const handle = async () => {
    const ok = await copyText(text)
    setState(ok ? 'ok' : 'fail')
    window.setTimeout(() => setState('idle'), 1800)
  }

  return (
    <ThemedButton type="button" className={className} onClick={() => void handle()}>
      {state === 'ok' ? <Check size={13} strokeWidth={2.2} /> : <Copy size={13} strokeWidth={2} />}
      {state === 'ok' ? '已复制' : state === 'fail' ? '复制失败，请手动选取' : children}
    </ThemedButton>
  )
}

/** 墨分五色：同一支靛蓝墨的五级浓淡。 */
export const INK_RAMP = [
  'var(--blue-2)',
  'var(--blue-3)',
  'var(--blue-4)',
  'var(--blue-5)',
  'var(--ink-900)',
] as const

export const MASTERY_INK = ['var(--paper-sunken)', ...INK_RAMP] as const

/** 掌握度 → 墨阶 */
export function masteryInk(mastery: Mastery): string {
  return MASTERY_INK[mastery]
}

export function masteryLabel(mastery: Mastery): string {
  return MASTERY_LABELS[mastery]
}

/**
 * 墨阶刻度条：五格，格数＝正确率，墨色＝掌握度。
 * 同一档里的格子同色，所以墨色只跟着掌握度走——
 * 一格浅蓝配五格近黑，读得出「题做得对，但还没记牢」。
 */
export function InkSteps({
  ratio,
  level,
  size = 'md',
}: {
  ratio: number | null
  /** 墨色档位 0–5；不给就退回按比例取一档 */
  level?: number | null
  size?: 'sm' | 'md' | 'tall'
}) {
  const filled = ratio === null ? 0 : Math.max(0, Math.min(5, Math.round(ratio * 5)))
  const inkLevel = level === null || level === undefined ? filled : Math.max(0, Math.min(5, level))
  const ink = inkLevel > 0 ? INK_RAMP[inkLevel - 1] : undefined
  const cls = size === 'sm' ? 'ink-steps ink-steps--sm' : size === 'tall' ? 'ink-steps ink-steps--tall' : 'ink-steps'
  return (
    <span className={cls} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={i < filled ? 'ink-steps__cell ink-steps__cell--filled' : 'ink-steps__cell'}
          style={i < filled ? ({ '--ink-level': ink } as React.CSSProperties) : undefined}
        />
      ))}
    </span>
  )
}

/** 掌握度标记：一枚方块 + 状态名，颜色即墨阶。 */
export function MasteryMark({ mastery }: { mastery: Mastery }) {
  const [theme] = useTheme()
  if (theme === 'looseleaf') return <Badge variant="outline" size="sm" tone={mastery >= 4 ? 'grass' : 'sky'}>{masteryLabel(mastery)}</Badge>
  return (
    <span className="chip chip--plain" title={`掌握度：${masteryLabel(mastery)}`}>
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: 1,
          background: masteryInk(mastery),
          display: 'inline-block',
        }}
      />
      {masteryLabel(mastery)}
    </span>
  )
}

export function EmptyState({
  title,
  text,
  children,
}: {
  title: string
  text: string
  children?: ReactNode
}) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      <p className="empty__text">{text}</p>
      {children ? <div className="empty__actions">{children}</div> : null}
    </div>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  const [theme] = useTheme()
  if (theme === 'looseleaf') return <Tabs value={String(value)} onValueChange={next => {
    const option = options.find(item => String(item.value) === next)
    if (option) onChange(option.value)
  }}><TabsList className="segmented" aria-label={label}>{options.map(option => <TabsTrigger key={String(option.value)} value={String(option.value)} className="segmented__item">{option.label}</TabsTrigger>)}</TabsList></Tabs>
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((opt) => (
        <ThemedButton
          key={String(opt.value)}
          type="button"
          className={opt.value === value ? 'segmented__item segmented__item--active' : 'segmented__item'}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </ThemedButton>
      ))}
    </div>
  )
}
