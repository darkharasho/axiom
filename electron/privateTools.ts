// Whether a GitHub login unlocks any gated (allowlisted) registry entry. The
// per-app allowlists live on each APP_META entry (see apps.ts) — this only
// aggregates them for the signed-in status shown in Settings. There is
// intentionally no UI to edit the allowlists; they are code-defined.
import { APP_META, isInstallable } from './apps'
import { SCOPE_BASIC, SCOPE_PRIVATE } from './githubAuth'

export function isPrivateUnlocked(login: string | null): boolean {
  if (login == null) return false
  return Object.values(APP_META).some(
    meta => 'allowlist' in meta && meta.allowlist != null && meta.allowlist.includes(login),
  )
}

/** The login is on the allowlist of an entry whose repo is private, so it may
 *  be asked for the repo scope. */
export function isPrivateEligible(login: string | null): boolean {
  if (login == null) return false
  return Object.values(APP_META).some(
    meta => isInstallable(meta) && meta.private === true && meta.allowlist != null && meta.allowlist.includes(login),
  )
}

/** Show the one-time "Unlock private apps" action: eligible, and the stored
 *  token has no repo scope yet (an old record with no scopes counts as none). */
export function needsPrivateUnlock(login: string | null, scopes: readonly string[] | undefined): boolean {
  return isPrivateEligible(login) && !(scopes ?? []).includes('repo')
}

export type DeviceFlowMode = 'sign-in' | 'unlock'

/** The scope a device flow may request. Enforced in the main process so a
 *  login that isn't allowlisted is never asked for repo, whatever the renderer sends. */
export function deviceFlowScope(mode: DeviceFlowMode, login: string | null, scopes: readonly string[] | undefined): string {
  if (mode === 'sign-in') return SCOPE_BASIC
  if (!needsPrivateUnlock(login, scopes)) throw new Error('This GitHub account has no private apps to unlock.')
  return SCOPE_PRIVATE
}

export type AuthOutcome =
  | { ok: true; login: string; id: number | null; scopes: string[] }
  | { ok: false; error: string }

/** Remove and return the scopes requested for a device code; null if unknown or
 *  already consumed. */
export function takePending(pending: Map<string, string[]>, deviceCode: string): string[] | null {
  const requested = pending.get(deviceCode) ?? null
  pending.delete(deviceCode)
  return requested
}

/** Decide what to do with a token after the device flow, from what GitHub says
 *  about it (not who was signed in). `user` is the /user result (null if the
 *  call failed); `fallbackLogin` exists only for a plain sign-in whose /user
 *  call failed. A token granted repo is stored only for an eligible login, on
 *  every path. An unlock requires /user and an eligible login, and keeps the
 *  true granted scopes (which may lack repo). */
export function resolveAuthOutcome(input: {
  requested: readonly string[]
  user: { login: string; id: number; scopes: string[] } | null
  fallbackLogin?: string
}): AuthOutcome {
  const { requested, user, fallbackLogin } = input
  const isUnlock = requested.includes('repo')
  if (user == null) {
    if (isUnlock) return { ok: false, error: 'Could not verify which GitHub account approved the unlock. Try again.' }
    if (fallbackLogin == null) return { ok: false, error: 'Could not read your GitHub account.' }
    // Scopes unknown: record read:user only, so nothing private unlocks.
    return { ok: true, login: fallbackLogin, id: null, scopes: [SCOPE_BASIC] }
  }
  if ((isUnlock || user.scopes.includes('repo')) && !isPrivateEligible(user.login)) {
    return { ok: false, error: 'That GitHub account cannot unlock private apps. Approve the code with the account you signed in with.' }
  }
  return { ok: true, login: user.login, id: user.id, scopes: user.scopes }
}
