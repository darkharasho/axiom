import { describe, it, expect, vi } from 'vitest'
import { isPrivateUnlocked, needsPrivateUnlock, deviceFlowScope, resolveAuthOutcome, takePending } from '../privateTools'

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

describe('resolveAuthOutcome', () => {
  const U = (login: string, scopes: string[]) => ({ login, id: 7, scopes })
  const UNLOCK = ['read:user', 'repo']
  const BASIC = ['read:user']

  it('refuses a different account approving an unlock', () => {
    expect(resolveAuthOutcome({ requested: UNLOCK, user: U('randomuser', UNLOCK) }).ok).toBe(false)
  })
  it('refuses an unlock when /user failed, ignoring any fallback login', () => {
    expect(resolveAuthOutcome({ requested: UNLOCK, user: null, fallbackLogin: 'darkharasho' }).ok).toBe(false)
  })
  it('accepts an unlock for the eligible account', () => {
    expect(resolveAuthOutcome({ requested: UNLOCK, user: U('darkharasho', UNLOCK) }))
      .toEqual({ ok: true, login: 'darkharasho', id: 7, scopes: UNLOCK })
  })
  it('keeps the true granted scopes when an unlock was granted without repo', () => {
    expect(resolveAuthOutcome({ requested: UNLOCK, user: U('darkharasho', BASIC) }))
      .toEqual({ ok: true, login: 'darkharasho', id: 7, scopes: BASIC })
  })
  it('refuses a plain sign-in whose token was granted repo for a non-eligible login', () => {
    expect(resolveAuthOutcome({ requested: BASIC, user: U('randomuser', UNLOCK) }).ok).toBe(false)
  })
  it('stores a plain sign-in granted repo for an eligible login', () => {
    expect(resolveAuthOutcome({ requested: BASIC, user: U('darkharasho', UNLOCK) }))
      .toEqual({ ok: true, login: 'darkharasho', id: 7, scopes: UNLOCK })
  })
  it('signs in via the fallback login with read:user and no id', () => {
    expect(resolveAuthOutcome({ requested: BASIC, user: null, fallbackLogin: 'randomuser' }))
      .toEqual({ ok: true, login: 'randomuser', id: null, scopes: ['read:user'] })
  })
  it('signs in normally with the granted scopes', () => {
    expect(resolveAuthOutcome({ requested: BASIC, user: U('randomuser', BASIC) }))
      .toEqual({ ok: true, login: 'randomuser', id: 7, scopes: BASIC })
  })
})

describe('takePending', () => {
  it('returns and consumes the entry', () => {
    const m = new Map([['d', ['read:user']]])
    expect(takePending(m, 'd')).toEqual(['read:user'])
    expect(m.has('d')).toBe(false)
  })
  it('returns null for an unknown or already consumed code', () => {
    const m = new Map<string, string[]>()
    expect(takePending(m, 'nope')).toBeNull()
  })
})
