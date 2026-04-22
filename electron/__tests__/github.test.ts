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
      json: async () => ({ tag_name: 'v2.6.0', assets: mockAssets }),
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
      json: async () => ({ tag_name: 'v2.6.0', assets: [] }),
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
      json: async () => ({
        tag_name: 'v1.0.0',
        assets: [{ name: 'App.AppImage', browser_download_url: 'https://example.com/App.AppImage' }],
      }),
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /App\.AppImage$/i)
    expect(result?.version).toBe('1.0.0')
  })
})
