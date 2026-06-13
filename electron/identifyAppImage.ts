import * as fs from 'fs'
import * as crypto from 'crypto'

/**
 * Decide whether a locally-installed AppImage is the exact same file as a GitHub
 * release asset, so we can pin down the installed version of a generically-named
 * AppImage (e.g. a manually-installed `axivale.appimage`).
 *
 * The size check is instant and rejects almost all mismatches; the sha256 hash —
 * which reads the whole file — runs only when sizes already agree, so for a real
 * match we hash at most once and the caller persists the result for next time.
 *
 * `assetDigest` is GitHub's `"sha256:<hex>"` form. If the release exposes no
 * digest we fall back to a size-only match (best effort).
 */
export function appImageMatchesAsset(
  filePath: string,
  assetSize: number | undefined,
  assetDigest: string | undefined,
): boolean {
  let size: number
  try {
    size = fs.statSync(filePath).size
  } catch {
    return false
  }
  if (assetSize == null || size !== assetSize) return false
  if (!assetDigest) return true // size matched and we have nothing better to compare

  const [algo, expected] = assetDigest.split(':')
  if (!algo || !expected) return false
  try {
    const hash = crypto.createHash(algo)
    hash.update(fs.readFileSync(filePath))
    return hash.digest('hex') === expected.toLowerCase()
  } catch {
    return false
  }
}
