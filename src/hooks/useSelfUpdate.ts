import { useEffect, useState } from 'react'

export type SelfUpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'
export interface SelfUpdateState { status: SelfUpdateStatus; version?: string; error?: string }

export function useSelfUpdate(): SelfUpdateState {
  const [state, setState] = useState<SelfUpdateState>({ status: 'idle' })
  useEffect(() => window.axiom.onSelfUpdateStatus(d => setState(d as SelfUpdateState)), [])
  return state
}
