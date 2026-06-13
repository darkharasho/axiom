# Identity-Gated Private Tools (GitHub OAuth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track the private `axivale` app in AxiOM's main list, visible only when signed in to GitHub as an allowlisted account, with the OAuth token also raising the GitHub API rate limit for all release fetches.

**Architecture:** Add GitHub OAuth **device flow** (lifted from sibling app `axivale`). On sign-in, resolve the GitHub `login`; if it is in a code-defined allowlist, registry entries marked `private: true` become visible and tracked. The token is stored encrypted via Electron `safeStorage` (never in plaintext `config.json`) and attached as a bearer header to release fetches. Signed-out / non-allowlisted users get today's exact behavior.

**Tech Stack:** Electron + TypeScript + React, Vitest. Reuses existing helpers: `electron/github.ts` (`fetchLatestRelease`), `electron/ipc-handlers.ts` (`runCheckUpdates`), `electron/config.ts`. Device-flow code mirrors `/var/home/mstephens/Documents/GitHub/axivale/src/main/githubAuth.ts`.

**Spec:** `docs/superpowers/specs/2026-06-13-private-tools-github-oauth-design.md`

## File Structure

**Create:**
- `electron/githubAuth.ts` — device flow (begin / poll / fetch login). Pure, fetch+delay injectable.
- `electron/secrets.ts` — `safeStorage`-encrypted single-identity store (`IdentityStore`, `Cipher`, `electronCipher`).
- `electron/privateTools.ts` — `PRIVATE_TOOL_ALLOWLIST`, `isPrivateUnlocked`.
- `electron/__tests__/githubAuth.test.ts`
- `electron/__tests__/secrets.test.ts`
- `electron/__tests__/privateTools.test.ts`
- `electron/__tests__/apps.test.ts`
- `src/hooks/useGithubAuth.ts` — React hook mirroring `useArcdpsState`.

**Modify:**
- `electron/shared/types.ts` — add `axivale` to `AppId`; add `GithubAuthState`; extend `DEFAULT_CONFIG.apps`.
- `electron/apps.ts` — add `private?` to meta type, add `axivale` entry, add `isAppVisible`.
- `electron/github.ts` — `fetchLatestRelease(repo, pattern, token?)` sends bearer header.
- `electron/__tests__/github.test.ts` — add bearer-header tests.
- `electron/ipc-handlers.ts` — identity state, `github:*` handlers, gate `runCheckUpdates` / `hasAnyUpdates`, pass token to fetches.
- `electron/preload.ts` — expose `githubAuthBegin/Complete/getStatus/signOut`, `onGithubStatusUpdated`.
- `src/axiom.d.ts` — type the new bridge methods.
- `src/components/SettingsView.tsx` — "Sign in with GitHub" row.
- `src/components/AppList.tsx` — include `axivale` in render order only when unlocked.

---

### Task 1: GitHub device-flow module

**Files:**
- Create: `electron/githubAuth.ts`
- Create: `electron/__tests__/githubAuth.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// electron/__tests__/githubAuth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { beginDeviceAuth, pollForToken, fetchGithubLogin } from '../githubAuth'

const noDelay = () => Promise.resolve()

describe('beginDeviceAuth', () => {
  it('returns the device + user codes', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        device_code: 'DEV', user_code: 'WXYZ-1234',
        verification_uri: 'https://github.com/login/device',
        interval: 5, expires_in: 900,
      }),
    })
    const res = await beginDeviceAuth('client', fetchFn as unknown as typeof fetch)
    expect(res).toEqual({
      deviceCode: 'DEV', userCode: 'WXYZ-1234',
      verificationUri: 'https://github.com/login/device',
      interval: 5, expiresIn: 900,
    })
  })

  it('throws when GitHub omits the device code', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error_description: 'nope' }) })
    await expect(beginDeviceAuth('client', fetchFn as unknown as typeof fetch)).rejects.toThrow('nope')
  })
})

describe('pollForToken', () => {
  it('returns the token once authorization completes', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'authorization_pending' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_abc' }) })
    const token = await pollForToken('client', 'DEV', {
      intervalSeconds: 1, expiresInSeconds: 60,
      fetchFn: fetchFn as unknown as typeof fetch, delayFn: noDelay,
    })
    expect(token).toBe('gho_abc')
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('backs off on slow_down then succeeds', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'slow_down' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'gho_ok' }) })
    const token = await pollForToken('client', 'DEV', {
      intervalSeconds: 1, expiresInSeconds: 60,
      fetchFn: fetchFn as unknown as typeof fetch, delayFn: noDelay,
    })
    expect(token).toBe('gho_ok')
  })

  it('throws when the device code expires', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'expired_token' }) })
    await expect(pollForToken('client', 'DEV', {
      intervalSeconds: 1, expiresInSeconds: 60,
      fetchFn: fetchFn as unknown as typeof fetch, delayFn: noDelay,
    })).rejects.toThrow('expired')
  })
})

describe('fetchGithubLogin', () => {
  it('returns the login on success', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ login: 'darkharasho' }) })
    expect(await fetchGithubLogin('tok', fetchFn as unknown as typeof fetch)).toBe('darkharasho')
  })

  it('falls back to "github" on error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('boom'))
    expect(await fetchGithubLogin('tok', fetchFn as unknown as typeof fetch)).toBe('github')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/githubAuth.test.ts`
Expected: FAIL — `Cannot find module '../githubAuth'`.

- [ ] **Step 3: Write the implementation**

```ts
// electron/githubAuth.ts
// GitHub OAuth device flow — "Sign in with GitHub".
// Pure async functions: fetch + delay are injectable for unit testing with no
// real network and no real timers. The IPC layer opens the verification URI.
// Mirrors axivale/src/main/githubAuth.ts. Scope is read:user only — AxiOM only
// needs to resolve the login (the axivale repo is public, so no repo scope).

const GITHUB_HOST = 'https://github.com'
const GITHUB_API = 'https://api.github.com'
const UA = 'AxiOM'
const SCOPE = 'read:user'

export const GITHUB_DEVICE_CLIENT_ID = process.env.GITHUB_DEVICE_CLIENT_ID || 'Ov23liFh1ih9LAcnLACw'

export type FetchFn = typeof fetch
export type DelayFn = (ms: number) => Promise<void>

const realDelay: DelayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export interface DeviceAuthBegin {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
  expiresIn: number
}

export async function beginDeviceAuth(clientId: string, fetchFn: FetchFn = fetch): Promise<DeviceAuthBegin> {
  if (!clientId) throw new Error('Missing GitHub device client ID.')
  const body = new URLSearchParams({ client_id: clientId, scope: SCOPE })
  const res = await fetchFn(`${GITHUB_HOST}/login/device/code`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body,
  })
  if (!res.ok) throw new Error(`Failed to request device code (${res.status}).`)
  const data = (await res.json()) as {
    device_code?: string; user_code?: string; verification_uri?: string
    interval?: number; expires_in?: number; error_description?: string
  }
  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error(data.error_description || 'GitHub did not return a device code.')
  }
  return {
    deviceCode: data.device_code,
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    interval: data.interval ?? 5,
    expiresIn: data.expires_in ?? 900,
  }
}

export async function pollForToken(
  clientId: string,
  deviceCode: string,
  { intervalSeconds, expiresInSeconds, fetchFn = fetch, delayFn = realDelay }: {
    intervalSeconds: number; expiresInSeconds: number; fetchFn?: FetchFn; delayFn?: DelayFn
  },
): Promise<string> {
  if (!clientId) throw new Error('Missing GitHub device client ID.')
  if (!deviceCode) throw new Error('Missing GitHub device code.')
  const deadline = Date.now() + Math.max(0, expiresInSeconds) * 1000
  let intervalMs = Math.max(1, intervalSeconds) * 1000
  while (Date.now() < deadline) {
    await delayFn(intervalMs)
    const body = new URLSearchParams({
      client_id: clientId, device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    })
    const res = await fetchFn(`${GITHUB_HOST}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
      body,
    })
    if (!res.ok) throw new Error(`Failed to poll for token (${res.status}).`)
    const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string }
    if (data.access_token) return data.access_token
    if (data.error === 'authorization_pending') continue
    if (data.error === 'slow_down') { intervalMs += 5000; continue }
    if (data.error === 'expired_token') throw new Error('GitHub login expired before you authorized. Try again.')
    throw new Error(data.error_description || data.error || 'GitHub OAuth failed.')
  }
  throw new Error('GitHub login timed out.')
}

export async function fetchGithubLogin(token: string, fetchFn: FetchFn = fetch): Promise<string> {
  try {
    const res = await fetchFn(`${GITHUB_API}/user`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': UA },
    })
    if (!res.ok) return 'github'
    const data = (await res.json()) as { login?: string }
    return data.login || 'github'
  } catch {
    return 'github'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/githubAuth.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add electron/githubAuth.ts electron/__tests__/githubAuth.test.ts
git commit -m "feat(auth): add GitHub OAuth device-flow module"
```

---

### Task 2: Encrypted single-identity store

**Files:**
- Create: `electron/secrets.ts`
- Create: `electron/__tests__/secrets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// electron/__tests__/secrets.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/secrets.test.ts`
Expected: FAIL — `Cannot find module '../secrets'`.

- [ ] **Step 3: Write the implementation**

```ts
// electron/secrets.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/secrets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/secrets.ts electron/__tests__/secrets.test.ts
git commit -m "feat(auth): add safeStorage-encrypted GitHub identity store"
```

---

### Task 3: Private-tools allowlist

**Files:**
- Create: `electron/privateTools.ts`
- Create: `electron/__tests__/privateTools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// electron/__tests__/privateTools.test.ts
import { describe, it, expect } from 'vitest'
import { isPrivateUnlocked, PRIVATE_TOOL_ALLOWLIST } from '../privateTools'

describe('isPrivateUnlocked', () => {
  it('is true for an allowlisted login', () => { expect(isPrivateUnlocked('darkharasho')).toBe(true) })
  it('is false for any other login', () => { expect(isPrivateUnlocked('randomuser')).toBe(false) })
  it('is false when signed out (null)', () => { expect(isPrivateUnlocked(null)).toBe(false) })
  it('allowlist contains darkharasho', () => { expect(PRIVATE_TOOL_ALLOWLIST).toContain('darkharasho') })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/privateTools.test.ts`
Expected: FAIL — `Cannot find module '../privateTools'`.

- [ ] **Step 3: Write the implementation**

```ts
// electron/privateTools.ts
// Single source of truth for which GitHub accounts may see `private` registry
// entries. Code-defined on purpose — there is intentionally no UI to edit it.
export const PRIVATE_TOOL_ALLOWLIST = ['darkharasho']

export function isPrivateUnlocked(login: string | null): boolean {
  return login != null && PRIVATE_TOOL_ALLOWLIST.includes(login)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/privateTools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/privateTools.ts electron/__tests__/privateTools.test.ts
git commit -m "feat(auth): add private-tools allowlist"
```

---

### Task 4: Register `axivale` as a private app

**Files:**
- Modify: `electron/shared/types.ts` (`AppId`, `GithubAuthState`, `DEFAULT_CONFIG.apps`)
- Modify: `electron/apps.ts` (meta type, `axivale` entry, `isAppVisible`)
- Create: `electron/__tests__/apps.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// electron/__tests__/apps.test.ts
import { describe, it, expect } from 'vitest'
import { APP_META, isInstallable, isAppVisible } from '../apps'

describe('axivale registry entry', () => {
  it('is installable and marked private', () => {
    const m = APP_META.axivale
    expect(isInstallable(m)).toBe(true)
    expect('private' in m && m.private).toBe(true)
  })

  it('asset patterns match real release names', () => {
    const m = APP_META.axivale
    if (!isInstallable(m)) throw new Error('expected installable')
    expect(m.assetPattern.win.test('AxiVale Setup 0.3.1.exe')).toBe(true)
    expect(m.assetPattern.linux.test('AxiVale-0.3.1.AppImage')).toBe(true)
  })
})

describe('isAppVisible', () => {
  it('hides a private app when locked', () => { expect(isAppVisible(APP_META.axivale, false)).toBe(false) })
  it('shows a private app when unlocked', () => { expect(isAppVisible(APP_META.axivale, true)).toBe(true) })
  it('always shows a non-private app', () => { expect(isAppVisible(APP_META.axibridge, false)).toBe(true) })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/apps.test.ts`
Expected: FAIL — `APP_META.axivale` undefined / `isAppVisible` not exported.

- [ ] **Step 3: Add `axivale` to the `AppId` union and config defaults**

In `electron/shared/types.ts`, change the first line:

```ts
export type AppId = 'axibridge' | 'axiforge' | 'axipulse' | 'axiam' | 'axivale' | 'axitools'
```

Add the `GithubAuthState` interface (place it just below the `AppState` interface):

```ts
export interface GithubAuthState {
  signedIn: boolean
  login: string | null
  unlocked: boolean // login is in the private-tools allowlist
}
```

In the same file, add `axivale` to `DEFAULT_CONFIG.apps`:

```ts
  apps: {
    axibridge: { installedVersion: null, lastChecked: null },
    axiforge:  { installedVersion: null, lastChecked: null },
    axipulse:  { installedVersion: null, lastChecked: null },
    axiam:     { installedVersion: null, lastChecked: null },
    axivale:   { installedVersion: null, lastChecked: null },
  },
```

- [ ] **Step 4: Add `private`, the `axivale` entry, and `isAppVisible` to `apps.ts`**

In `electron/apps.ts`, add `private?` to the installable meta interface:

```ts
interface InstallableAppMeta {
  id: InstallableAppId
  name: string
  repo: string
  assetPattern: AssetPattern
  configDir: string  // directory name under ~/.config/ where axiom-version is written
  private?: boolean   // gated behind the GitHub allowlist; hidden from normal users
}
```

Add the `axivale` entry to `APP_META` (after `axiam`, before `axitools`):

```ts
  axivale: {
    id: 'axivale',
    name: 'AxiVale',
    repo: 'darkharasho/axivale',
    configDir: 'axivale',
    private: true,
    assetPattern: {
      win: /AxiVale.*Setup.*\.exe$/i,
      linux: /AxiVale.*\.AppImage$/i,
    },
  },
```

Add the visibility helper at the end of the file:

```ts
export function isAppVisible(meta: AppMeta, unlocked: boolean): boolean {
  const isPrivate = 'private' in meta && meta.private === true
  return !isPrivate || unlocked
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/apps.test.ts`
Expected: PASS.

- [ ] **Step 6: Confirm nothing else broke from the union change**

Run: `npx vitest run`
Expected: PASS. (`readConfig` merges `apps` with defaults, so existing config files gain the `axivale` key automatically.)

- [ ] **Step 7: Commit**

```bash
git add electron/shared/types.ts electron/apps.ts electron/__tests__/apps.test.ts
git commit -m "feat(apps): register axivale as a private, allowlist-gated app"
```

---

### Task 5: Token-authenticated release fetch

**Files:**
- Modify: `electron/github.ts`
- Modify: `electron/__tests__/github.test.ts`

- [ ] **Step 1: Write the failing test (append to existing file)**

```ts
// add inside electron/__tests__/github.test.ts
describe('fetchLatestRelease auth', () => {
  it('sends a bearer header when a token is supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v1.0.0', assets: [
        { name: 'AxiVale-1.0.0.AppImage', browser_download_url: 'https://example.com/a.AppImage' },
      ] }),
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
      json: async () => ({ tag_name: 'v1.0.0', assets: [
        { name: 'AxiVale-1.0.0.AppImage', browser_download_url: 'https://example.com/a.AppImage' },
      ] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchLatestRelease } = await import('../github')
    await fetchLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i)
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/github.test.ts`
Expected: FAIL — `headers.Authorization` is `undefined` in the first new case (token param ignored).

- [ ] **Step 3: Add the optional token param**

Replace the head of `fetchLatestRelease` in `electron/github.ts`:

```ts
export async function fetchLatestRelease(
  repo: string,
  assetPattern: RegExp,
  token?: string,
): Promise<ReleaseInfo | null> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) headers.Authorization = `Bearer ${token}`
    const res = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, { headers })
    if (!res.ok) return null
```

(The rest of the function body is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/github.test.ts`
Expected: PASS (including the pre-existing cases).

- [ ] **Step 5: Commit**

```bash
git add electron/github.ts electron/__tests__/github.test.ts
git commit -m "feat(github): attach bearer token to release fetches"
```

---

### Task 6: Wire auth + gating into the IPC layer

No unit test — this is Electron integration glue (the repo has no `ipc-handlers.test.ts`; the pure logic it calls — `isAppVisible`, `isPrivateUnlocked`, device flow — is already covered). Verified by `npm run build` (typecheck) and the manual smoke test in Task 10.

**Files:**
- Modify: `electron/ipc-handlers.ts`

- [ ] **Step 1: Add imports**

At the top of `electron/ipc-handlers.ts`, extend the existing imports and add the new modules:

```ts
import { app, path as _unusedPath } from 'electron' // (keep existing imports; this line is illustrative — do not duplicate)
```

Concretely, add these alongside the existing imports:

```ts
import { beginDeviceAuth, pollForToken, fetchGithubLogin, GITHUB_DEVICE_CLIENT_ID } from './githubAuth'
import { IdentityStore, electronCipher } from './secrets'
import { isPrivateUnlocked } from './privateTools'
import { isAppVisible } from './apps' // add `isAppVisible` to the existing `./apps` import
```

(Adjust the existing `import { APP_META, isInstallable } from './apps'` to `import { APP_META, isInstallable, isAppVisible } from './apps'` instead of adding a second import line.)

- [ ] **Step 2: Add module-level identity state and a status pusher**

Add below the existing `let arcdpsState = ...` line:

```ts
let identityStore: IdentityStore | null = null
let githubToken: string | null = null
let githubLogin: string | null = null
let unlocked = false

function githubStatus(): import('./shared/types').GithubAuthState {
  return { signedIn: githubToken != null, login: githubLogin, unlocked }
}

function pushGithubStatus(win: BrowserWindow): void {
  win.webContents.send('github:status-updated', githubStatus())
}

async function getIdentityStore(): Promise<IdentityStore> {
  if (!identityStore) {
    const cipher = await electronCipher()
    identityStore = new IdentityStore(pathSync.join(app.getPath('userData'), 'github-identity.json'), cipher)
  }
  return identityStore
}

function applyIdentity(token: string | null, login: string | null): void {
  githubToken = token
  githubLogin = login
  unlocked = isPrivateUnlocked(login)
}
```

- [ ] **Step 3: Gate `hasAnyUpdates` so locked private apps never count**

Replace the `appsHave` computation in `hasAnyUpdates`:

```ts
export function hasAnyUpdates(): boolean {
  const appsHave = Object.entries(appStates).some(([id, s]) => {
    const meta = APP_META[id as AppId]
    if (!isAppVisible(meta, unlocked)) return false
    return s.installedVersion != null && s.latestVersion != null && s.installedVersion !== s.latestVersion
  })
  const arcdpsHave = arcdpsState.plugins.some(p => p.upToDate === false)
  return appsHave || arcdpsHave
}
```

- [ ] **Step 4: Gate `runCheckUpdates` and pass the token to fetches**

In `runCheckUpdates`, inside the `for` loop, skip locked private apps and pass the token:

```ts
  for (const [id, meta] of Object.entries(APP_META)) {
    const appId = id as AppId
    if (!isInstallable(meta)) continue
    if (!isAppVisible(meta, unlocked)) continue
    setState(win, appId, { status: 'checking' })
    const platform = process.platform === 'win32' ? 'win' : 'linux'
    const pattern = meta.assetPattern[platform]
    const release = await fetchLatestRelease(meta.repo, pattern, githubToken ?? undefined)
    // ...rest of the loop body unchanged...
  }
```

Also pass the token to the arcdps fetch in `refreshArcdps`:

```ts
    fetchRelease: (repo, pattern) => fetchLatestRelease(repo, pattern, githubToken ?? undefined),
```

- [ ] **Step 5: Load the stored identity on startup**

Inside `registerIpcHandlers`, at the very top of the function body (before the first `ipcMain.handle`), add:

```ts
  void (async () => {
    try {
      const store = await getIdentityStore()
      const saved = store.load()
      if (saved) {
        applyIdentity(saved.token, saved.login)
        pushGithubStatus(win)
      }
    } catch { /* no stored identity / safeStorage unavailable */ }
  })()
```

- [ ] **Step 6: Register the `github:*` handlers**

Inside `registerIpcHandlers` (next to the other `ipcMain.handle` calls), add:

```ts
  ipcMain.handle('github:status', () => githubStatus())

  ipcMain.handle('github:auth-begin', async () => {
    const begin = await beginDeviceAuth(GITHUB_DEVICE_CLIENT_ID)
    await shell.openExternal(begin.verificationUri)
    return {
      userCode: begin.userCode,
      verificationUri: begin.verificationUri,
      deviceCode: begin.deviceCode,
      interval: begin.interval,
      expiresIn: begin.expiresIn,
    }
  })

  ipcMain.handle('github:auth-complete', async (_e, deviceCode: string, interval: number, expiresIn: number) => {
    try {
      const token = await pollForToken(GITHUB_DEVICE_CLIENT_ID, deviceCode, {
        intervalSeconds: interval, expiresInSeconds: expiresIn,
      })
      const login = await fetchGithubLogin(token)
      const store = await getIdentityStore()
      store.save({ token, login })
      applyIdentity(token, login)
      pushGithubStatus(win)
      await runCheckUpdates(win) // populate axivale immediately if now unlocked
      onCheckComplete?.()
      return { ok: true, login }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('github:sign-out', async () => {
    const store = await getIdentityStore()
    store.clear()
    applyIdentity(null, null)
    // Drop any private app from the visible state so it disappears immediately.
    for (const [id, meta] of Object.entries(APP_META)) {
      if (!isAppVisible(meta, unlocked)) {
        setState(win, id as AppId, { installedVersion: null, latestVersion: null, downloadUrl: null, status: 'idle' })
      }
    }
    pushGithubStatus(win)
    onCheckComplete?.()
    return githubStatus()
  })
```

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: succeeds with no type errors. (If `app` or `pathSync` is already imported, do not duplicate.)

- [ ] **Step 8: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add electron/ipc-handlers.ts
git commit -m "feat(ipc): GitHub sign-in handlers and private-app gating"
```

---

### Task 7: Expose the bridge methods

No unit test (preload/d.ts are typed glue, untested by repo convention). Verified by `npm run build`.

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/axiom.d.ts`

- [ ] **Step 1: Add to `preload.ts`**

Add a `GithubAuthState` import and the methods inside the `exposeInMainWorld('axiom', { ... })` object (next to the arcdps methods):

```ts
// extend the existing type import:
import type { AppId, InstallableAppId, Config, AppState, ArcdpsState, GithubAuthState } from './shared/types'
```

```ts
  githubGetStatus: (): Promise<GithubAuthState> =>
    ipcRenderer.invoke('github:status'),

  githubAuthBegin: (): Promise<{ userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }> =>
    ipcRenderer.invoke('github:auth-begin'),

  githubAuthComplete: (deviceCode: string, interval: number, expiresIn: number): Promise<{ ok: boolean; login?: string; error?: string }> =>
    ipcRenderer.invoke('github:auth-complete', deviceCode, interval, expiresIn),

  githubSignOut: (): Promise<GithubAuthState> =>
    ipcRenderer.invoke('github:sign-out'),

  onGithubStatusUpdated: (cb: (state: GithubAuthState) => void) => {
    ipcRenderer.on('github:status-updated', (_e, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('github:status-updated')
  },
```

- [ ] **Step 2: Add to `src/axiom.d.ts`**

Extend the type import and the `axiom` interface:

```ts
import type { AppState, AppId, InstallableAppId, Config, ArcdpsState, GithubAuthState } from '../electron/shared/types'
```

```ts
      githubGetStatus: () => Promise<GithubAuthState>
      githubAuthBegin: () => Promise<{ userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }>
      githubAuthComplete: (deviceCode: string, interval: number, expiresIn: number) => Promise<{ ok: boolean; login?: string; error?: string }>
      githubSignOut: () => Promise<GithubAuthState>
      onGithubStatusUpdated: (cb: (state: GithubAuthState) => void) => () => void
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add electron/preload.ts src/axiom.d.ts
git commit -m "feat(preload): expose GitHub auth bridge methods"
```

---

### Task 8: `useGithubAuth` hook

No unit test (no renderer test harness in this repo). Verified by `npm run build` and Task 10's smoke test.

**Files:**
- Create: `src/hooks/useGithubAuth.ts`

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useGithubAuth.ts
import { useState, useEffect, useCallback } from 'react'
import type { GithubAuthState } from '@shared/types'

const SIGNED_OUT: GithubAuthState = { signedIn: false, login: null, unlocked: false }

export function useGithubAuth() {
  const [status, setStatus] = useState<GithubAuthState>(SIGNED_OUT)
  const [userCode, setUserCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.axiom.githubGetStatus().then(setStatus)
    const unsub = window.axiom.onGithubStatusUpdated(setStatus)
    return () => { unsub() }
  }, [])

  const signIn = useCallback(async () => {
    setBusy(true)
    setError(null)
    setUserCode(null)
    try {
      const begin = await window.axiom.githubAuthBegin()
      setUserCode(begin.userCode)
      const res = await window.axiom.githubAuthComplete(begin.deviceCode, begin.interval, begin.expiresIn)
      if (!res.ok) setError(res.error ?? 'Sign-in failed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUserCode(null)
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    await window.axiom.githubSignOut()
  }, [])

  return { status, userCode, busy, error, signIn, signOut }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGithubAuth.ts
git commit -m "feat(ui): add useGithubAuth hook"
```

---

### Task 9: Sign-in row in Settings

No unit test (renderer). Verified visually in Task 10.

**Files:**
- Modify: `src/components/SettingsView.tsx`

- [ ] **Step 1: Import the hook**

Add at the top of `src/components/SettingsView.tsx`:

```ts
import { useGithubAuth } from '../hooks/useGithubAuth'
```

And inside the component body, near the other hooks:

```ts
  const github = useGithubAuth()
```

- [ ] **Step 2: Add the GitHub row**

Insert this block immediately after the "Tray badge" `<div style={row}>...</div>` and before the "AxiOM self-update" block:

```tsx
      {/* GitHub sign-in */}
      <div style={row}>
        <span style={label}>
          GitHub
          {github.status.signedIn && (
            <span style={{ color: 'var(--text-faint)', fontSize: 10, marginLeft: 6 }}>
              {github.status.login}{github.status.unlocked ? ' · private tools unlocked' : ''}
            </span>
          )}
        </span>
        {github.status.signedIn ? (
          <button
            onClick={() => github.signOut()}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer', padding: 0 }}
          >
            Sign out
          </button>
        ) : (
          <button
            onClick={() => github.signIn()}
            disabled={github.busy}
            style={{
              background: 'none', border: 'none',
              color: github.busy ? 'var(--text-dim)' : 'var(--gold-bright)',
              fontSize: 11, cursor: github.busy ? 'default' : 'pointer', padding: 0,
            }}
          >
            {github.userCode ? `Enter code: ${github.userCode}` : github.busy ? 'Waiting…' : 'Sign in with GitHub'}
          </button>
        )}
      </div>
      {github.error && (
        <div style={{ color: '#e05252', fontSize: 10, padding: '2px 0 8px' }}>{github.error}</div>
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsView.tsx
git commit -m "feat(ui): GitHub sign-in row in Settings"
```

---

### Task 10: Show `axivale` in the list only when unlocked

No unit test (renderer). Verified by the manual smoke test below.

**Files:**
- Modify: `src/components/AppList.tsx`

- [ ] **Step 1: Import the hook and compute the order**

In `src/components/AppList.tsx`, add the import:

```ts
import { useGithubAuth } from '../hooks/useGithubAuth'
```

Replace the module-level constant usage. Keep `APP_ORDER` but derive the visible order inside the component. Change the constant to include axivale in its display position:

```ts
const APP_ORDER: AppId[] = ['axibridge', 'axiforge', 'axipulse', 'axiam', 'axivale', 'axitools']
```

Inside the component body (next to the existing `useArcdpsState` call), add:

```ts
  const { status: githubStatus } = useGithubAuth()
  const visibleOrder = APP_ORDER.filter(id => id !== 'axivale' || githubStatus.unlocked)
```

- [ ] **Step 2: Render the filtered order**

Change the app-rows map from `APP_ORDER` to `visibleOrder`:

```tsx
      {/* App rows */}
      <div style={{ flex: 1 }}>
        {visibleOrder.map(id => stateMap[id] && (
          <AppRow key={id} state={stateMap[id]} onAction={handleAction} onInfo={onOpenInfo} onRetry={handleRetry} />
        ))}
      </div>
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev` (or the project's dev launch).
Verify, in order:
1. **Signed out:** the list shows axibridge / axiforge / axipulse / axiam / axitools — **no AxiVale**.
2. Open **Settings → "Sign in with GitHub"**: a code appears, the browser opens to `github.com/login/device`.
3. Authorize as **darkharasho** → Settings shows `darkharasho · private tools unlocked`.
4. Back to the list → **AxiVale now appears** and gets an installed/latest version on the next check.
5. **Sign out** → AxiVale disappears from the list again.
6. Sign in as a **non-allowlisted** account → signed-in label shows, but **no AxiVale** (not unlocked).

- [ ] **Step 5: Commit**

```bash
git add src/components/AppList.tsx
git commit -m "feat(ui): reveal axivale in the list when GitHub-unlocked"
```

---

## Self-Review

**Spec coverage:**
- Device flow module → Task 1 ✓
- `safeStorage` token storage (not in config.json) → Task 2 ✓
- Allowlist (`['darkharasho']`) → Task 3 ✓
- `axivale` private registry entry + `private` flag → Task 4 ✓
- Bearer token on release fetches (60→5,000/hr) → Tasks 5 (apps) + 6 (arcdps fetch) ✓
- IPC handlers `github:auth-begin / auth-complete / status / sign-out` → Task 6 ✓
- Skip private apps unless unlocked in `runCheckUpdates`; gate `hasAnyUpdates` → Task 6 ✓
- preload + `axiom.d.ts` → Task 7 ✓
- Sign-in **in Settings** → Task 9 ✓
- `axivale` in main list only when unlocked → Task 10 ✓
- Tests mirroring `electron/__tests__`: githubAuth, secrets, privateTools, apps, github bearer → Tasks 1–5 ✓
- Out-of-scope items (multi-account keyring, repo scope, settings toggle, allowlist UI) → not implemented ✓

**Type consistency:** `GithubAuthState { signedIn, login, unlocked }` defined in Task 4, used identically in Tasks 6–10. `IdentityStore.load/save/clear` and `Cipher.encrypt/decrypt` consistent across Tasks 2 and 6. `fetchLatestRelease(repo, pattern, token?)` signature consistent across Tasks 5 and 6. `isAppVisible(meta, unlocked)` consistent across Tasks 4, 6, 10. Hook returns `{ status, userCode, busy, error, signIn, signOut }`, consumed consistently in Tasks 9–10.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The only deliberately illustrative line (the "do not duplicate" import note in Task 6 Step 1) is immediately followed by the concrete imports to add.
