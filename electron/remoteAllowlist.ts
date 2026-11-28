// Testers for gated apps, managed from AxiAdmin without an AxiOM release.
// The axi-config flag `allowlist.<appId>` holds hashIdentity('github_user', id)
// hashes, never logins: the manifest is public.
import { hashIdentity, type AxiConfig } from '@axiapps/axi-config'
import type { AppId } from './shared/types'

const HASH = /^[0-9a-f]{64}$/

export function parseHashList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && HASH.test(x))
}

export interface RemoteAllowlist {
  setGithubId(id: number | null): Promise<void>
  allows(appId: AppId): boolean
  onChange(fn: () => void): () => void
}

export function createRemoteAllowlist(
  config: Pick<AxiConfig, 'flag' | 'onChange'>,
  hash: (id: number) => Promise<string> = id => hashIdentity('github_user', String(id)),
): RemoteAllowlist {
  let mine: string | null = null
  let generation = 0
  const listeners = new Set<() => void>()
  const notify = () => { for (const l of listeners) l() }
  config.onChange(notify)

  return {
    async setGithubId(id) {
      const gen = ++generation
      let next: string | null = null
      if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) {
        try { next = await hash(id) } catch { next = null }
      }
      if (gen !== generation) return // a later sign-in/out superseded this one
      mine = next
      notify()
    },
    allows(appId) {
      return mine != null && parseHashList(config.flag<unknown>('allowlist.' + appId, [])).includes(mine)
    },
    onChange(fn) {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}
