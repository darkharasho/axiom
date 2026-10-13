import type { ReleaseInfo } from './shared/types'
import { releaseListBearer } from './tokenScope'

const GITHUB_API = 'https://api.github.com'

interface GithubRelease {
  tag_name: string
  draft?: boolean
  prerelease?: boolean
  published_at?: string
  created_at?: string
  assets: { name: string; browser_download_url: string; size?: number; digest?: string | null }[]
}

function releaseTime(r: GithubRelease): number {
  const t = Date.parse(r.published_at ?? r.created_at ?? '')
  return Number.isNaN(t) ? 0 : t
}

export interface FetchReleaseOpts {
  // Opt in to prereleases (rc builds). Off by default: the newest stable is
  // what a user who hasn't asked for test builds should be offered. Drafts are
  // excluded either way — they aren't published to anyone.
  includePrerelease?: boolean
  // The signed-in GitHub token, for the higher rate limit (tokenScope.ts).
  token?: string | null
}

export type ReleaseCheck =
  | { kind: 'ok'; release: ReleaseInfo }
  | { kind: 'none' }                                // reached GitHub, nothing usable
  | { kind: 'rate-limited'; resetAt: number | null } // GitHub refused: out of requests
  | { kind: 'unavailable' }                          // offline, 5xx, bad response

type FetchResponse = Awaited<ReturnType<typeof fetch>>

function isRateLimited(res: FetchResponse): boolean {
  return res.status === 429 || (res.status === 403 && res.headers?.get?.('x-ratelimit-remaining') === '0')
}

function rateLimitReset(res: FetchResponse): number | null {
  const s = Number(res.headers?.get?.('x-ratelimit-reset'))
  return Number.isFinite(s) && s > 0 ? s * 1000 : null
}

export function rateLimitMessage(resetAt: number | null, signedIn: boolean): string {
  const until = resetAt ? ` until ${new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''
  return `GitHub limit reached${until}${signedIn ? '' : ' · sign in to raise it'}`
}

// GitHub's /releases/latest is NOT simply "the newest release": it honors the
// publisher's make_latest flag and orders by created_at (the tag's date), so a
// release tagged earlier but published later can be left out of it entirely.
// That is how AxiOM kept reporting Unofficial Extras 2.4.1 for hours after 2.5
// shipped. Listing releases and picking the newest published stable one that
// actually ships a matching asset is immune to both — and, as a bonus, skips a
// release that has no asset for us instead of giving up on the repo.
export async function checkLatestRelease(
  repo: string,
  assetPattern: RegExp,
  opts: FetchReleaseOpts = {},
): Promise<ReleaseCheck> {
  const { includePrerelease = false, token } = opts
  try {
    const url = `${GITHUB_API}/repos/${repo}/releases?per_page=30`
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    const auth = releaseListBearer(url, token)
    let res = auth
      // Never follow a redirect with the bearer attached.
      ? await fetch(url, { headers: { ...headers, Authorization: auth }, redirect: 'manual' })
      : await fetch(url, { headers })
    // A revoked or expired token, or a redirect, mustn't cost the check: ask
    // again anonymously, as signed-out users do.
    if (auth && (res.status === 401 || res.status === 0 || res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400))) {
      res = await fetch(url, { headers })
    }
    if (isRateLimited(res)) return { kind: 'rate-limited', resetAt: rateLimitReset(res) }
    if (!res.ok) return { kind: 'unavailable' }
    const body = await res.json() as GithubRelease | GithubRelease[]
    const releases = (Array.isArray(body) ? body : [body]).filter(Boolean)
    // Selection stays newest-by-published_at, so opting into prereleases can't
    // pin anyone to an rc: the stable that follows it is the newer publish.
    const usable = releases.filter(r =>
      !r.draft && (includePrerelease || !r.prerelease) && r.assets?.some(a => assetPattern.test(a.name)))
    if (usable.length === 0) return { kind: 'none' }
    const latest = usable.reduce((a, b) => (releaseTime(b) > releaseTime(a) ? b : a))
    const asset = latest.assets.find(a => assetPattern.test(a.name))!
    return {
      kind: 'ok',
      release: {
        version: latest.tag_name.replace(/^v/, ''),
        downloadUrl: asset.browser_download_url,
        assetSize: asset.size,
        assetDigest: asset.digest ?? undefined,
        publishedAt: latest.published_at,
      },
    }
  } catch {
    return { kind: 'unavailable' }
  }
}

/** checkLatestRelease without the reason: the release, or null. */
export async function fetchLatestRelease(
  repo: string,
  assetPattern: RegExp,
  opts: FetchReleaseOpts = {},
): Promise<ReleaseInfo | null> {
  const r = await checkLatestRelease(repo, assetPattern, opts)
  return r.kind === 'ok' ? r.release : null
}
