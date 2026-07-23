import { describe, it, expect } from 'vitest'
import { APP_META, isInstallable, isAppVisible } from '../apps'

describe('axivale registry entry', () => {
  it('is installable and generally available (not private)', () => {
    const m = APP_META.axivale
    expect(isInstallable(m)).toBe(true)
    expect('allowlist' in m && m.allowlist).toBeFalsy()
  })

  it('asset patterns match real release names', () => {
    const m = APP_META.axivale
    if (!isInstallable(m)) throw new Error('expected installable')
    expect(m.assetPattern.win.test('AxiVale Setup 0.3.1.exe')).toBe(true)
    expect(m.assetPattern.linux.test('AxiVale-0.3.1.AppImage')).toBe(true)
  })
})

describe('axiroster registry entry', () => {
  it('is installable and generally available (not private)', () => {
    const m = APP_META.axiroster
    expect(isInstallable(m)).toBe(true)
    expect('allowlist' in m && m.allowlist).toBeFalsy()
  })

  it('asset patterns match real release names', () => {
    const m = APP_META.axiroster
    if (!isInstallable(m)) throw new Error('expected installable')
    // artifactName is "AxiRoster-${version}-${os}-${arch}.${ext}" for every target.
    expect(m.assetPattern.win.test('AxiRoster-1.0.0-win-x64.exe')).toBe(true)
    expect(m.assetPattern.linux.test('AxiRoster-1.0.0-linux-x64.AppImage')).toBe(true)
  })
})

describe('isAppVisible', () => {
  const gatedApp = { ...APP_META.axivale, allowlist: ['darkharasho', 'gw2dui'] } as typeof APP_META.axivale
  it('hides a gated app from a login not on its allowlist', () => { expect(isAppVisible(gatedApp, 'randomuser')).toBe(false) })
  it('hides a gated app when signed out (null)', () => { expect(isAppVisible(gatedApp, null)).toBe(false) })
  it('shows a gated app to an allowlisted login', () => { expect(isAppVisible(gatedApp, 'gw2dui')).toBe(true) })
  it('always shows a public (no-allowlist) app, even signed out', () => { expect(isAppVisible(APP_META.axivale, null)).toBe(true) })

  it('gates axistream to its allowlist', () => {
    expect(isAppVisible(APP_META.axistream, 'gw2dui')).toBe(true)
    expect(isAppVisible(APP_META.axistream, 'randomuser')).toBe(false)
    expect(isAppVisible(APP_META.axistream, null)).toBe(false)
  })
})
