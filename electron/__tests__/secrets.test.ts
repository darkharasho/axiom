import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { IdentityStore, type Cipher } from '../secrets'

// Fake cipher: reversible without real OS keychain. Encrypt = utf8 bytes; decrypt = utf8 string.
const fakeCipher: Cipher = {
  encrypt: (plain) => Buffer.from(plain, 'utf8'),
  decrypt: (buf) => buf.toString('utf8'),
}

let path = ''
beforeEach(() => { path = join(tmpdir(), `axiom-identity-${process.pid}-${Math.floor(performance.now())}.json`) })
afterEach(() => { if (existsSync(path)) rmSync(path) })

describe('IdentityStore', () => {
  it('round-trips a saved identity', () => {
    const store = new IdentityStore(path, fakeCipher)
    store.save({ token: 'gho_secret', login: 'darkharasho' })
    expect(store.load()).toEqual({ token: 'gho_secret', login: 'darkharasho' })
  })

  it('returns null when no file exists', () => {
    expect(new IdentityStore(path, fakeCipher).load()).toBeNull()
  })

  it('returns null after clear', () => {
    const store = new IdentityStore(path, fakeCipher)
    store.save({ token: 'gho_secret', login: 'darkharasho' })
    store.clear()
    expect(store.load()).toBeNull()
  })

  it('does not write the raw token to disk', () => {
    const store = new IdentityStore(path, fakeCipher)
    store.save({ token: 'gho_secret', login: 'darkharasho' })
    const raw = require('fs').readFileSync(path, 'utf8') as string
    expect(raw).not.toContain('gho_secret')
  })
})
