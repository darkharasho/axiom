import { describe, it, expect, vi } from 'vitest'
import { isPrivateUnlocked, needsPrivateUnlock, deviceFlowScope, decideUnlockResult } from '../privateTools'

// No registry entry is gated today — AxiStream was the last one and went
// generally available in AxiStream 1.0. The aggregation still has to work for
// the next gated app, so the positive case runs against the real registry plus
// one synthetic gated entry rather than being deleted along with the gate.
vi.mock('../apps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../apps')>()
  return {
    ...actual,
    APP_META: {
      ...actual.APP_META,
      gatedonly: { id: 'gatedonly', name: 'GatedOnly', repo: null, allowlist: ['gatedonly'] },
      gatedfixture: { id: 'gatedfixture', name: 'GatedFixture', repo: null, allowlist: ['darkharasho'] },
    },
  }
})

describe('isPrivateUnlocked', () => {
  it('is true for a login on a gated entry allowlist', () => { expect(isPrivateUnlocked('darkharasho')).toBe(true) })
  it('is false for any other login', () => { expect(isPrivateUnlocked('randomuser')).toBe(false) })
  it('is false when signed out (null)', () => { expect(isPrivateUnlocked(null)).toBe(false) })
  it('is false for gw2dui now that axistream is public', () => { expect(isPrivateUnlocked('gw2dui')).toBe(false) })
})

describe('needsPrivateUnlock', () => {
  it('is true for an allowlisted login without the repo scope', () => {
    expect(needsPrivateUnlock('darkharasho', ['read:user'])).toBe(true)
  })
  it('is true for an old identity with no recorded scopes', () => {
    expect(needsPrivateUnlock('darkharasho', undefined)).toBe(true)
  })
  it('is false once repo is granted', () => {
    expect(needsPrivateUnlock('darkharasho', ['read:user', 'repo'])).toBe(false)
  })
  it('is false for a login on no allowlist', () => {
    expect(needsPrivateUnlock('randomuser', ['read:user'])).toBe(false)
  })
  it('is false for a login only on a gated entry that is not private', () => {
    expect(isPrivateUnlocked('gatedonly')).toBe(true)
    expect(needsPrivateUnlock('gatedonly', ['read:user'])).toBe(false)
  })
  it('is false when signed out', () => {
    expect(needsPrivateUnlock(null, undefined)).toBe(false)
  })
})

describe('deviceFlowScope', () => {
  it('asks every login for read:user only on sign-in', () => {
    expect(deviceFlowScope('sign-in', null, undefined)).toBe('read:user')
    expect(deviceFlowScope('sign-in', 'darkharasho', ['read:user'])).toBe('read:user')
  })
  it('asks an allowlisted login for repo on unlock', () => {
    expect(deviceFlowScope('unlock', 'darkharasho', ['read:user'])).toBe('read:user repo')
  })
  it('never asks a login that is not allowlisted for repo', () => {
    expect(() => deviceFlowScope('unlock', 'randomuser', ['read:user'])).toThrow()
    expect(() => deviceFlowScope('unlock', 'gatedonly', ['read:user'])).toThrow()
    expect(() => deviceFlowScope('unlock', null, undefined)).toThrow()
  })
  it('refuses a second unlock once repo is granted', () => {
    expect(() => deviceFlowScope('unlock', 'darkharasho', ['read:user', 'repo'])).toThrow()
  })
})

describe('decideUnlockResult', () => {
  it('rejects a different account approving the code', () => {
    const r = decideUnlockResult({ login: 'randomuser', id: 1, scopes: ['read:user', 'repo'] })
    expect(r.ok).toBe(false)
  })
  it('accepts the eligible account with the granted scopes', () => {
    expect(decideUnlockResult({ login: 'darkharasho', id: 1, scopes: ['read:user', 'repo'] }))
      .toEqual({ ok: true, login: 'darkharasho', id: 1, scopes: ['read:user', 'repo'] })
  })
  it('keeps the true granted scopes when repo was not granted', () => {
    const r = decideUnlockResult({ login: 'darkharasho', id: 1, scopes: ['read:user'] })
    expect(r).toEqual({ ok: true, login: 'darkharasho', id: 1, scopes: ['read:user'] })
  })
})
