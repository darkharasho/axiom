import { describe, it, expect } from 'vitest'
import { bearerFor, assetDownloadHeaders } from '../tokenScope'

const TOKEN = 'gho_test'

describe('bearerFor', () => {
  it('attaches the bearer to the private repo release lookup', () => {
    expect(bearerFor('https://api.github.com/repos/darkharasho/axiadmin/releases/latest', TOKEN)).toBe('Bearer gho_test')
  })

  it('attaches the bearer to a private asset API url', () => {
    expect(bearerFor('https://api.github.com/repos/darkharasho/axiadmin/releases/assets/123', TOKEN)).toBe('Bearer gho_test')
  })

  it('matches host and repo case-insensitively', () => {
    expect(bearerFor('https://API.GitHub.com/repos/DarkHarasho/AxiAdmin/releases/latest', TOKEN)).toBe('Bearer gho_test')
  })

  it.each([
    ['a public app release list', 'https://api.github.com/repos/darkharasho/axibridge/releases?per_page=30'],
    ['a public app download', 'https://github.com/darkharasho/axibridge/releases/download/v1.0.0/AxiBridge-1.0.0.AppImage'],
    ['a third-party arcdps plugin repo', 'https://api.github.com/repos/Krappa322/arcdps_unofficial_extras_releases/releases?per_page=30'],
    ['the asset redirect host', 'https://objects.githubusercontent.com/github-production-release-asset/123?X-Amz-Signature=abc'],
    ['a look-alike repo prefix', 'https://api.github.com/repos/darkharasho/axiadmin-evil/releases/latest'],
    ['the repo root without a trailing path', 'https://api.github.com/repos/darkharasho/axiadmin'],
    ['a dot-dot escape', 'https://api.github.com/repos/darkharasho/axiadmin/../axibridge/releases'],
    ['an encoded dot-dot escape', 'https://api.github.com/repos/darkharasho/axiadmin/%2e%2e/axibridge/releases'],
    ['an encoded slash', 'https://api.github.com/repos/darkharasho%2Faxiadmin/releases/latest'],
    ['a look-alike host', 'https://api.github.com.evil.example/repos/darkharasho/axiadmin/releases/latest'],
    ['a userinfo host trick', 'https://api.github.com@evil.example/repos/darkharasho/axiadmin/releases/latest'],
    ['a non-default port', 'https://api.github.com:8443/repos/darkharasho/axiadmin/releases/latest'],
    ['plain http', 'http://api.github.com/repos/darkharasho/axiadmin/releases/latest'],
    ['the github.com web host', 'https://github.com/repos/darkharasho/axiadmin/releases/latest'],
    ['a relative url', 'repos/darkharasho/axiadmin/releases/latest'],
  ])('never attaches to %s', (_label, url) => {
    expect(bearerFor(url, TOKEN)).toBeUndefined()
  })

  it('returns undefined without a token', () => {
    const url = 'https://api.github.com/repos/darkharasho/axiadmin/releases/latest'
    expect(bearerFor(url, null)).toBeUndefined()
    expect(bearerFor(url, undefined)).toBeUndefined()
    expect(bearerFor(url, '')).toBeUndefined()
  })

  it('ignores an entry that is allowlisted but not private', () => {
    const metas = [{ repo: 'darkharasho/gated', allowlist: ['darkharasho'] }]
    expect(bearerFor('https://api.github.com/repos/darkharasho/gated/releases/latest', TOKEN, metas)).toBeUndefined()
  })
})

describe('assetDownloadHeaders', () => {
  it('asks for the binary with the bearer on a private asset API url', () => {
    expect(assetDownloadHeaders('https://api.github.com/repos/darkharasho/axiadmin/releases/assets/123', TOKEN)).toEqual({
      Authorization: 'Bearer gho_test',
      Accept: 'application/octet-stream',
      'User-Agent': 'AxiOM',
    })
  })

  it('returns undefined for a public download, which stays anonymous', () => {
    expect(assetDownloadHeaders('https://github.com/darkharasho/axibridge/releases/download/v1.0.0/AxiBridge-1.0.0.AppImage', TOKEN)).toBeUndefined()
  })
})
