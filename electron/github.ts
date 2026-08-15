import type { ReleaseInfo } from './shared/types'

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

// GitHub's /releases/latest is NOT simply "the newest release": it honors the
// publisher's make_latest flag and orders by created_at (the tag's date), so a
// release tagged earlier but published later can be left out of it entirely.
// That is how AxiOM kept reporting Unofficial Extras 2.4.1 for hours after 2.5
// shipped. Listing releases and picking the newest published stable one that
// actually ships a matching asset is immune to both — and, as a bonus, skips a
// release that has no asset for us instead of giving up on the repo.
export async function fetchLatestRelease(
  repo: string,
  assetPattern: RegExp,
  token?: string,
): Promise<ReleaseInfo | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${GITHUB_API}/repos/${repo}/releases?per_page=30`, { headers })
    if (!res.ok) return null
    const body = await res.json() as GithubRelease | GithubRelease[]
    const releases = (Array.isArray(body) ? body : [body]).filter(Boolean)
    const usable = releases.filter(r =>
      !r.draft && !r.prerelease && r.assets?.some(a => assetPattern.test(a.name)))
    if (usable.length === 0) return null
    const latest = usable.reduce((a, b) => (releaseTime(b) > releaseTime(a) ? b : a))
    const asset = latest.assets.find(a => assetPattern.test(a.name))!
    return {
      version: latest.tag_name.replace(/^v/, ''),
      downloadUrl: asset.browser_download_url,
      assetSize: asset.size,
      assetDigest: asset.digest ?? undefined,
      publishedAt: latest.published_at,
    }
  } catch {
    return null
  }
}
