import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, rmSync, writeFileSync } from 'fs'
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
  it('round-trips the numeric id', () => {
    const store = new IdentityStore(path, fakeCipher)
    store.save({ token: 'gho_secret', login: 'darkharasho', id: 4242 })
    expect(store.load()).toEqual({ token: 'gho_secret', login: 'darkharasho', id: 4242 })
  })

  it('loads an old file without id, leaving id undefined', () => {
    writeFileSync(path, JSON.stringify({ token: Buffer.from('gho_secret').toString('base64'), login: 'darkharasho' }))
    const loaded = new IdentityStore(path, fakeCipher).load()
    expect(loaded?.login).toBe('darkharasho')
    expect(loaded?.id).toBeUndefined()
  })

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

  it('round-trips granted scopes', () => {
    const store = new IdentityStore(path, fakeCipher)
    store.save({ token: 'gho_secret', login: 'darkharasho', id: 4242, scopes: ['read:user', 'repo'] })
    expect(store.load()).toEqual({ token: 'gho_secret', login: 'darkharasho', id: 4242, scopes: ['read:user', 'repo'] })
  })

  it('loads an old file without scopes, leaving scopes undefined', () => {
    writeFileSync(path, JSON.stringify({ token: Buffer.from('gho_secret').toString('base64'), login: 'darkharasho', id: 4242 }))
    const loaded = new IdentityStore(path, fakeCipher).load()
    expect(loaded).toEqual({ token: 'gho_secret', login: 'darkharasho', id: 4242 })
    expect(loaded?.scopes).toBeUndefined()
  })

  it.each([
    ['a string', 'repo'],
    ['a mixed array', [1, 'repo']],
  ])('ignores scopes stored as %s', (_label, scopes) => {
    writeFileSync(path, JSON.stringify({ token: Buffer.from('gho_secret').toString('base64'), login: 'darkharasho', scopes }))
    expect(new IdentityStore(path, fakeCipher).load()?.scopes).toBeUndefined()
  })
})
