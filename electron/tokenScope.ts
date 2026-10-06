// The one rule for where the signed-in GitHub token may go. After "Unlock
// private apps" the token carries the repo scope, so it is attached only to
// api.github.com requests under /repos/<repo>/ of a private: true APP_META
// entry. Everything else (public apps, arcdps plugins, the signed storage
// host a private asset redirects to) is anonymous.
//
// Scope of this rule: requests under /repos/<repo>/ only. The identity lookup
// GET https://api.github.com/user is an explicit, documented exception: it
// sends the token (to learn who signed in) but deliberately does not go
// through bearerFor, since it is not a /repos/ request.
import { APP_META } from './apps'

export type ScopeMeta = { repo: string | null; private?: boolean }

const API_HOST = 'api.github.com'

function privateRepoPrefixes(metas: readonly ScopeMeta[]): string[] {
  return metas
    .filter(m => m.private === true && typeof m.repo === 'string' && m.repo.length > 0)
    .map(m => `/repos/${(m.repo as string).toLowerCase()}/`)
}

export function bearerFor(
  url: string,
  token: string | null | undefined,
  metas: readonly ScopeMeta[] = Object.values(APP_META),
): string | undefined {
  if (!token) return undefined
  let u: URL
  try { u = new URL(url) } catch { return undefined }
  // URL has already lowercased the host, dropped a default :443 and resolved
  // ./.. (including %2e%2e) segments, so these compares see the real target.
  if (u.protocol !== 'https:' || u.host !== API_HOST || u.username || u.password) return undefined
  const path = u.pathname.toLowerCase()
  return privateRepoPrefixes(metas).some(prefix => path.startsWith(prefix)) ? `Bearer ${token}` : undefined
}

/** Headers for downloading a private release asset through its API url, or
 *  undefined when the url is not a private asset (the anonymous public path). */
export function assetDownloadHeaders(url: string, token: string | null | undefined): Record<string, string> | undefined {
  const auth = bearerFor(url, token)
  if (!auth) return undefined
  return { Authorization: auth, Accept: 'application/octet-stream', 'User-Agent': 'AxiOM' }
}
