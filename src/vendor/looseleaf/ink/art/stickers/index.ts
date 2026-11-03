
import type { StickerDef } from '../types'
import { statusPointers } from './status-pointers'
import { spaceWeather } from './space-weather'
import { foodDrink } from './food-drink'
import { officeDesk } from './office-desk'
import { natureAnimals } from './nature-animals'
import { facesCelebrate } from './faces-celebrate'
import { badgesStamps } from './badges-stamps'

export const stickerBatches = { statusPointers, spaceWeather, foodDrink, officeDesk, natureAnimals, facesCelebrate, badgesStamps } as const
export const stickers = { ...statusPointers, ...spaceWeather, ...foodDrink, ...officeDesk, ...natureAnimals, ...facesCelebrate, ...badgesStamps } satisfies Record<string, StickerDef>
export type StickerName = keyof typeof stickers
