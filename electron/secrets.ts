import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'fs'
import { dirname } from 'path'

export interface Cipher {
  encrypt(plain: string): Buffer
  decrypt(encrypted: Buffer): string
}

export interface Identity {
  token: string
  login: string
}

interface FileShape {
  token: string // base64 of encrypted bytes
  login: string
}

/** Stores a single encrypted GitHub identity. AxiOM only needs one identity,
 *  so this is intentionally simpler than axivale's multi-account keyring. */
export class IdentityStore {
  constructor(private readonly path: string, private readonly cipher: Cipher) {}

  load(): Identity | null {
    if (!existsSync(this.path)) return null
    try {
      const data = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<FileShape>
      if (!data.token || !data.login) return null
      return { token: this.cipher.decrypt(Buffer.from(data.token, 'base64')), login: data.login }
    } catch {
      return null
    }
  }

  save(identity: Identity): void {
    mkdirSync(dirname(this.path), { recursive: true })
    const data: FileShape = {
      token: this.cipher.encrypt(identity.token).toString('base64'),
      login: identity.login,
    }
    writeFileSync(this.path, JSON.stringify(data, null, 2), { mode: 0o600 })
    chmodSync(this.path, 0o600) // writeFileSync's mode only applies on creation
  }

  clear(): void {
    if (existsSync(this.path)) writeFileSync(this.path, JSON.stringify({}), { mode: 0o600 })
  }
}

/** Production cipher backed by Electron safeStorage. Imported lazily so tests
 *  (plain node) never load the electron module. */
export async function electronCipher(): Promise<Cipher> {
  const { safeStorage } = await import('electron')
  return {
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (buf) => safeStorage.decryptString(buf),
  }
}
