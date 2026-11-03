
import type { ArtDef } from '../types'
import { nature } from './nature'
import { things } from './things'
import { marks } from './marks'

export const doodleBatches = { nature, things, marks } as const
export const doodles = { ...nature, ...things, ...marks } satisfies Record<string, ArtDef>
export type DoodleName = keyof typeof doodles
