
import type { ArtDef } from '../types'
import { poses } from './poses'
import * as mascotBody from './body'
import * as mascotProps from './props'

export const mascotBatches = { poses } as const
export const mascot = { ...poses } satisfies Record<string, ArtDef>
export type MascotPose = keyof typeof mascot
export { mascotBody }
export { mascotProps }
