import { defineRecipe } from './'
import { reveal, revealId, REVEAL_DASH } from './/draw-on-ink'
import { bracketLines } from '../shapes'
import type { Line } from '../types'

export interface MarginBracketParams {
  kind: 'square' | 'curly'
}

export const MARGIN_BRACKET_DRAW = `${REVEAL_DASH} in-data-touched:[&>svg_[data-part=reveal]]:animate-[ll-draw_var(--ll-dur-draw)_var(--ll-ease-out)_both]`

export const marginBracketRecipe = defineRecipe<MarginBracketParams>({
  id: 'margin-bracket',
  kind: 'bracket',
  layers: ['rest'],
  pad: 8,
  draw(ink, { w, h }, { kind }, ctx) {
    const rtl = ctx.dir === 'rtl'
    const dir = rtl ? -1 : 1
    const x = rtl ? w - 1.5 : 1.5
    const lines: Line[] = bracketLines(ink.next('bracket'), x, 1, Math.max(8, h - 2), { kind, dir })
    ink.layer('rest', () => {
      reveal(ink, {
        id: revealId(ctx.seed, 'b'),
        lines,
        pen: ctx.calm ? 'bluepencil.fine' : 'bluepencil',
        width: ctx.calm ? 1.1 : 1.65,
        box: { w, h },
        revealWidth: Math.max(4, Math.min(w, 14)),
      })
    })
  },
})
