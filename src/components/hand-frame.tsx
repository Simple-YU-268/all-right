import { defineRecipe } from '../vendor/looseleaf/ink/recipes'
import { box } from '../vendor/looseleaf/ink/shapes'
import { roundRectPoly } from '../vendor/looseleaf/ink/geom'
import { clamp } from '../vendor/looseleaf/ink/rng'

export interface HandFrameParams {
  /** 底纹压多实一点，批改条比选项行更需要一个"这是一张纸"的边界。 */
  opacity?: number
}

/**
 * 手绘主题里的纸框：一张贴在纸面上的小纸片，底纹走 `--ll-slip`，框线走 `--ll-ink`。
 * 两者都是 CSS 变量，所以对错色由外层覆盖 `--ll-slip` / `--ll-ink` 决定，
 * 画线本身仍是 Looseleaf 引擎画出来的铅笔线。
 */
export const handFrameRecipe = defineRecipe<HandFrameParams>({
  id: 'hand-frame',
  kind: 'hand-frame',
  layers: ['rest'],
  pad: 5,
  draw(ink, { w, h }, { opacity }, ctx) {
    const r = clamp(Math.min(w, h) * 0.09, 2.5, 4.4)
    const body = roundRectPoly(1.5, 1.5, w - 3, h - 3, r)
    const wide = w > 320
    ink.layer('rest', () => {
      ink.poly('under', body, 'slip', opacity ?? 0.9)
      if (ctx.calm) box(ink, 1, 1, w - 2, h - 2, { pen: 'pencil.fine', corner: r })
      else box(ink, 1, 1, w - 2, h - 2, { pen: 'ink', corner: r, opts: wide ? { simple: true } : undefined })
    })
  },
})
