import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// A fake https.get: records each request and answers from a queue, so no test
// touches the network.
const h = vi.hoisted(() => ({
  calls: [] as { url: string; headers: Record<string, string> }[],
  replies: [] as { statusCode: number; headers?: Record<string, string>; body?: string; breakAfterBody?: boolean }[],
}))

vi.mock('https', () => {
  const get = (url: string, opts: { headers?: Record<string, string> }, cb: (res: unknown) => void) => {
    h.calls.push({ url, headers: { ...(opts?.headers ?? {}) } })
    const reply = h.replies.shift() ?? { statusCode: 500 }
    const res = Object.assign(new PassThrough(), { statusCode: reply.statusCode, headers: reply.headers ?? {} })
    const req = new EventEmitter()
    setImmediate(() => {
      cb(res)
      if (reply.breakAfterBody) {
        res.write(reply.body ?? '')
        setTimeout(() => res.destroy(new Error('connection reset')), 300)
      } else {
        res.end(reply.body ?? '')
      }
    })
    return req
  }
  return { default: { get }, get }
})

import { downloadFile, HttpStatusError, assetFilename } from '../installer'

const ASSET_API = 'https://api.github.com/repos/darkharasho/axiadmin/releases/assets/12'
const STORAGE = 'https://objects.githubusercontent.com/github-production-release-asset/12?X-Amz-Signature=abc'
const PRIVATE_HEADERS = { Authorization: 'Bearer gho_repo', Accept: 'application/octet-stream', 'User-Agent': 'AxiOM' }

let dest = ''
beforeEach(() => {
  h.calls.length = 0
  h.replies.length = 0
  dest = join(tmpdir(), `axiom-dl-${process.pid}-${Math.floor(performance.now())}.bin`)
})
afterEach(() => { if (existsSync(dest)) rmSync(dest) })

describe('downloadFile', () => {
  it('sends the headers to the asset API and drops them on the redirect to storage', async () => {
    h.replies.push({ statusCode: 302, headers: { location: STORAGE } }, { statusCode: 200, body: 'BIN' })
    await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)
    expect(h.calls[0]).toEqual({ url: ASSET_API, headers: PRIVATE_HEADERS })
    expect(h.calls[1]).toEqual({ url: STORAGE, headers: {} })
    expect(readFileSync(dest, 'utf8')).toBe('BIN')
  })

  it.each([301, 303, 307, 308])('follows a %i redirect without the headers', async (code) => {
    h.replies.push({ statusCode: code, headers: { location: STORAGE } }, { statusCode: 200, body: 'BIN' })
    await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)
    expect(h.calls[1]).toEqual({ url: STORAGE, headers: {} })
  })

  it('resolves a relative Location against the current url, still without headers', async () => {
    h.replies.push({ statusCode: 302, headers: { location: '/storage/12' } }, { statusCode: 200, body: 'BIN' })
    await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)
    expect(h.calls[1]).toEqual({ url: 'https://api.github.com/storage/12', headers: {} })
  })

  it('never forwards the headers on any later hop of a redirect chain', async () => {
    h.replies.push(
      { statusCode: 302, headers: { location: STORAGE } },
      { statusCode: 307, headers: { location: 'https://other.example/blob' } },
      { statusCode: 200, body: 'BIN' },
    )
    await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)
    expect(h.calls.map(c => c.headers)).toEqual([PRIVATE_HEADERS, {}, {}])
  })

  it('rejects past the redirect cap instead of looping', async () => {
    for (let i = 0; i < 20; i++) h.replies.push({ statusCode: 302, headers: { location: STORAGE } })
    await expect(downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)).rejects.toThrow(/redirect/i)
    expect(h.calls.length).toBeLessThanOrEqual(6)
    expect(existsSync(dest)).toBe(false)
  })

  it('sends no headers on a public download', async () => {
    h.replies.push({ statusCode: 200, body: 'PUB' })
    await downloadFile('https://github.com/darkharasho/axibridge/releases/download/v1.0.0/AxiBridge-1.0.0.AppImage', dest, () => {})
    expect(h.calls[0].headers).toEqual({})
  })

  it.each([401, 404])('rejects %i with an HttpStatusError carrying the status', async (status) => {
    h.replies.push({ statusCode: status })
    const err = await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS).catch(e => e)
    expect(err).toBeInstanceOf(HttpStatusError)
    expect((err as HttpStatusError).status).toBe(status)
    expect(String(err)).not.toContain('gho_repo')
  })

  it('records hop 0 for a status error on the first request', async () => {
    h.replies.push({ statusCode: 404 })
    const err = await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS).catch(e => e)
    expect((err as HttpStatusError).hop).toBe(0)
  })

  it('records hop 1 for a 404 after a redirect', async () => {
    h.replies.push({ statusCode: 302, headers: { location: STORAGE } }, { statusCode: 404 })
    const err = await downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS).catch(e => e)
    expect(err).toBeInstanceOf(HttpStatusError)
    expect((err as HttpStatusError).status).toBe(404)
    expect((err as HttpStatusError).hop).toBe(1)
  })

  // The file is only opened after the status check, so an error status never
  // creates it, and a leftover from an earlier attempt can't pass for success.
  it('creates no file on a 401', async () => {
    h.replies.push({ statusCode: 401 })
    await expect(downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)).rejects.toBeInstanceOf(HttpStatusError)
    expect(existsSync(dest)).toBe(false)
  })

  it('rejects a 401 even when a stale file from a previous attempt sits at dest', async () => {
    writeFileSync(dest, 'STALE')
    h.replies.push({ statusCode: 401 })
    await expect(downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS)).rejects.toBeInstanceOf(HttpStatusError)
    expect(readFileSync(dest, 'utf8')).toBe('STALE') // untouched, and the call did not resolve
  })

  it('removes the partial file when the body fails mid-stream', async () => {
    h.replies.push({ statusCode: 200, body: 'PARTIAL', breakAfterBody: true })
    const p = downloadFile(ASSET_API, dest, () => {}, PRIVATE_HEADERS).catch(e => e)
    await vi.waitFor(() => expect(existsSync(dest)).toBe(true)) // real precondition: the file exists mid-stream
    const err = await p
    expect(String(err)).toContain('connection reset')
    await vi.waitFor(() => expect(existsSync(dest)).toBe(false))
  })
})

describe('assetFilename', () => {
  it('uses the url basename for a public download', () => {
    expect(assetFilename('https://github.com/darkharasho/axibridge/releases/download/v1.0.0/AxiBridge-1.0.0.AppImage')).toBe('AxiBridge-1.0.0.AppImage')
  })
  it('uses the asset name for an API url, which has none', () => {
    expect(assetFilename(ASSET_API, 'AxiAdmin-0.2.0.AppImage')).toBe('AxiAdmin-0.2.0.AppImage')
  })
  it.each(['', '.', '..', '../..'])('falls back to the url basename for the unusable name %j', (name) => {
    expect(assetFilename('https://github.com/darkharasho/axibridge/releases/download/v1.0.0/AxiBridge-1.0.0.AppImage', name))
      .toBe('AxiBridge-1.0.0.AppImage')
  })
  it('strips any directory part from the asset name', () => {
    expect(assetFilename(ASSET_API, '../../AxiAdmin-0.2.0.AppImage')).toBe('AxiAdmin-0.2.0.AppImage')
  })
})
