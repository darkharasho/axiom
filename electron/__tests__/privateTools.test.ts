import { describe, it, expect } from 'vitest'
import { isPrivateUnlocked, PRIVATE_TOOL_ALLOWLIST } from '../privateTools'

describe('isPrivateUnlocked', () => {
  it('is true for an allowlisted login', () => { expect(isPrivateUnlocked('darkharasho')).toBe(true) })
  it('is false for any other login', () => { expect(isPrivateUnlocked('randomuser')).toBe(false) })
  it('is false when signed out (null)', () => { expect(isPrivateUnlocked(null)).toBe(false) })
  it('allowlist contains darkharasho', () => { expect(PRIVATE_TOOL_ALLOWLIST).toContain('darkharasho') })
})
