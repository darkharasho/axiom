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

export type UnlockDecision =
  | { ok: true; login: string; id: number; scopes: string[] }
  | { ok: false; error: string }

/** Decide what to do with a token from a device flow that requested repo, using
 *  the account GitHub says owns it (not whoever was signed in). A different
 *  account approving the code is refused; the eligible account is accepted with
 *  the scopes GitHub actually granted, which may lack repo. */
export function decideUnlockResult(user: { login: string; id: number; scopes: string[] }): UnlockDecision {
  if (!isPrivateEligible(user.login)) {
    return { ok: false, error: 'That GitHub account cannot unlock private apps. Approve the code with the account you signed in with.' }
  }
  return { ok: true, login: user.login, id: user.id, scopes: user.scopes }
}
