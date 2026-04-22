import { useState, useEffect, useCallback } from 'react'
import type { AppState } from '@shared/types'

export function useAppStates() {
  const [states, setStates] = useState<AppState[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    window.axiom.getStates().then(setStates)
    const unsub = window.axiom.onStatesUpdated(setStates)
    return () => { unsub() }
  }, [])

  const checkUpdates = useCallback(async () => {
    setChecking(true)
    await window.axiom.checkUpdates()
    setChecking(false)
  }, [])

  return { states, checking, checkUpdates }
}
