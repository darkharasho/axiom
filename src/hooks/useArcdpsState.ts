import { useState, useEffect, useCallback } from 'react'
import type { ArcdpsState } from '@shared/types'

const EMPTY: ArcdpsState = { gw2Path: null, gw2PathSource: 'none', plugins: [] }

export function useArcdpsState() {
  const [state, setState] = useState<ArcdpsState>(EMPTY)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    window.axiom.getArcdpsState().then(setState)
    const unsub = window.axiom.onArcdpsStateUpdated(setState)
    return () => { unsub() }
  }, [])

  const check = useCallback(async () => {
    setChecking(true)
    try { await window.axiom.checkArcdpsUpdates() }
    finally { setChecking(false) }
  }, [])

  const install = useCallback((id: string) => window.axiom.installArcdpsPlugin(id), [])
  const setGw2Path = useCallback((p: string | null) => window.axiom.setGw2Path(p), [])

  return { state, checking, check, install, setGw2Path }
}
