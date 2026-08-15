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

describe('fetchLatestRelease auth', () => {
  it('sends a bearer header when a token is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v1.0.0', assets: [
        { name: 'AxiVale-1.0.0.AppImage', browser_download_url: 'https://example.com/a.AppImage' },
      ] }],
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchLatestRelease } = await import('../github')
    await fetchLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i, 'gho_tok')
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer gho_tok')
  })

  it('omits the bearer header when no token is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v1.0.0', assets: [
        { name: 'AxiVale-1.0.0.AppImage', browser_download_url: 'https://example.com/a.AppImage' },
      ] }],
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchLatestRelease } = await import('../github')
    await fetchLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i)
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})
