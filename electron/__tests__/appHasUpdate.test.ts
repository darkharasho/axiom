import { describe, it, expect } from 'vitest'
import { appHasUpdate, INSTALLED_VERSION_UNKNOWN } from '../shared/types'

describe('appHasUpdate', () => {
  it('flags a known installed version behind the latest release', () => {
    expect(appHasUpdate('0.3.1', '0.3.2')).toBe(true)
  })
  it('does not flag a matching version', () => {
    expect(appHasUpdate('0.3.2', '0.3.2')).toBe(false)
  })
  it('does NOT flag the unknown-version sentinel', () => {
    // Regression: a manually-installed app (e.g. AxiRoster dropped in as a bare
    // AppImage) reports the 'installed' sentinel, which used to compare unequal
    // to the latest release and light the tray dot with no update in the list.
    expect(appHasUpdate(INSTALLED_VERSION_UNKNOWN, '1.0.0')).toBe(false)
  })
  it('does not flag when not installed or latest is unknown', () => {
    expect(appHasUpdate(null, '1.0.0')).toBe(false)
    expect(appHasUpdate('1.0.0', null)).toBe(false)
  })
})
