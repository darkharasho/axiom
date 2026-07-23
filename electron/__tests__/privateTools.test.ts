import { describe, it, expect } from 'vitest'
import { isPrivateUnlocked } from '../privateTools'

describe('isPrivateUnlocked', () => {
  it('is true for a login on a private app allowlist', () => { expect(isPrivateUnlocked('darkharasho')).toBe(true) })
  it('is true for gw2dui (axistream allowlist)', () => { expect(isPrivateUnlocked('gw2dui')).toBe(true) })
  it('is false for any other login', () => { expect(isPrivateUnlocked('randomuser')).toBe(false) })
  it('is false when signed out (null)', () => { expect(isPrivateUnlocked(null)).toBe(false) })
})
