// Whether a GitHub login unlocks any gated (allowlisted) registry entry. The
// per-app allowlists live on each APP_META entry (see apps.ts) — this only
// aggregates them for the signed-in status shown in Settings. There is
// intentionally no UI to edit the allowlists; they are code-defined.
import { APP_META } from './apps'

export function isPrivateUnlocked(login: string | null): boolean {
  if (login == null) return false
  return Object.values(APP_META).some(
    meta => 'allowlist' in meta && meta.allowlist != null && meta.allowlist.includes(login),
  )
}
