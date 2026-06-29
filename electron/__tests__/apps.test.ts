import { describe, it, expect } from 'vitest'
import { APP_META, isInstallable, isAppVisible } from '../apps'

describe('axivale registry entry', () => {
  it('is installable and generally available (not private)', () => {
    const m = APP_META.axivale
    expect(isInstallable(m)).toBe(true)
    expect('private' in m && m.private).toBeFalsy()
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
    expect('private' in m && m.private).toBeFalsy()
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
  // No app ships private today, so synthesize one to cover the gating logic.
  const privateApp = { ...APP_META.axivale, private: true } as typeof APP_META.axivale
  it('hides a private app when locked', () => { expect(isAppVisible(privateApp, false)).toBe(false) })
  it('shows a private app when unlocked', () => { expect(isAppVisible(privateApp, true)).toBe(true) })
  it('always shows a non-private app', () => { expect(isAppVisible(APP_META.axivale, false)).toBe(true) })
})
