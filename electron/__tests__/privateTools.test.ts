import { describe, it, expect, vi } from 'vitest'
import { isPrivateUnlocked } from '../privateTools'

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
