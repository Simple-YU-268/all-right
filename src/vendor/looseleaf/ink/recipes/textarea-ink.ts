import { defineRecipe } from './'
import { drawFieldFrame } from './/field-frame-ink'

export interface TextareaParams {
  disabled?: boolean
  invalid?: boolean
  readOnly?: boolean
  ruled?: boolean
  lineHeight?: number
  ruleTop?: number
  grip?: boolean
}

export const textareaRecipe = defineRecipe<TextareaParams>({
  id: 'textarea',
  kind: 'field',
  layers: ['rest', 'hover', 'focus', 'invalid', 'disabled'],
  lazy: ['focus', 'hover'],
  pad: 12,
  draw(ink, box, params, ctx) {
    drawFieldFrame(ink, box, { ...params, multiline: true }, ctx)
  },
})
