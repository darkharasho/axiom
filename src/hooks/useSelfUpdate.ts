import { useEffect, useState } from 'react'

export type SelfUpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'
export interface SelfUpdateState { status: SelfUpdateStatus; version?: string; error?: string }

export function useSelfUpdate(): SelfUpdateState {
  const [state, setState] = useState<SelfUpdateState>({ status: 'idle' })
  useEffect(() => {
    // Subscribe first, then pull the current status — the startup update check
    // can fire available/ready before this component mounts, and those events
    // aren't replayed. Subscribing before pulling avoids missing an event that
    // lands between the two.
    const unsub = window.axiom.onSelfUpdateStatus(d => setState(d as SelfUpdateState))
    window.axiom.getSelfUpdateStatus().then(d => {
      // Don't clobber a fresher live event with the (possibly older) snapshot.
      setState(prev => (prev.status === 'idle' ? (d as SelfUpdateState) : prev))
    })
    return unsub
  }, [])
  return state
}
