import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('fetchLatestRelease', () => {
  it('returns version and matching linux AppImage URL', async () => {
    const mockAssets = [
      { name: 'AxiBridge-2.6.0-linux.AppImage', browser_download_url: 'https://example.com/AxiBridge-2.6.0-linux.AppImage' },
      { name: 'AxiBridge-2.6.0-Setup.exe', browser_download_url: 'https://example.com/AxiBridge-2.6.0-Setup.exe' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v2.6.0', assets: mockAssets }],
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /AxiBridge.*\.AppImage$/i)
    expect(result).toEqual({
      version: '2.6.0',
      downloadUrl: 'https://example.com/AxiBridge-2.6.0-linux.AppImage',
    })
  })

  it('returns null when no matching asset found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v2.6.0', assets: [] }],
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /AxiBridge.*\.AppImage$/i)
    expect(result).toBeNull()
  })

  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /AxiBridge.*\.AppImage$/i)
    expect(result).toBeNull()
  })

  it('strips leading v from tag_name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{
        tag_name: 'v1.0.0',
        assets: [{ name: 'App.AppImage', browser_download_url: 'https://example.com/App.AppImage' }],
      }],
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /App\.AppImage$/i)
    expect(result?.version).toBe('1.0.0')
  })
})

describe('fetchLatestRelease release selection', () => {
  const dll = (name: string) => ({ name, browser_download_url: `https://example.com/${name}` })

  // Regression: /releases/latest honors make_latest and orders by created_at, so
  // it kept naming Unofficial Extras 2.4.1 after 2.5 was published from an older
  // tag. Selection must follow published_at, not the list/endpoint order.
  it('picks the newest published release even when listed after an older one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'v2.4.1', published_at: '2026-07-15T23:27:56Z', created_at: '2026-07-15T22:42:52Z', assets: [dll('arcdps_unofficial_extras.dll')] },
        { tag_name: 'v2.5.1', published_at: '2026-08-12T17:09:52Z', created_at: '2026-07-19T22:33:38Z', assets: [dll('arcdps_unofficial_extras.dll')] },
      ],
    }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('Krappa322/arcdps_unofficial_extras_releases', /^arcdps_unofficial_extras\.dll$/i)
    expect(result?.version).toBe('2.5.1')
    expect(result?.publishedAt).toBe('2026-08-12T17:09:52Z')
  })

  it('queries the releases list, not /releases/latest', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v1.0.0', assets: [dll('App.AppImage')] }],
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchLatestRelease } = await import('../github')
    await fetchLatestRelease('darkharasho/axivale', /App\.AppImage$/i)
    expect(fetchMock.mock.calls[0][0]).toContain('/releases?')
  })

  it('skips drafts and prereleases', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'v3.0.0', draft: true, published_at: '2026-08-20T00:00:00Z', assets: [dll('App.AppImage')] },
        { tag_name: 'v2.9.rc1', prerelease: true, published_at: '2026-08-19T00:00:00Z', assets: [dll('App.AppImage')] },
        { tag_name: 'v2.8.0', published_at: '2026-08-18T00:00:00Z', assets: [dll('App.AppImage')] },
      ],
    }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axivale', /App\.AppImage$/i)
    expect(result?.version).toBe('2.8.0')
  })

  // A release that ships no asset for us used to sink the whole repo to null,
  // hiding an update that the previous release could still serve.
  it('falls back to an older release when the newest ships no matching asset', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'v2.0.0', published_at: '2026-08-18T00:00:00Z', assets: [dll('source.zip')] },
        { tag_name: 'v1.9.0', published_at: '2026-08-01T00:00:00Z', assets: [dll('App.AppImage')] },
      ],
    }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axivale', /App\.AppImage$/i)
    expect(result?.version).toBe('1.9.0')
  })

  it('returns null when the repo has no releases', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    const { fetchLatestRelease } = await import('../github')
    expect(await fetchLatestRelease('darkharasho/axivale', /App\.AppImage$/i)).toBeNull()
  })
})

describe('checkLatestRelease auth', () => {
  const okList = () => ({
    ok: true, status: 200,
    json: async () => [{ tag_name: 'v1.0.0', assets: [
      { name: 'AxiVale-1.0.0.AppImage', browser_download_url: 'https://example.com/a.AppImage' },
    ] }],
  })

  it('sends no Authorization header when signed out', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okList())
    vi.stubGlobal('fetch', fetchMock)
    const { checkLatestRelease } = await import('../github')
    await checkLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i)
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>).Authorization).toBeUndefined()
  })

  // Signed in, the lookup gets GitHub's 5,000/hour limit instead of the
  // network's shared 60/hour. The bearer goes only to the release list.
  it('sends the signed-in token, without following redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okList())
    vi.stubGlobal('fetch', fetchMock)
    const { checkLatestRelease } = await import('../github')
    const r = await checkLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i, { token: 'gho_tok' })
    expect(r.kind).toBe('ok')
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers.Authorization).toBe('Bearer gho_tok')
    expect(init.redirect).toBe('manual')
  })

  it.each([
    ['a rejected token', { ok: false, status: 401 }],
    ['a redirect', { ok: false, status: 301 }],
    ['an opaque redirect', { ok: false, status: 0, type: 'opaqueredirect' }],
  ])('asks again anonymously after %s', async (_label, first) => {
    const fetchMock = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(okList())
    vi.stubGlobal('fetch', fetchMock)
    const { checkLatestRelease } = await import('../github')
    const r = await checkLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i, { token: 'gho_tok' })
    expect(r.kind).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect((fetchMock.mock.calls[1][1].headers as Record<string, string>).Authorization).toBeUndefined()
  })
})

describe('checkLatestRelease rate limit', () => {
  const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null })

  it('reports a 403 with no requests left as rate-limited, with the reset time', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 403, headers: headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1791854082' }),
    }))
    const { checkLatestRelease } = await import('../github')
    expect(await checkLatestRelease('darkharasho/axivale', /App\.AppImage$/i))
      .toEqual({ kind: 'rate-limited', resetAt: 1791854082000 })
  })

  it('reports a 429 as rate-limited', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, headers: headers({}) }))
    const { checkLatestRelease } = await import('../github')
    expect(await checkLatestRelease('darkharasho/axivale', /App\.AppImage$/i))
      .toEqual({ kind: 'rate-limited', resetAt: null })
  })

  it('treats any other 403 as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, headers: headers({ 'x-ratelimit-remaining': '12' }) }))
    const { checkLatestRelease } = await import('../github')
    expect(await checkLatestRelease('darkharasho/axivale', /App\.AppImage$/i)).toEqual({ kind: 'unavailable' })
  })

  it('distinguishes no usable release from an unreachable GitHub', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }))
    const { checkLatestRelease } = await import('../github')
    expect(await checkLatestRelease('darkharasho/axivale', /App\.AppImage$/i)).toEqual({ kind: 'none' })
  })

  it('says when to retry, and to sign in only when signed out', async () => {
    const { rateLimitMessage } = await import('../github')
    expect(rateLimitMessage(null, true)).toBe('GitHub limit reached')
    expect(rateLimitMessage(null, false)).toBe('GitHub limit reached · sign in to raise it')
    expect(rateLimitMessage(Date.UTC(2026, 9, 13, 1, 14), true)).toMatch(/^GitHub limit reached until \S/)
  })
})

describe('fetchLatestRelease prerelease opt-in', () => {
  const dll = (name: string) => ({ name, browser_download_url: `https://example.com/${name}` })
  const extras = [
    { tag_name: 'v2.7.rc1', prerelease: true, published_at: '2026-09-29T23:58:23Z', assets: [dll('arcdps_unofficial_extras.dll')] },
    { tag_name: 'v2.6.1', published_at: '2026-09-15T20:36:12Z', assets: [dll('arcdps_unofficial_extras.dll')] },
  ]

  // Krappa ships Unofficial Extras as an rc after a game patch, so the version
  // users actually run is often a prerelease. Without the opt-in AxiOM reads
  // their hand-installed 2.7.rc1 as an unrecognized "local build".
  it('picks a newer prerelease when prereleases are allowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => extras }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease(
      'Krappa322/arcdps_unofficial_extras_releases',
      /^arcdps_unofficial_extras\.dll$/i,
      { includePrerelease: true },
    )
    expect(result?.version).toBe('2.7.rc1')
  })

  it('excludes prereleases by default', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => extras }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease(
      'Krappa322/arcdps_unofficial_extras_releases',
      /^arcdps_unofficial_extras\.dll$/i,
    )
    expect(result?.version).toBe('2.6.1')
  })

  // Opting in must not pin anyone to an rc forever: once the stable lands it is
  // the newer publish and wins on published_at like any other release.
  it('prefers a stable released after the prerelease', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'v2.7.rc1', prerelease: true, published_at: '2026-09-29T23:58:23Z', assets: [dll('App.AppImage')] },
        { tag_name: 'v2.7.0', published_at: '2026-10-06T00:00:00Z', assets: [dll('App.AppImage')] },
      ],
    }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axivale', /App\.AppImage$/i, { includePrerelease: true })
    expect(result?.version).toBe('2.7.0')
  })

  it('still skips drafts when prereleases are allowed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { tag_name: 'v3.0.0', draft: true, published_at: '2026-10-01T00:00:00Z', assets: [dll('App.AppImage')] },
        { tag_name: 'v2.9.rc1', prerelease: true, published_at: '2026-09-19T00:00:00Z', assets: [dll('App.AppImage')] },
      ],
    }))
    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axivale', /App\.AppImage$/i, { includePrerelease: true })
    expect(result?.version).toBe('2.9.rc1')
  })
})
