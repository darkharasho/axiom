// Release lookup for private: true APP_META entries. Unlike github.ts (public,
// anonymous, release list), this asks /releases/latest with the bearer, and
// returns the asset's API url as downloadUrl: a private asset's
// browser_download_url can't be fetched with a token. The bearer comes only from
// bearerFor, so it can't reach any other path.
import type { ReleaseInfo } from './shared/types'
import type { FetchFn } from './githubAuth'
import { bearerFor } from './tokenScope'

const GITHUB_API = 'https://api.github.com'

export type PrivateReleaseResult =
  | { kind: 'ok'; release: ReleaseInfo }
  | { kind: 'auth' }        // 401/404: token revoked, scope lost, or no access
  | { kind: 'unavailable' } // offline, 5xx, or no matching asset

interface LatestRelease {
  tag_name: string
  published_at?: string
  assets?: { name: string; url: string; size?: number; digest?: string | null }[]
}

export const signInAgainMessage = (name: string): string => `Sign in again to update ${name}`
export const unlockMessage = (name: string): string => `Unlock private apps in Settings to update ${name}`

export async function fetchPrivateRelease(
  repo: string,
  assetPattern: RegExp,
  token: string | null,
  fetchFn: FetchFn = fetch,
): Promise<PrivateReleaseResult> {
  const url = `${GITHUB_API}/repos/${repo}/releases/latest`
  const auth = bearerFor(url, token)
  if (!auth) return { kind: 'unavailable' } // not a private entry, or no token: send nothing
  try {
    const res = await fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AxiOM',
        Authorization: auth,
      },
      // Never follow a redirect with the bearer in play: a 3xx (or the opaque
      // redirect manual mode can yield) is simply "unavailable".
      redirect: 'manual',
    })
    if (res.status === 0 || res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return { kind: 'unavailable' }
    if (res.status === 401 || res.status === 404) return { kind: 'auth' }
    if (!res.ok) return { kind: 'unavailable' }
    const rel = (await res.json()) as LatestRelease
    const asset = rel.assets?.find(a => assetPattern.test(a.name))
    if (!asset) return { kind: 'unavailable' }
    return {
      kind: 'ok',
      release: {
        version: rel.tag_name.replace(/^v/, ''),
        downloadUrl: asset.url,
        assetName: asset.name,
        assetSize: asset.size,
        assetDigest: asset.digest ?? undefined,
        publishedAt: rel.published_at,
      },
    }
  } catch {
    return { kind: 'unavailable' }
  }
}

/** Remembers which token failed for which app, so the same token is not
 *  retried. A new token (sign in again, unlock) clears it implicitly. */
export class AuthFailureLatch {
  private readonly failed = new Map<string, string>()
  trip(appId: string, token: string): void { this.failed.set(appId, token) }
  isTripped(appId: string, token: string): boolean { return this.failed.get(appId) === token }
}

export interface PrivateCheckInput {
  appId: string
  name: string
  repo: string
  assetPattern: RegExp
  token: string | null
  scopes: readonly string[]
  latch: AuthFailureLatch
  fetchFn?: FetchFn
}

export async function resolvePrivateRelease(i: PrivateCheckInput): Promise<{ release: ReleaseInfo | null; notice?: string }> {
  // A read:user token is guaranteed a 404 here; don't ask, point at the unlock.
  if (!i.token || !i.scopes.includes('repo')) return { release: null, notice: unlockMessage(i.name) }
  if (i.latch.isTripped(i.appId, i.token)) return { release: null, notice: signInAgainMessage(i.name) }
  const r = await fetchPrivateRelease(i.repo, i.assetPattern, i.token, i.fetchFn)
  if (r.kind === 'auth') {
    i.latch.trip(i.appId, i.token)
    return { release: null, notice: signInAgainMessage(i.name) }
  }
  if (r.kind === 'ok') return { release: r.release }
  return { release: null }
}
