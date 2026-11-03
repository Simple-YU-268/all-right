
import type { ArtDef } from '../types'
import { arrows } from './arrows'
import { marks } from './marks'
import { status } from './status'
import { layout } from './layout'
import { files } from './files'
import { comms } from './comms'
import { devData } from './dev-data'
import { textNatureMisc } from './text-nature-misc'
import { media } from './media'
import { commerceTime } from './commerce-time'

export const iconBatches = { arrows, marks, status, layout, files, comms, devData, textNatureMisc, media, commerceTime } as const
export const icons = { ...arrows, ...marks, ...status, ...layout, ...files, ...comms, ...devData, ...textNatureMisc, ...media, ...commerceTime } satisfies Record<string, ArtDef>
export type IconName = keyof typeof icons
export * from './aliases'
