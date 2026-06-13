import { describe, it, expect, vi } from 'vitest'
import { beginDeviceAuth, pollForToken, fetchGithubLogin } from '../githubAuth'

const noDelay = () => Promise.resolve()

describe('beginDeviceAuth', () => {
  it('returns the device + user codes', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: 'DEV', user_code: 'WXYZ-1234',
        verification_uri: 'https://github.com/login/device',
        interval: 5, expires_in: 900,
      }),
    })
    const res = await beginDeviceAuth('client', fetchFn as unknown as typeof fetch)
    expect(res).toEqual({
      deviceCode: 'DEV', userCode: 'WXYZ-1234',
      verificationUri: 'https://github.com/login/device',
      interval: 5, expiresIn: 900,
    })
  })

  it('throws when GitHub omits the device code', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error_description: 'nope' }) })
    await expect(beginDeviceAuth('client', fetchFn as unknown as typeof fetch)).rejects.toThrow('nope')
  })
})

describe('pollForToken', () => {
  it('returns the token once authorization completes', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'authorization_pending' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_abc' }) })
    const token = await pollForToken('client', 'DEV', {
      intervalSeconds: 1, expiresInSeconds: 60,
      fetchFn: fetchFn as unknown as typeof fetch, delayFn: noDelay,
    })
    expect(token).toBe('gho_abc')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('backs off on slow_down then succeeds', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'slow_down' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_ok' }) })
    const token = await pollForToken('client', 'DEV', {
      intervalSeconds: 1, expiresInSeconds: 60,
      fetchFn: fetchFn as unknown as typeof fetch, delayFn: noDelay,
    })
    expect(token).toBe('gho_ok')
  })

  it('throws when the device code expires', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'expired_token' }) })
    await expect(pollForToken('client', 'DEV', {
      intervalSeconds: 1, expiresInSeconds: 60,
      fetchFn: fetchFn as unknown as typeof fetch, delayFn: noDelay,
    })).rejects.toThrow('expired')
  })
})

describe('fetchGithubLogin', () => {
  it('returns the login on success', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ login: 'darkharasho' }) })
    expect(await fetchGithubLogin('tok', fetchFn as unknown as typeof fetch)).toBe('darkharasho')
  })

  it('falls back to "github" on error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'))
    expect(await fetchGithubLogin('tok', fetchFn as unknown as typeof fetch)).toBe('github')
  })
})
