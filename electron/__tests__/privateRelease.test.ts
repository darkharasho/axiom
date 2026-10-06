import { describe, it, expect, vi } from 'vitest'
import {
  fetchPrivateRelease, resolvePrivateRelease, AuthFailureLatch,
  signInAgainMessage, unlockMessage, type PrivateCheckInput,
} from '../privateRelease'

const API = 'https://api.github.com/repos/darkharasho/axiadmin'
const ASSETS = [
  { name: 'AxiAdmin-Setup-0.2.0.exe', url: `${API}/releases/assets/11`, browser_download_url: 'https://github.com/darkharasho/axiadmin/releases/download/v0.2.0/AxiAdmin-Setup-0.2.0.exe', size: 100 },
  { name: 'AxiAdmin-0.2.0.AppImage', url: `${API}/releases/assets/12`, browser_download_url: 'https://github.com/darkharasho/axiadmin/releases/download/v0.2.0/AxiAdmin-0.2.0.AppImage', size: 200, digest: 'sha256:abc' },
]
const okFetch = () => vi.fn().mockResolvedValue({
  ok: true, status: 200,
  json: async () => ({ tag_name: 'v0.2.0', published_at: '2026-10-06T00:00:00Z', assets: ASSETS }),
})
const statusFetch = (status: number) => vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) })
const LINUX = /AxiAdmin.*\.AppImage$/i

describe('fetchPrivateRelease', () => {
  it('asks /releases/latest with the bearer', async () => {
    const fetchFn = okFetch()
    await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', fetchFn as unknown as typeof fetch)
    expect(fetchFn.mock.calls[0][0]).toBe(`${API}/releases/latest`)
    expect((fetchFn.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer gho_repo')
  })

  it('returns the asset API url, not the browser url, as the download', async () => {
    const r = await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', okFetch() as unknown as typeof fetch)
    expect(r).toEqual({ kind: 'ok', release: {
      version: '0.2.0',
      downloadUrl: `${API}/releases/assets/12`,
      assetName: 'AxiAdmin-0.2.0.AppImage',
      assetSize: 200,
      assetDigest: 'sha256:abc',
      publishedAt: '2026-10-06T00:00:00Z',
    } })
  })

  it.each([401, 404])('reports %i as an auth failure', async (status) => {
    const r = await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', statusFetch(status) as unknown as typeof fetch)
    expect(r).toEqual({ kind: 'auth' })
  })

  it('reports a server error, a network error or no matching asset as unavailable', async () => {
    expect(await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', statusFetch(500) as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    const offline = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', offline as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    expect(await fetchPrivateRelease('darkharasho/axiadmin', /NoSuch\.zip$/, 'gho_repo', okFetch() as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
  })

  it.each([301, 302])('maps a %i redirect to unavailable and never follows it', async (status) => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status, type: 'basic', json: async () => ({}) })
    expect(await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', fetchFn as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    expect(fetchFn.mock.calls[0][1].redirect).toBe('manual')
  })

  it('maps an opaque redirect to unavailable', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 0, type: 'opaqueredirect', json: async () => ({}) })
    expect(await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', fetchFn as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
  })

  it('sends nothing for a repo that is not a private entry', async () => {
    const fetchFn = okFetch()
    expect(await fetchPrivateRelease('darkharasho/axibridge', LINUX, 'gho_repo', fetchFn as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('resolvePrivateRelease', () => {
  const input = (over: Partial<PrivateCheckInput> = {}): PrivateCheckInput => ({
    appId: 'axiadmin', name: 'AxiAdmin', repo: 'darkharasho/axiadmin', assetPattern: LINUX,
    token: 'gho_repo', scopes: ['read:user', 'repo'], latch: new AuthFailureLatch(), ...over,
  })

  it('returns the release with no notice on success', async () => {
    const r = await resolvePrivateRelease(input({ fetchFn: okFetch() as unknown as typeof fetch }))
    expect(r.release?.version).toBe('0.2.0')
    expect(r.notice).toBeUndefined()
  })

  it.each([401, 404])('shows the re-sign-in message on %i', async (status) => {
    const r = await resolvePrivateRelease(input({ fetchFn: statusFetch(status) as unknown as typeof fetch }))
    expect(r).toEqual({ release: null, notice: 'Sign in again to update AxiAdmin' })
    expect(signInAgainMessage('AxiAdmin')).toBe('Sign in again to update AxiAdmin')
  })

  it('does not retry with the same token after an auth failure', async () => {
    const latch = new AuthFailureLatch()
    const fetchFn = statusFetch(401)
    await resolvePrivateRelease(input({ latch, fetchFn: fetchFn as unknown as typeof fetch }))
    const again = await resolvePrivateRelease(input({ latch, fetchFn: fetchFn as unknown as typeof fetch }))
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(again.notice).toBe('Sign in again to update AxiAdmin')
  })

  it('retries once the token changes', async () => {
    const latch = new AuthFailureLatch()
    await resolvePrivateRelease(input({ latch, fetchFn: statusFetch(401) as unknown as typeof fetch }))
    const fetchFn = okFetch()
    const r = await resolvePrivateRelease(input({ latch, token: 'gho_new', fetchFn: fetchFn as unknown as typeof fetch }))
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(r.release?.version).toBe('0.2.0')
  })

  it('makes no request without the repo scope, and points at the unlock', async () => {
    const fetchFn = okFetch()
    const r = await resolvePrivateRelease(input({ scopes: ['read:user'], fetchFn: fetchFn as unknown as typeof fetch }))
    expect(fetchFn).not.toHaveBeenCalled()
    expect(r).toEqual({ release: null, notice: unlockMessage('AxiAdmin') })
    expect(unlockMessage('AxiAdmin')).toBe('Unlock private apps in Settings to update AxiAdmin')
  })
})

describe('AuthFailureLatch.clear', () => {
  it('forgets a tripped token so the same token is tried again', () => {
    const latch = new AuthFailureLatch()
    latch.trip('axiadmin', 'gho_repo')
    expect(latch.isTripped('axiadmin', 'gho_repo')).toBe(true)
    latch.clear()
    expect(latch.isTripped('axiadmin', 'gho_repo')).toBe(false)
  })
})
