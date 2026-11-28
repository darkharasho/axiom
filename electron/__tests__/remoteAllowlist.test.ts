import { describe, it, expect } from 'vitest'
import { createRemoteAllowlist, parseHashList } from '../remoteAllowlist'

const H = (id: number) => 'a'.repeat(63) + String(id % 10)
const fakeHash = (id: number) => Promise.resolve(H(id))

function fakeConfig(flags: Record<string, unknown>) {
  const listeners: (() => void)[] = []
  return {
    flags,
    fire: () => listeners.forEach(l => l()),
    flag: <T>(key: string, fb: T): T => (key in flags ? (flags[key] as T) : fb),
    onChange: (l: () => void) => { listeners.push(l); return () => {} },
  }
}

describe('parseHashList', () => {
  it('keeps only 64-char lowercase hex strings', () => {
    expect(parseHashList(['a'.repeat(64), 'A'.repeat(64), 'abc', 5])).toEqual(['a'.repeat(64)])
  })
  it('treats a non-array as empty', () => {
    expect(parseHashList('x')).toEqual([])
    expect(parseHashList({})).toEqual([])
    expect(parseHashList(undefined)).toEqual([])
  })
})

describe('createRemoteAllowlist', () => {
  it('allows nothing before the id is known', () => {
    const r = createRemoteAllowlist(fakeConfig({ 'allowlist.axidps': [H(1)] }), fakeHash)
    expect(r.allows('axidps')).toBe(false)
  })

  it('allows a listed id, and stops after sign-out', async () => {
    const r = createRemoteAllowlist(fakeConfig({ 'allowlist.axidps': [H(1)] }), fakeHash)
    await r.setGithubId(1)
    expect(r.allows('axidps')).toBe(true)
    await r.setGithubId(null)
    expect(r.allows('axidps')).toBe(false)
  })

  it('does not allow an id that is not listed', async () => {
    const r = createRemoteAllowlist(fakeConfig({ 'allowlist.axidps': [H(2)] }), fakeHash)
    await r.setGithubId(1)
    expect(r.allows('axidps')).toBe(false)
  })

  it('tells subscribers after sign-in', async () => {
    const r = createRemoteAllowlist(fakeConfig({}), fakeHash)
    let calls = 0
    r.onChange(() => calls++)
    await r.setGithubId(1)
    expect(calls).toBe(1)
  })

  it('follows config changes and tells subscribers', async () => {
    const c = fakeConfig({ 'allowlist.axidps': [H(1)] })
    const r = createRemoteAllowlist(c, fakeHash)
    await r.setGithubId(1)
    let calls = 0
    r.onChange(() => calls++)
    c.flags['allowlist.axidps'] = []
    c.fire()
    expect(r.allows('axidps')).toBe(false)
    expect(calls).toBe(1)
  })

  it('a slow hash from an earlier sign-in does not overwrite a later sign-out', async () => {
    let release!: () => void
    const slow = (id: number) => new Promise<string>(res => { release = () => res(H(id)) })
    const r = createRemoteAllowlist(fakeConfig({ 'allowlist.axidps': [H(1)] }), slow)
    const first = r.setGithubId(1)
    await r.setGithubId(null)
    release()
    await first
    expect(r.allows('axidps')).toBe(false)
  })
})
