import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as crypto from 'crypto'
import { appImageMatchesAsset } from '../identifyAppImage'

let tmpFile: string
const CONTENT = Buffer.from('pretend this is an AppImage payload')
const SHA = crypto.createHash('sha256').update(CONTENT).digest('hex')

beforeEach(() => {
  tmpFile = path.join(os.tmpdir(), `axiom-test-${process.pid}-${CONTENT.length}.AppImage`)
  fs.writeFileSync(tmpFile, CONTENT)
})
afterEach(() => {
  try { fs.unlinkSync(tmpFile) } catch { /* ignore */ }
})

describe('appImageMatchesAsset', () => {
  it('matches when size and sha256 digest agree', () => {
    expect(appImageMatchesAsset(tmpFile, CONTENT.length, `sha256:${SHA}`)).toBe(true)
  })

  it('rejects on size mismatch without hashing', () => {
    expect(appImageMatchesAsset(tmpFile, CONTENT.length + 1, `sha256:${SHA}`)).toBe(false)
  })

  it('rejects when size matches but digest differs', () => {
    expect(appImageMatchesAsset(tmpFile, CONTENT.length, 'sha256:' + '0'.repeat(64))).toBe(false)
  })

  it('falls back to a size-only match when no digest is provided', () => {
    expect(appImageMatchesAsset(tmpFile, CONTENT.length, undefined)).toBe(true)
  })

  it('rejects when the file does not exist', () => {
    expect(appImageMatchesAsset(tmpFile + '.nope', CONTENT.length, `sha256:${SHA}`)).toBe(false)
  })

  it('rejects when the release exposes no size', () => {
    expect(appImageMatchesAsset(tmpFile, undefined, `sha256:${SHA}`)).toBe(false)
  })
})
