import { defineRecipe } from './'
import { drawSelectFrame } from './/select-frame-ink'

export interface NativeSelectParams {
  disabled?: boolean
  invalid?: boolean
}

export const nativeSelectRecipe = defineRecipe<NativeSelectParams>({
  id: 'native-select',
  kind: 'field',
  layers: ['rest', 'hover', 'focus', 'invalid', 'disabled'],
  lazy: ['focus', 'hover'],
  pad: 12,
  draw(ink, box, params, ctx) {
    drawSelectFrame(ink, box, { ...params, openable: false }, ctx)
  },
})
