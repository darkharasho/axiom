import type { ReleaseInfo } from './shared/types'

const GITHUB_API = 'https://api.github.com'

export async function fetchLatestRelease(
  repo: string,
  assetPattern: RegExp,
): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    })
    if (!res.ok) return null
    const data = await res.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    const version = data.tag_name.replace(/^v/, '')
    const asset = data.assets.find(a => assetPattern.test(a.name))
    if (!asset) return null
    return { version, downloadUrl: asset.browser_download_url }
  } catch {
    return null
  }
}
