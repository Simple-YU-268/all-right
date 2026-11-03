
import type { ArtDef } from '../types'
import { emptyScenes } from './empty-scenes'

export const sceneBatches = { emptyScenes } as const
export const scenes = { ...emptyScenes } satisfies Record<string, ArtDef>
export type SceneName = keyof typeof scenes
