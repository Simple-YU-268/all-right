import { useCallback, useEffect, useState } from 'react'

const KEY = 'allright.motion.v1'

export type MotionPref = 'full' | 'reduced'

export function loadMotion(): MotionPref {
  if (typeof localStorage === 'undefined') return 'full'
  try {
    return localStorage.getItem(KEY) === 'reduced' ? 'reduced' : 'full'
  } catch {
    return 'full'
  }
}

/** 把偏好写到根元素上，CSS 靠这个属性关掉动效。 */
export function applyMotion(pref: MotionPref): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-motion', pref)
}

export function saveMotion(pref: MotionPref): void {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* 存不下也不影响使用，本次会话内仍然生效 */
  }
  applyMotion(pref)
}

export function useMotionPref(): [MotionPref, (pref: MotionPref) => void] {
  const [pref, setPref] = useState<MotionPref>(loadMotion)

  useEffect(() => {
    applyMotion(pref)
  }, [pref])

  const update = useCallback((next: MotionPref) => {
    saveMotion(next)
    setPref(next)
  }, [])

  return [pref, update]
}
