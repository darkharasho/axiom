import { describe, it, expect } from 'vitest'
import { APP_META, isInstallable, isAppVisible } from '../apps'

describe('axivale registry entry', () => {
  it('is installable and marked private', () => {
    const m = APP_META.axivale
    expect(isInstallable(m)).toBe(true)
    expect('private' in m && m.private).toBe(true)
  })

  it('asset patterns match real release names', () => {
    const m = APP_META.axivale
    if (!isInstallable(m)) throw new Error('expected installable')
    expect(m.assetPattern.win.test('AxiVale Setup 0.3.1.exe')).toBe(true)
    expect(m.assetPattern.linux.test('AxiVale-0.3.1.AppImage')).toBe(true)
  })
})

describe('isAppVisible', () => {
  it('hides a private app when locked', () => { expect(isAppVisible(APP_META.axivale, false)).toBe(false) })
  it('shows a private app when unlocked', () => { expect(isAppVisible(APP_META.axivale, true)).toBe(true) })
  it('always shows a non-private app', () => { expect(isAppVisible(APP_META.axibridge, false)).toBe(true) })
})
