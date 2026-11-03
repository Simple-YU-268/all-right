"use client"

import * as React from "react"

import { ensureInkDefs } from "./defs"
import { useInkContext } from "./hooks"

export function useEnsureInkDefs(): void {
  const { hasProvider } = useInkContext()
  React.useLayoutEffect(() => {
    if (!hasProvider) ensureInkDefs()
  }, [hasProvider])
}
