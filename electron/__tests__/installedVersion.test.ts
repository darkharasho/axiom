import { describe, it, expect } from 'vitest'
import { resolveInstalledVersion } from '../installedVersion'
import { INSTALLED_VERSION_UNKNOWN } from '../shared/types'

describe('resolveInstalledVersion', () => {
  it('uses the detected version when the filename carried one', () => {
    expect(resolveInstalledVersion('2.10.1', null)).toBe('2.10.1')
    expect(resolveInstalledVersion('2.10.1', '2.9.0')).toBe('2.10.1')
  })

  it('reports null when nothing is detected and nothing was stored', () => {
    expect(resolveInstalledVersion(null, null)).toBeNull()
  })

  it('keeps the stored version when detection only knows it is installed', () => {
    expect(resolveInstalledVersion(INSTALLED_VERSION_UNKNOWN, '0.3.1')).toBe('0.3.1')
  })

  it('still reports as installed when version is unknown and nothing was stored (manual install)', () => {
    // Regression: a manually-installed AppImage with no version in its filename
    // must not collapse to null and look "not installed".
    expect(resolveInstalledVersion(INSTALLED_VERSION_UNKNOWN, null)).toBe(INSTALLED_VERSION_UNKNOWN)
  })
})
