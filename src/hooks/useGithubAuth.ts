import { useState, useEffect, useCallback } from 'react'
import type { GithubAuthState } from '@shared/types'

const SIGNED_OUT: GithubAuthState = { signedIn: false, login: null, unlocked: false }

export function useGithubAuth() {
  const [status, setStatus] = useState<GithubAuthState>(SIGNED_OUT)
  const [userCode, setUserCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.axiom.githubGetStatus().then(setStatus)
    const unsub = window.axiom.onGithubStatusUpdated(setStatus)
    return () => { unsub() }
  }, [])

  const signIn = useCallback(async () => {
    setBusy(true)
    setError(null)
    setUserCode(null)
    try {
      const begin = await window.axiom.githubAuthBegin()
      setUserCode(begin.userCode)
      const res = await window.axiom.githubAuthComplete(begin.deviceCode, begin.interval, begin.expiresIn)
      if (!res.ok) setError(res.error ?? 'Sign-in failed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUserCode(null)
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    await window.axiom.githubSignOut()
  }, [])

  return { status, userCode, busy, error, signIn, signOut }
}
