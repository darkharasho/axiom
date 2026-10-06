# AxiAdmin Private App in AxiOM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** List the private `darkharasho/axiadmin` app in AxiOM for allowlisted logins only, let those logins grant the `repo` scope once through an "Unlock private apps" action, and install and update AxiAdmin from its private releases without the token ever leaving the private repo's API paths.

**Architecture:** `APP_META` gains an `axiadmin` entry marked `private: true` and gated by the existing allowlist mechanism (`isAppVisible`). The main process now filters hidden apps out of the states it sends to the renderer. One pure function, `bearerFor` in the new `electron/tokenScope.ts`, decides whether a URL may carry the token. Every authenticated request goes through it, and public release lookups stop sending a token at all. Private release lookups live in the new `electron/privateRelease.ts`, which also holds an auth-failure latch so that a 401/404 shows "Sign in again to update AxiAdmin" and is not retried with the same token. Downloads follow the asset API redirect without forwarding any headers.

**Tech Stack:** Electron 32, TypeScript, React 18, Vitest 1.6 (jsdom env, `pool: 'forks'`, `maxWorkers: 2` already set in `vitest.config.ts`), @testing-library/react.

**Spec:** `/var/home/mstephens/Documents/GitHub/axi-config/docs/superpowers/specs/2026-10-06-axiadmin-design.md`. This plan covers §3 (axiom changes), the axiom lines of §6, and the AxiAdmin glyph (§2 "Logo", the `axiadmin-glyph.svg` bullet). Background: `docs/superpowers/specs/2026-06-13-private-tools-github-oauth-design.md`.

**Rulings on the spec, given what the code actually looks like:**
- **Public fetches lose their token.** Today `fetchLatestRelease` gets the signed-in token for every repo, including the app repos and the third-party arcdps plugin repos (the 2026-06-13 design attached it to raise the rate limit). §3 says the bearer is "never sent on public-app requests". Once a user unlocks, the stored token carries `repo`, so this plan removes the `token` option from `fetchLatestRelease` and from both of its callers. Signed-in users drop back to the anonymous limit of 60 requests an hour. One check makes about 21 requests (7 apps plus the arcdps GitHub plugins), and checks run every 30 minutes.
- **Private lookups use `/releases/latest`, as the spec says.** Public lookups keep listing releases (see the comment in `electron/github.ts`). For an owner-only repo that never uses `make_latest` tricks, `/releases/latest` is fine. One consequence: a private repo with no published release returns 404, so it shows the re-sign-in message too.
- **"As for axivale".** axivale is no longer gated, so `apps.test.ts` currently asserts that nothing is gated. AxiAdmin reuses the same `allowlist` and `isAppVisible` mechanism. The renderer has no visibility filter today, because every app is public. This plan adds one in the main process (`visibleAppStates`). Without it, AxiAdmin would show up for everyone.
- **Allowlisted but not yet unlocked.** In this state AxiOM makes **no** private request, because a `read:user` token is guaranteed a 404. The row shows "Unlock private apps in Settings to update AxiAdmin" instead of the misleading re-sign-in text.
- **Marketing.** The glyph is added to `marketing/assets/` and to the app's `public/svg/` icon set (`APP_ICONS`). It is **not** added as a suite card in `marketing/index.html` or to `README.md`: the repo is private, so a "View on GitHub" link would 404 for every visitor.

## Global Constraints

- APP_META entry, verbatim: `{ id: 'axiadmin', name: 'AxiAdmin', repo: 'darkharasho/axiadmin', configDir: 'axiadmin', private: true, allowlist: ['darkharasho'], assetPattern: { win: /AxiAdmin.*Setup.*\.exe$/i, linux: /AxiAdmin.*\.AppImage$/i } }`.
- Sign-in scope stays `read:user`. The unlock flow requests `read:user repo`. No login outside a `private: true` entry's allowlist ever triggers a `repo` request.
- The new token replaces the stored one. The stored record gains `scopes: string[]`. A record without `scopes` still loads and is treated as `['read:user']`.
- Token containment: the bearer is attached only when the protocol is `https:`, the host is exactly `api.github.com`, and the path is under `/repos/<repo>/` of a `private: true` entry. It is never attached to public-app requests or to the asset redirect target.
- Private release lookup: `https://api.github.com/repos/<repo>/releases/latest` with `Authorization: Bearer <token>`. Private asset download: the asset's API `url` with `Accept: application/octet-stream`, following the redirect without the `Authorization` header.
- On 401 or 404, show `Sign in again to update <app name>` (for this app, "Sign in again to update AxiAdmin") and do not retry with the same token.
- Public apps keep their current anonymous release-list and `browser_download_url` path.
- Glyph file contents are exact (Task 1), with no trailing newline, matching the existing glyphs.
- Every test command passes `--maxWorkers=2` (`npx vitest run --maxWorkers=2 …`). Tests never touch the network: inject `fetchFn` or mock `https`.
- Commit messages end with a blank line followed by `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Releasing AxiOM is out of scope. Do not bump the version, tag or push.

## Review Focus

- **URL tricks around the private path.** `..` and `%2e%2e` segments, an encoded slash, a look-alike repo (`axiadmin-evil`), a look-alike host, a userinfo host, a non-default port and plain `http` must all get no bearer. These are pinned in Task 2's `it.each` table.
- **The no-retry latch must reset when the token changes.** After "Sign in again", signing in or unlocking again must retry, or AxiAdmin can never update again. Pinned in Task 6 ("retries once the token changes").
- **Old identity file for the owner.** A record written before this change (no `scopes`) must still load and must offer the Unlock action. Pinned in Task 3 (loads without scopes) and Task 4 (`needsPrivateUnlock(login, undefined)` is true).
- **Redirect codes other than 302.** GitHub or a proxy can answer 301, 303, 307 or 308. Every one must be followed, and none may carry the headers onward. Pinned in Task 7's `it.each`.
- **Allowlisted but signed in with `read:user` only.** For example, after signing out and back in. There must be no private request, and the row must show the unlock hint, not "Sign in again". Pinned in Task 6 ("makes no request without the repo scope").

---

## File Structure

**Create:**
- `electron/tokenScope.ts`: `bearerFor` (the single containment rule) and `assetDownloadHeaders`.
- `electron/privateRelease.ts`: `fetchPrivateRelease`, `resolvePrivateRelease`, `AuthFailureLatch`, `signInAgainMessage`, `unlockMessage`.
- `electron/__tests__/tokenScope.test.ts`
- `electron/__tests__/privateRelease.test.ts`
- `electron/__tests__/installer.test.ts`
- `src/__tests__/appMeta.test.ts`
- `public/svg/axiadmin-glyph.svg`, `marketing/assets/axiadmin-glyph.svg`

**Modify:**
- `electron/shared/types.ts`: `AppId`, `DEFAULT_CONFIG.apps`, `GithubAuthState.canUnlockPrivate`, `ReleaseInfo.assetName`, `AppState.notice`.
- `electron/apps.ts`: `private?` flag, `axiadmin` entry, `visibleAppStates`.
- `electron/github.ts`: drop the `token` option.
- `electron/githubAuth.ts`: scope constants and a `scope` parameter on `beginDeviceAuth`; header comment.
- `electron/secrets.ts`: `scopes` on `Identity`.
- `electron/privateTools.ts`: `isPrivateEligible`, `needsPrivateUnlock`, `deviceFlowScope`.
- `electron/installer.ts`: headers on the first hop only, all redirect codes, `HttpStatusError`, `assetFilename`, `DownloadOpts`.
- `electron/ipc-handlers.ts`: visibility filter, scopes, unlock mode, private checks, private downloads.
- `electron/preload.ts`, `src/axiom.d.ts`: `githubAuthBegin(mode)`.
- `src/hooks/useGithubAuth.ts`, `src/hooks/useConfig.ts`, `src/lib/appMeta.ts`, `src/components/AppList.tsx`, `src/components/SettingsView.tsx`, `src/components/AppRow.tsx`.
- Tests: `electron/__tests__/apps.test.ts`, `github.test.ts`, `githubAuth.test.ts`, `secrets.test.ts`, `privateTools.test.ts`, `src/__tests__/SettingsView.test.tsx`, `AppRow.test.tsx`, `setup.ts`.

All paths are relative to `/var/home/mstephens/Documents/GitHub/axiom`.

---

### Task 1: Registry entry, visibility filter and glyph

**Files:**
- Modify: `electron/shared/types.ts:1` (AppId), `electron/shared/types.ts:141-149` (DEFAULT_CONFIG.apps)
- Modify: `electron/apps.ts:8-15`, `electron/apps.ts:99-114`
- Modify: `electron/ipc-handlers.ts` (`pushStates`, `axiom:get-states`, startup identity load, `axiom:install`)
- Modify: `src/hooks/useConfig.ts:10-18`, `src/lib/appMeta.ts`, `src/components/AppList.tsx:21`
- Create: `public/svg/axiadmin-glyph.svg`, `marketing/assets/axiadmin-glyph.svg`
- Test: `electron/__tests__/apps.test.ts`, `src/__tests__/appMeta.test.ts`, `src/__tests__/AppList.test.tsx` (existing coverage test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AppId` includes `'axiadmin'`. `InstallableAppMeta.private?: boolean`. `APP_META.axiadmin`. `visibleAppStates<T extends { id: AppId }>(states: readonly T[], login: string | null): T[]` exported from `electron/apps.ts`. `APP_ICONS.axiadmin === './svg/axiadmin-glyph.svg'`.

- [ ] **Step 1: Write the failing tests**

In `electron/__tests__/apps.test.ts`, change the import line to:

```ts
import { APP_META, isInstallable, isAppVisible, visibleAppStates } from '../apps'
```

Replace the test `'has no gated entries in the registry — every app is generally available'` with:

```ts
  it('gates only axiadmin', () => {
    const gated = Object.values(APP_META).filter(m => 'allowlist' in m && m.allowlist != null)
    expect(gated.map(m => m.id)).toEqual(['axiadmin'])
  })
```

Append:

```ts
describe('axiadmin registry entry', () => {
  it('is installable, private and gated to darkharasho', () => {
    const m = APP_META.axiadmin
    if (!isInstallable(m)) throw new Error('expected installable')
    expect(m.name).toBe('AxiAdmin')
    expect(m.repo).toBe('darkharasho/axiadmin')
    expect(m.configDir).toBe('axiadmin')
    expect(m.private).toBe(true)
    expect(m.allowlist).toEqual(['darkharasho'])
  })

  it('asset patterns match the release names', () => {
    const m = APP_META.axiadmin
    if (!isInstallable(m)) throw new Error('expected installable')
    expect(m.assetPattern.win.test('AxiAdmin-Setup-0.1.0.exe')).toBe(true)
    expect(m.assetPattern.linux.test('AxiAdmin-0.1.0.AppImage')).toBe(true)
    expect(m.assetPattern.linux.test('AxiAdmin-Setup-0.1.0.exe')).toBe(false)
  })

  it('is hidden unless the login is allowlisted', () => {
    expect(isAppVisible(APP_META.axiadmin, null)).toBe(false)
    expect(isAppVisible(APP_META.axiadmin, 'randomuser')).toBe(false)
    expect(isAppVisible(APP_META.axiadmin, 'darkharasho')).toBe(true)
  })
})

describe('visibleAppStates', () => {
  const states = (['axibridge', 'axiadmin', 'axitools'] as const).map(id => ({ id }))

  it('drops axiadmin when signed out', () => {
    expect(visibleAppStates(states, null).map(s => s.id)).toEqual(['axibridge', 'axitools'])
  })

  it('drops axiadmin for a login not on its allowlist', () => {
    expect(visibleAppStates(states, 'randomuser').map(s => s.id)).toEqual(['axibridge', 'axitools'])
  })

  it('keeps axiadmin for darkharasho', () => {
    expect(visibleAppStates(states, 'darkharasho').map(s => s.id)).toEqual(['axibridge', 'axiadmin', 'axitools'])
  })
})
```

Create `src/__tests__/appMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { APP_ICONS, APP_NAMES } from '../lib/appMeta'

const GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="242 242 540 540" width="540" height="540"><g transform="translate(242 242) scale(2.1094)"><path d="M216,56v56c0,96-88,120-88,120S40,208,40,112V56a8,8,0,0,1,8-8H208A8,8,0,0,1,216,56Z"  fill="#ffc53d" opacity="0.45"/><path fill="#e4e3dc" d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"/></g></svg>'

describe('axiadmin glyph', () => {
  it('is wired into the app icon map', () => {
    expect(APP_ICONS.axiadmin).toBe('./svg/axiadmin-glyph.svg')
    expect(APP_NAMES.axiadmin).toBe('AxiAdmin')
  })

  it('ships the exact glyph in the app and the marketing assets', () => {
    const root = process.cwd()
    expect(readFileSync(path.join(root, 'public/svg/axiadmin-glyph.svg'), 'utf8')).toBe(GLYPH)
    expect(readFileSync(path.join(root, 'marketing/assets/axiadmin-glyph.svg'), 'utf8')).toBe(GLYPH)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/apps.test.ts src/__tests__/appMeta.test.ts src/__tests__/AppList.test.tsx`
Expected: FAIL. `visibleAppStates` is not exported, `APP_META.axiadmin` is undefined, and the glyph files are missing (ENOENT). The `APP_ORDER registry coverage` test stays green until the entry exists, then fails until Step 3 updates `APP_ORDER`.

- [ ] **Step 3: Implement**

`electron/shared/types.ts` line 1:

```ts
export type AppId = 'axibridge' | 'axiforge' | 'axipulse' | 'axiam' | 'axivale' | 'axiroster' | 'axistream' | 'axiadmin' | 'axitools'
```

In `DEFAULT_CONFIG.apps`, after the `axistream` line:

```ts
    axiadmin:   { installedVersion: null, lastChecked: null },
```

Add the same line after `axistream` in `EMPTY_CONFIG.apps` in `src/hooks/useConfig.ts`.

`electron/apps.ts`: add the flag to `InstallableAppMeta`, after `allowlist?`:

```ts
  // Private GitHub repo: release lookups and downloads need the signed-in user's
  // repo-scoped token, and only ever send it to this repo's API paths (see
  // tokenScope.ts). Always pair with an allowlist, which decides visibility.
  private?: boolean
```

Add the entry immediately before `axitools:`:

```ts
  axiadmin: {
    id: 'axiadmin',
    name: 'AxiAdmin',
    repo: 'darkharasho/axiadmin',
    configDir: 'axiadmin',
    private: true,
    allowlist: ['darkharasho'],
    assetPattern: {
      win: /AxiAdmin.*Setup.*\.exe$/i,
      linux: /AxiAdmin.*\.AppImage$/i,
    },
  },
```

Append after `isAppVisible`:

```ts
// The renderer must never learn that a gated app exists for a login that can't
// see it, so the main process filters before every send.
export function visibleAppStates<T extends { id: AppId }>(states: readonly T[], login: string | null): T[] {
  return states.filter(s => isAppVisible(APP_META[s.id], login))
}
```

`src/lib/appMeta.ts`: add one line to each record, after the `axistream` line:

```ts
  axiadmin:   './svg/axiadmin-glyph.svg',
```
```ts
  axiadmin:   'AxiAdmin',
```
```ts
  axiadmin:   'Owner-only admin hub for axi-config: manage bans and flags, and see who changed what and when.',
```

`src/components/AppList.tsx` line 21:

```ts
export const APP_ORDER: AppId[] = ['axibridge', 'axiforge', 'axipulse', 'axiam', 'axivale', 'axiroster', 'axistream', 'axiadmin', 'axitools']
```

`electron/ipc-handlers.ts`:
- Line 6 import becomes `import { APP_META, isInstallable, isAppVisible, visibleAppStates } from './apps'`.
- `pushStates` body becomes `win.webContents.send('axiom:states-updated', visibleAppStates(Object.values(appStates), githubLogin))`.
- `ipcMain.handle('axiom:get-states', () => Object.values(appStates))` becomes `ipcMain.handle('axiom:get-states', () => visibleAppStates(Object.values(appStates), githubLogin))`.
- In the startup identity load, add `pushStates(win)` right after `pushGithubStatus(win)`. A renderer that asked for states before the stored identity loaded then receives the gated row.
- In `axiom:install`, right after `if (!isInstallable(meta)) return`, add `if (!isAppVisible(meta, githubLogin)) return`.

Create the glyphs with no trailing newline:

```bash
cd /var/home/mstephens/Documents/GitHub/axiom
printf '%s' '<svg xmlns="http://www.w3.org/2000/svg" viewBox="242 242 540 540" width="540" height="540"><g transform="translate(242 242) scale(2.1094)"><path d="M216,56v56c0,96-88,120-88,120S40,208,40,112V56a8,8,0,0,1,8-8H208A8,8,0,0,1,216,56Z"  fill="#ffc53d" opacity="0.45"/><path fill="#e4e3dc" d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"/></g></svg>' > public/svg/axiadmin-glyph.svg
cp public/svg/axiadmin-glyph.svg marketing/assets/axiadmin-glyph.svg
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/apps.test.ts src/__tests__/appMeta.test.ts src/__tests__/AppList.test.tsx electron/__tests__/privateTools.test.ts && npm run typecheck`
Expected: PASS, and typecheck exits 0. The `Record<AppId, …>` maps force every per-app table to include `axiadmin`.

- [ ] **Step 5: Commit**

```bash
git add electron/shared/types.ts electron/apps.ts electron/ipc-handlers.ts src/hooks/useConfig.ts src/lib/appMeta.ts src/components/AppList.tsx public/svg/axiadmin-glyph.svg marketing/assets/axiadmin-glyph.svg electron/__tests__/apps.test.ts src/__tests__/appMeta.test.ts
git commit -m "$(cat <<'EOF'
feat(apps): list private AxiAdmin for allowlisted logins

Adds the axiadmin registry entry (private, allowlisted to darkharasho),
filters gated apps out of every state sent to the renderer, and ships
the AxiAdmin glyph.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Token containment

**Files:**
- Create: `electron/tokenScope.ts`
- Create: `electron/__tests__/tokenScope.test.ts`
- Modify: `electron/github.ts:19-25,39-45` (drop `token`)
- Modify: `electron/ipc-handlers.ts` (`refreshArcdps` and `runCheckUpdates` stop passing `token`)
- Test: `electron/__tests__/github.test.ts:127-155`

**Interfaces:**
- Consumes: `APP_META` (Task 1).
- Produces:
  - `bearerFor(url: string, token: string | null | undefined, metas?: readonly ScopeMeta[]): string | undefined`, which returns `` `Bearer ${token}` `` or `undefined`.
  - `assetDownloadHeaders(url: string, token: string | null | undefined): Record<string, string> | undefined`.
  - `type ScopeMeta = { repo: string | null; private?: boolean }`.
  - `FetchReleaseOpts` is now `{ includePrerelease?: boolean }`, with no `token`.

- [ ] **Step 1: Write the failing tests**

Create `electron/__tests__/tokenScope.test.ts`:

```ts
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
```

In `electron/__tests__/github.test.ts`, replace the whole `describe('fetchLatestRelease auth', …)` block with:

```ts
describe('fetchLatestRelease auth', () => {
  // Public release lookups are always anonymous. The signed-in token can carry
  // the repo scope, and it may only go to a private entry's API paths
  // (tokenScope.ts). Even a stray token option must not leak through.
  it('never sends an Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ tag_name: 'v1.0.0', assets: [
        { name: 'AxiVale-1.0.0.AppImage', browser_download_url: 'https://example.com/a.AppImage' },
      ] }],
    })
    vi.stubGlobal('fetch', fetchMock)
    const { fetchLatestRelease } = await import('../github')
    await fetchLatestRelease('darkharasho/axivale', /AxiVale.*\.AppImage$/i, { token: 'gho_tok' } as never)
    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/tokenScope.test.ts electron/__tests__/github.test.ts`
Expected: FAIL. `tokenScope.test.ts` fails with "Failed to resolve import ../tokenScope". `github.test.ts` fails with `expected 'Bearer gho_tok' to be undefined`.

- [ ] **Step 3: Implement**

Create `electron/tokenScope.ts`:

```ts
// The one rule for where the signed-in GitHub token may go. After "Unlock
// private apps" the token carries the repo scope, so it is attached only to
// api.github.com requests under /repos/<repo>/ of a private: true APP_META
// entry. Everything else (public apps, arcdps plugins, the signed storage
// host a private asset redirects to) is anonymous.
import { APP_META } from './apps'

export type ScopeMeta = { repo: string | null; private?: boolean }

const API_HOST = 'api.github.com'

function privateRepoPrefixes(metas: readonly ScopeMeta[]): string[] {
  return metas
    .filter(m => m.private === true && typeof m.repo === 'string' && m.repo.length > 0)
    .map(m => `/repos/${(m.repo as string).toLowerCase()}/`)
}

export function bearerFor(
  url: string,
  token: string | null | undefined,
  metas: readonly ScopeMeta[] = Object.values(APP_META),
): string | undefined {
  if (!token) return undefined
  let u: URL
  try { u = new URL(url) } catch { return undefined }
  // URL has already lowercased the host, dropped a default :443 and resolved
  // ./.. (including %2e%2e) segments, so these compares see the real target.
  if (u.protocol !== 'https:' || u.host !== API_HOST || u.username || u.password) return undefined
  const path = u.pathname.toLowerCase()
  return privateRepoPrefixes(metas).some(prefix => path.startsWith(prefix)) ? `Bearer ${token}` : undefined
}

/** Headers for downloading a private release asset through its API url, or
 *  undefined when the url is not a private asset (the anonymous public path). */
export function assetDownloadHeaders(url: string, token: string | null | undefined): Record<string, string> | undefined {
  const auth = bearerFor(url, token)
  if (!auth) return undefined
  return { Authorization: auth, Accept: 'application/octet-stream', 'User-Agent': 'AxiOM' }
}
```

`electron/github.ts`: change `FetchReleaseOpts` to:

```ts
export interface FetchReleaseOpts {
  // Opt in to prereleases (rc builds). Off by default: the newest stable is
  // what a user who hasn't asked for test builds should be offered. Drafts are
  // excluded either way — they aren't published to anyone.
  includePrerelease?: boolean
}
```

In `fetchLatestRelease`, replace `const { token, includePrerelease = false } = opts` with `const { includePrerelease = false } = opts`, and delete the line `if (token) headers.Authorization = \`Bearer ${token}\``. Above the `headers` declaration, add the comment `// Always anonymous: these are public repos (see tokenScope.ts).`

`electron/ipc-handlers.ts`: delete the line `token: githubToken ?? undefined,` in both `refreshArcdps` (`fetchRelease: …`) and `runCheckUpdates` (`fetchLatestRelease(meta.repo, …)`).

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/tokenScope.test.ts electron/__tests__/github.test.ts && npm run typecheck`
Expected: PASS, and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add electron/tokenScope.ts electron/__tests__/tokenScope.test.ts electron/github.ts electron/__tests__/github.test.ts electron/ipc-handlers.ts
git commit -m "$(cat <<'EOF'
feat(auth): confine the GitHub token to private repo API paths

bearerFor is the single rule for attaching the token: https, host
api.github.com, path under /repos/<repo>/ of a private entry. Public
release lookups are now always anonymous.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Stored scopes on the identity record

**Files:**
- Modify: `electron/secrets.ts:10-21,28-50`
- Test: `electron/__tests__/secrets.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Identity.scopes?: string[]`, which is round-tripped. `load()` leaves `scopes` undefined for old or malformed records.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('IdentityStore', …)` in `electron/__tests__/secrets.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/secrets.test.ts`
Expected: FAIL. `round-trips granted scopes` fails because the loaded object has no `scopes`.

- [ ] **Step 3: Implement**

In `electron/secrets.ts`, add to `Identity` after `id?`:

```ts
  /** OAuth scopes the token was granted with; absent in files written before
   *  the private-apps unlock (those tokens were read:user). */
  scopes?: string[]
```

Add `scopes?: string[]` to `FileShape`. In `load()`, after the `id` line:

```ts
      if (Array.isArray(data.scopes) && data.scopes.every(s => typeof s === 'string')) identity.scopes = [...data.scopes]
```

In `save()`, after the `id` spread:

```ts
      ...(identity.scopes != null ? { scopes: identity.scopes } : {}),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/secrets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/secrets.ts electron/__tests__/secrets.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): record granted scopes on the stored GitHub identity

Old records without scopes still load.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Unlock eligibility and the repo-scope device flow (main process)

**Files:**
- Modify: `electron/githubAuth.ts:1-6,28-30`
- Modify: `electron/privateTools.ts`
- Modify: `electron/shared/types.ts` (`GithubAuthState`)
- Modify: `electron/ipc-handlers.ts` (imports, identity state, `githubStatus`, `applyIdentity`, startup load, `github:auth-begin`, `github:auth-complete`)
- Modify: `electron/preload.ts:107-108`, `src/axiom.d.ts:38`, `src/hooks/useGithubAuth.ts:4`
- Test: `electron/__tests__/githubAuth.test.ts`, `electron/__tests__/privateTools.test.ts`

**Interfaces:**
- Consumes: `Identity.scopes` (Task 3), `APP_META.axiadmin.private` (Task 1).
- Produces:
  - `SCOPE_BASIC = 'read:user'`, `SCOPE_PRIVATE = 'read:user repo'`, `scopeList(scope: string): string[]` from `githubAuth.ts`.
  - `beginDeviceAuth(clientId: string, fetchFn?: FetchFn, scope?: string)`.
  - `isPrivateEligible(login: string | null): boolean`, `needsPrivateUnlock(login: string | null, scopes: readonly string[] | undefined): boolean`, `type DeviceFlowMode = 'sign-in' | 'unlock'` and `deviceFlowScope(mode: DeviceFlowMode, login: string | null, scopes: readonly string[] | undefined): string` (throws for a refused unlock) from `privateTools.ts`.
  - `GithubAuthState.canUnlockPrivate: boolean`.
  - IPC `github:auth-begin` takes an optional mode argument. The bridge is `window.axiom.githubAuthBegin(mode?: 'sign-in' | 'unlock')`.
  - Module state `githubScopes: string[]` in `ipc-handlers.ts`, which Task 6 reads.

- [ ] **Step 1: Write the failing tests**

In `electron/__tests__/githubAuth.test.ts`, change the import to:

```ts
import { beginDeviceAuth, pollForToken, fetchGithubLogin, fetchGithubUser, SCOPE_BASIC, SCOPE_PRIVATE, scopeList } from '../githubAuth'
```

Append inside `describe('beginDeviceAuth', …)`:

```ts
  const deviceOk = () => vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ device_code: 'DEV', user_code: 'C', verification_uri: 'https://github.com/login/device' }),
  })

  it('requests read:user only by default', async () => {
    const fetchFn = deviceOk()
    await beginDeviceAuth('client', fetchFn as unknown as typeof fetch)
    expect((fetchFn.mock.calls[0][1].body as URLSearchParams).get('scope')).toBe('read:user')
  })

  it('requests the scope it is given', async () => {
    const fetchFn = deviceOk()
    await beginDeviceAuth('client', fetchFn as unknown as typeof fetch, SCOPE_PRIVATE)
    expect((fetchFn.mock.calls[0][1].body as URLSearchParams).get('scope')).toBe('read:user repo')
  })
```

Append at the end of the file:

```ts
describe('scope constants', () => {
  it('splits a scope string into its scopes', () => {
    expect(SCOPE_BASIC).toBe('read:user')
    expect(scopeList(SCOPE_PRIVATE)).toEqual(['read:user', 'repo'])
    expect(scopeList('read:user,repo')).toEqual(['read:user', 'repo'])
  })
})
```

In `electron/__tests__/privateTools.test.ts`, change the import to:

```ts
import { isPrivateUnlocked, needsPrivateUnlock, deviceFlowScope } from '../privateTools'
```

In the `vi.mock` factory's `APP_META`, add a second fixture after `gatedfixture`. It is gated but **not** private:

```ts
      gatedonly: { id: 'gatedonly', name: 'GatedOnly', repo: null, allowlist: ['gatedonly'] },
```

Append:

```ts
describe('needsPrivateUnlock', () => {
  it('is true for an allowlisted login without the repo scope', () => {
    expect(needsPrivateUnlock('darkharasho', ['read:user'])).toBe(true)
  })
  it('is true for an old identity with no recorded scopes', () => {
    expect(needsPrivateUnlock('darkharasho', undefined)).toBe(true)
  })
  it('is false once repo is granted', () => {
    expect(needsPrivateUnlock('darkharasho', ['read:user', 'repo'])).toBe(false)
  })
  it('is false for a login on no allowlist', () => {
    expect(needsPrivateUnlock('randomuser', ['read:user'])).toBe(false)
  })
  it('is false for a login only on a gated entry that is not private', () => {
    expect(isPrivateUnlocked('gatedonly')).toBe(true)
    expect(needsPrivateUnlock('gatedonly', ['read:user'])).toBe(false)
  })
  it('is false when signed out', () => {
    expect(needsPrivateUnlock(null, undefined)).toBe(false)
  })
})

describe('deviceFlowScope', () => {
  it('asks every login for read:user only on sign-in', () => {
    expect(deviceFlowScope('sign-in', null, undefined)).toBe('read:user')
    expect(deviceFlowScope('sign-in', 'darkharasho', ['read:user'])).toBe('read:user')
  })
  it('asks an allowlisted login for repo on unlock', () => {
    expect(deviceFlowScope('unlock', 'darkharasho', ['read:user'])).toBe('read:user repo')
  })
  it('never asks a login that is not allowlisted for repo', () => {
    expect(() => deviceFlowScope('unlock', 'randomuser', ['read:user'])).toThrow()
    expect(() => deviceFlowScope('unlock', 'gatedonly', ['read:user'])).toThrow()
    expect(() => deviceFlowScope('unlock', null, undefined)).toThrow()
  })
  it('refuses a second unlock once repo is granted', () => {
    expect(() => deviceFlowScope('unlock', 'darkharasho', ['read:user', 'repo'])).toThrow()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/githubAuth.test.ts electron/__tests__/privateTools.test.ts`
Expected: FAIL. `needsPrivateUnlock`, `deviceFlowScope`, `SCOPE_PRIVATE` and `scopeList` are not exported, so calls fail with "is not a function" and the scope assertions get `undefined`.

- [ ] **Step 3: Implement the pure modules**

`electron/githubAuth.ts`: replace the header comment and the `SCOPE` constant (lines 1-6) with:

```ts
// GitHub OAuth device flow — "Sign in with GitHub".
// Pure async functions: fetch + delay are injectable for unit testing with no
// real network and no real timers. The IPC layer opens the verification URI.
// Mirrors axivale/src/main/githubAuth.ts. Sign-in asks for read:user only, which
// is enough to resolve the login. A login on the allowlist of a private APP_META
// entry can then run a second flow ("Unlock private apps") asking for
// read:user repo, because private release assets need the repo scope. No other
// login is ever asked for repo (privateTools.ts#deviceFlowScope), and the token
// only goes to the private repo's API paths (tokenScope.ts).

const GITHUB_HOST = 'https://github.com'
const GITHUB_API = 'https://api.github.com'
const UA = 'AxiOM'

export const SCOPE_BASIC = 'read:user'
export const SCOPE_PRIVATE = 'read:user repo'

/** "read:user repo" or GitHub's "read:user,repo" → ['read:user', 'repo']. */
export function scopeList(scope: string): string[] {
  return scope.split(/[\s,]+/).filter(Boolean)
}
```

Change `beginDeviceAuth`'s signature and body line:

```ts
export async function beginDeviceAuth(clientId: string, fetchFn: FetchFn = fetch, scope: string = SCOPE_BASIC): Promise<DeviceAuthBegin> {
  if (!clientId) throw new Error('Missing GitHub device client ID.')
  const body = new URLSearchParams({ client_id: clientId, scope })
```

`electron/privateTools.ts`: replace the file with:

```ts
// Whether a GitHub login unlocks any gated (allowlisted) registry entry. The
// per-app allowlists live on each APP_META entry (see apps.ts) — this only
// aggregates them for the signed-in status shown in Settings. There is
// intentionally no UI to edit the allowlists; they are code-defined.
import { APP_META, isInstallable } from './apps'
import { SCOPE_BASIC, SCOPE_PRIVATE } from './githubAuth'

export function isPrivateUnlocked(login: string | null): boolean {
  if (login == null) return false
  return Object.values(APP_META).some(
    meta => 'allowlist' in meta && meta.allowlist != null && meta.allowlist.includes(login),
  )
}

/** The login is on the allowlist of an entry whose repo is private, so it may
 *  be asked for the repo scope. */
export function isPrivateEligible(login: string | null): boolean {
  if (login == null) return false
  return Object.values(APP_META).some(
    meta => isInstallable(meta) && meta.private === true && meta.allowlist != null && meta.allowlist.includes(login),
  )
}

/** Show the one-time "Unlock private apps" action: eligible, and the stored
 *  token has no repo scope yet (an old record with no scopes counts as none). */
export function needsPrivateUnlock(login: string | null, scopes: readonly string[] | undefined): boolean {
  return isPrivateEligible(login) && !(scopes ?? []).includes('repo')
}

export type DeviceFlowMode = 'sign-in' | 'unlock'

/** The scope a device flow may request. Enforced in the main process so a
 *  login that isn't allowlisted is never asked for repo, whatever the renderer sends. */
export function deviceFlowScope(mode: DeviceFlowMode, login: string | null, scopes: readonly string[] | undefined): string {
  if (mode === 'sign-in') return SCOPE_BASIC
  if (!needsPrivateUnlock(login, scopes)) throw new Error('This GitHub account has no private apps to unlock.')
  return SCOPE_PRIVATE
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/githubAuth.test.ts electron/__tests__/privateTools.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the status, the unlock mode and the scopes into IPC**

`electron/shared/types.ts`, in `GithubAuthState`, after `unlocked`:

```ts
  canUnlockPrivate: boolean // allowlisted for a private app, but the token lacks the repo scope
```

`src/hooks/useGithubAuth.ts` line 4:

```ts
const SIGNED_OUT: GithubAuthState = { signedIn: false, login: null, unlocked: false, canUnlockPrivate: false }
```

`electron/ipc-handlers.ts`:

Imports (lines 9 and 11):

```ts
import { beginDeviceAuth, pollForToken, fetchGithubLogin, fetchGithubUser, GITHUB_DEVICE_CLIENT_ID, SCOPE_BASIC, scopeList } from './githubAuth'
import { isPrivateUnlocked, needsPrivateUnlock, deviceFlowScope, type DeviceFlowMode } from './privateTools'
```

Identity state: after `let githubId: number | null = null`, add:

```ts
let githubScopes: string[] = []
// Scopes requested per pending device code, so auth-complete records what the
// token it receives was granted for.
const pendingScopes = new Map<string, string[]>()
```

Replace `githubStatus` and `applyIdentity` with:

```ts
function githubStatus(): import('./shared/types').GithubAuthState {
  return {
    signedIn: githubToken != null,
    login: githubLogin,
    unlocked,
    canUnlockPrivate: githubToken != null && needsPrivateUnlock(githubLogin, githubScopes),
  }
}
```
```ts
function applyIdentity(token: string | null, login: string | null, id: number | null = null, scopes: string[] = []): void {
  githubToken = token
  githubLogin = login
  githubId = id
  githubScopes = scopes
  unlocked = isPrivateUnlocked(login)
}
```

In `registerIpcHandlers`, replace the `if (saved) { … }` block of the startup load with:

```ts
      if (saved) {
        // Files written before the unlock flow carry no scopes; they were read:user.
        const scopes = saved.scopes ?? scopeList(SCOPE_BASIC)
        applyIdentity(saved.token, saved.login, saved.id ?? null, scopes)
        pushGithubStatus(win)
        pushStates(win)
        onIdentityChanged?.()
        if (saved.id == null) {
          // Signed in before the access check existed: backfill the numeric id
          // once. Fails open; the next launch retries.
          try {
            const user = await fetchGithubUser(saved.token)
            if (githubToken === saved.token) { // not signed out / replaced meanwhile
              store.save({ token: saved.token, login: saved.login, id: user.id, scopes })
              applyIdentity(saved.token, saved.login, user.id, scopes)
              onIdentityChanged?.()
            }
          } catch { /* offline or rejected token: leave the id unset */ }
        }
      }
```

Replace the `github:auth-begin` handler with:

```ts
  ipcMain.handle('github:auth-begin', async (_e, rawMode?: unknown) => {
    const mode: DeviceFlowMode = rawMode === 'unlock' ? 'unlock' : 'sign-in'
    // Throws for 'unlock' unless the signed-in login is on a private entry's
    // allowlist, so no other account is ever asked for the repo scope.
    const scope = deviceFlowScope(mode, githubLogin, githubScopes)
    const begin = await beginDeviceAuth(GITHUB_DEVICE_CLIENT_ID, fetch, scope)
    pendingScopes.set(begin.deviceCode, scopeList(scope))
    await shell.openExternal(begin.verificationUri)
    return {
      userCode: begin.userCode,
      verificationUri: begin.verificationUri,
      deviceCode: begin.deviceCode,
      interval: begin.interval,
      expiresIn: begin.expiresIn,
    }
  })
```

In `github:auth-complete`, add these as the first two lines inside `try {`:

```ts
      const scopes = pendingScopes.get(deviceCode) ?? scopeList(SCOPE_BASIC)
      pendingScopes.delete(deviceCode)
```

Then replace `store.save({ token, login, ...(id != null ? { id } : {}) })` and `applyIdentity(token, login, id)` with:

```ts
      // An unlock's repo-scoped token replaces the stored read:user one.
      store.save({ token, login, ...(id != null ? { id } : {}), scopes })
      applyIdentity(token, login, id, scopes)
```

`electron/preload.ts`, replace the `githubAuthBegin` entry:

```ts
  githubAuthBegin: (mode: 'sign-in' | 'unlock' = 'sign-in'): Promise<{ userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }> =>
    ipcRenderer.invoke('github:auth-begin', mode),
```

`src/axiom.d.ts` line 38:

```ts
      githubAuthBegin: (mode?: 'sign-in' | 'unlock') => Promise<{ userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }>
```

- [ ] **Step 6: Typecheck and run the suite**

Run: `npm run typecheck && npx vitest run --maxWorkers=2`
Expected: typecheck exits 0, and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add electron/githubAuth.ts electron/privateTools.ts electron/shared/types.ts electron/ipc-handlers.ts electron/preload.ts src/axiom.d.ts src/hooks/useGithubAuth.ts electron/__tests__/githubAuth.test.ts electron/__tests__/privateTools.test.ts
git commit -m "$(cat <<'EOF'
feat(auth): repo-scope unlock flow for private-app allowlists

Sign-in stays read:user. A login on a private entry's allowlist can run
a second device flow for read:user repo; the main process refuses it for
anyone else. The new token replaces the stored one with its scopes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: "Unlock private apps" action in Settings

**Files:**
- Modify: `src/hooks/useGithubAuth.ts:26-50`
- Modify: `src/components/SettingsView.tsx:142-158`
- Modify: `src/__tests__/setup.ts` (`githubGetStatus` mock)
- Test: `src/__tests__/SettingsView.test.tsx`

**Interfaces:**
- Consumes: `GithubAuthState.canUnlockPrivate` and `window.axiom.githubAuthBegin(mode)` (Task 4).
- Produces: `useGithubAuth()` additionally returns `unlockPrivate: () => Promise<void>`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/setup.ts`, change the `githubGetStatus` mock to:

```ts
  githubGetStatus: vi.fn().mockResolvedValue({ signedIn: false, login: null, unlocked: false, canUnlockPrivate: false }),
```

Append inside `describe('SettingsView', …)` in `src/__tests__/SettingsView.test.tsx`:

```ts
  it('offers "Unlock private apps" to an allowlisted login', async () => {
    vi.mocked(window.axiom.githubGetStatus).mockResolvedValueOnce({ signedIn: true, login: 'darkharasho', unlocked: true, canUnlockPrivate: true })
    render(<SettingsView onBack={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /unlock private apps/i })).toBeInTheDocument()
  })

  it('never offers the unlock to a login that is not allowlisted', async () => {
    vi.mocked(window.axiom.githubGetStatus).mockResolvedValueOnce({ signedIn: true, login: 'randomuser', unlocked: false, canUnlockPrivate: false })
    render(<SettingsView onBack={vi.fn()} />)
    expect(await screen.findByText('randomuser')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unlock private apps/i })).not.toBeInTheDocument()
  })

  it('runs the unlock device flow and shows its code', async () => {
    vi.mocked(window.axiom.githubGetStatus).mockResolvedValueOnce({ signedIn: true, login: 'darkharasho', unlocked: true, canUnlockPrivate: true })
    vi.mocked(window.axiom.githubAuthBegin).mockResolvedValueOnce({
      userCode: 'ABCD-1234', verificationUri: 'https://github.com/login/device', deviceCode: 'DEV', interval: 5, expiresIn: 900,
    })
    vi.mocked(window.axiom.githubAuthComplete).mockReturnValueOnce(new Promise<never>(() => {})) // still waiting on GitHub
    render(<SettingsView onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /unlock private apps/i }))
    await waitFor(() => expect(window.axiom.githubAuthBegin).toHaveBeenCalledWith('unlock'))
    expect(await screen.findByText('ABCD-1234')).toBeInTheDocument()
  })

  it('starts a normal sign-in in sign-in mode', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /^sign in$/i }))
    await waitFor(() => expect(window.axiom.githubAuthBegin).toHaveBeenCalledWith('sign-in'))
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/__tests__/SettingsView.test.tsx`
Expected: FAIL. No "Unlock private apps" button is found, and `githubAuthBegin` was called with no arguments.

- [ ] **Step 3: Implement**

`src/hooks/useGithubAuth.ts`: replace `signIn` with a shared flow, and add `unlockPrivate`:

```ts
  const runFlow = useCallback(async (mode: 'sign-in' | 'unlock') => {
    setBusy(true)
    setError(null)
    setUserCode(null)
    setCopied(false)
    try {
      const begin = await window.axiom.githubAuthBegin(mode)
      setUserCode(begin.userCode)
      await copyCode(begin.userCode) // auto-copy so the user can paste it straight into GitHub
      const res = await window.axiom.githubAuthComplete(begin.deviceCode, begin.interval, begin.expiresIn)
      if (!res.ok) setError(res.error ?? 'Sign-in failed.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUserCode(null)
      setBusy(false)
    }
  }, [copyCode])

  const signIn = useCallback(() => runFlow('sign-in'), [runFlow])
  // Second device flow asking for read:user repo; only offered when the main
  // process reports canUnlockPrivate, and refused there for anyone else.
  const unlockPrivate = useCallback(() => runFlow('unlock'), [runFlow])
```

Change the return to:

```ts
  return { status, userCode, busy, error, copied, signIn, unlockPrivate, signOut, copyCode }
```

`src/components/SettingsView.tsx`: replace the children of the GitHub `SettingRow`, which is the conditional starting `{github.status.signedIn ? (`. The device code now takes precedence, because the unlock flow runs while signed in:

```tsx
          {github.userCode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="ax-ink-accent" style={{ font: 'var(--axi-t-label)', fontFamily: 'var(--axi-mono)', letterSpacing: '1.5px' }}>
                {github.userCode}
              </span>
              <button className="ax-icon" onClick={() => github.copyCode(github.userCode!)} title="Copy code" aria-label="Copy code">
                {github.copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          ) : github.status.signedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {github.status.canUnlockPrivate && (
                <button className="axi-btn ax-sm" onClick={() => github.unlockPrivate()} disabled={github.busy}>
                  {github.busy ? 'Waiting…' : 'Unlock private apps'}
                </button>
              )}
              <button className="ax-icon" onClick={() => github.signOut()}>Sign out</button>
            </div>
          ) : (
            <button className="axi-btn ax-sm" onClick={() => github.signIn()} disabled={github.busy}>
              {github.busy ? 'Waiting…' : 'Sign in'}
            </button>
          )}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run --maxWorkers=2 src/__tests__/SettingsView.test.tsx && npm run typecheck`
Expected: PASS, and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useGithubAuth.ts src/components/SettingsView.tsx src/__tests__/setup.ts src/__tests__/SettingsView.test.tsx
git commit -m "$(cat <<'EOF'
feat(settings): one-time "Unlock private apps" action

Shown only when the main process reports canUnlockPrivate; runs the
repo-scope device flow and shows its code while signed in.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Private release lookup, re-sign-in notice and no retry

**Files:**
- Create: `electron/privateRelease.ts`
- Create: `electron/__tests__/privateRelease.test.ts`
- Modify: `electron/shared/types.ts` (`ReleaseInfo.assetName`, `AppState.notice`)
- Modify: `electron/ipc-handlers.ts` (`runCheckUpdates`, sign-out reset, module state)
- Modify: `src/components/AppRow.tsx` (status text and class)
- Test: `src/__tests__/AppRow.test.tsx`

**Interfaces:**
- Consumes: `bearerFor` (Task 2), `githubScopes` (Task 4), `FetchFn` from `githubAuth.ts`.
- Produces:
  - `type PrivateReleaseResult = { kind: 'ok'; release: ReleaseInfo } | { kind: 'auth' } | { kind: 'unavailable' }`.
  - `fetchPrivateRelease(repo: string, assetPattern: RegExp, token: string | null, fetchFn?: FetchFn): Promise<PrivateReleaseResult>`.
  - `class AuthFailureLatch { trip(appId: string, token: string): void; isTripped(appId: string, token: string): boolean }`.
  - `interface PrivateCheckInput { appId: string; name: string; repo: string; assetPattern: RegExp; token: string | null; scopes: readonly string[]; latch: AuthFailureLatch; fetchFn?: FetchFn }`.
  - `resolvePrivateRelease(input: PrivateCheckInput): Promise<{ release: ReleaseInfo | null; notice?: string }>`.
  - `signInAgainMessage(name: string): string` and `unlockMessage(name: string): string`.
  - `ReleaseInfo.assetName?: string`, `AppState.notice?: string`.
  - Module state `privateAuthLatch` and `assetNames: Partial<Record<InstallableAppId, string>>` in `ipc-handlers.ts`, which Task 7 uses.

- [ ] **Step 1: Write the failing tests**

Create `electron/__tests__/privateRelease.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import {
  fetchPrivateRelease, resolvePrivateRelease, AuthFailureLatch,
  signInAgainMessage, unlockMessage, type PrivateCheckInput,
} from '../privateRelease'

const API = 'https://api.github.com/repos/darkharasho/axiadmin'
const ASSETS = [
  { name: 'AxiAdmin-Setup-0.2.0.exe', url: `${API}/releases/assets/11`, browser_download_url: 'https://github.com/darkharasho/axiadmin/releases/download/v0.2.0/AxiAdmin-Setup-0.2.0.exe', size: 100 },
  { name: 'AxiAdmin-0.2.0.AppImage', url: `${API}/releases/assets/12`, browser_download_url: 'https://github.com/darkharasho/axiadmin/releases/download/v0.2.0/AxiAdmin-0.2.0.AppImage', size: 200, digest: 'sha256:abc' },
]
const okFetch = () => vi.fn().mockResolvedValue({
  ok: true, status: 200,
  json: async () => ({ tag_name: 'v0.2.0', published_at: '2026-10-06T00:00:00Z', assets: ASSETS }),
})
const statusFetch = (status: number) => vi.fn().mockResolvedValue({ ok: false, status, json: async () => ({}) })
const LINUX = /AxiAdmin.*\.AppImage$/i

describe('fetchPrivateRelease', () => {
  it('asks /releases/latest with the bearer', async () => {
    const fetchFn = okFetch()
    await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', fetchFn as unknown as typeof fetch)
    expect(fetchFn.mock.calls[0][0]).toBe(`${API}/releases/latest`)
    expect((fetchFn.mock.calls[0][1].headers as Record<string, string>).Authorization).toBe('Bearer gho_repo')
  })

  it('returns the asset API url, not the browser url, as the download', async () => {
    const r = await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', okFetch() as unknown as typeof fetch)
    expect(r).toEqual({ kind: 'ok', release: {
      version: '0.2.0',
      downloadUrl: `${API}/releases/assets/12`,
      assetName: 'AxiAdmin-0.2.0.AppImage',
      assetSize: 200,
      assetDigest: 'sha256:abc',
      publishedAt: '2026-10-06T00:00:00Z',
    } })
  })

  it.each([401, 404])('reports %i as an auth failure', async (status) => {
    const r = await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', statusFetch(status) as unknown as typeof fetch)
    expect(r).toEqual({ kind: 'auth' })
  })

  it('reports a server error, a network error or no matching asset as unavailable', async () => {
    expect(await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', statusFetch(500) as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    const offline = vi.fn().mockRejectedValue(new Error('offline'))
    expect(await fetchPrivateRelease('darkharasho/axiadmin', LINUX, 'gho_repo', offline as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    expect(await fetchPrivateRelease('darkharasho/axiadmin', /NoSuch\.zip$/, 'gho_repo', okFetch() as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
  })

  it('sends nothing for a repo that is not a private entry', async () => {
    const fetchFn = okFetch()
    expect(await fetchPrivateRelease('darkharasho/axibridge', LINUX, 'gho_repo', fetchFn as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    expect(fetchFn).not.toHaveBeenCalled()
  })
})

describe('resolvePrivateRelease', () => {
  const input = (over: Partial<PrivateCheckInput> = {}): PrivateCheckInput => ({
    appId: 'axiadmin', name: 'AxiAdmin', repo: 'darkharasho/axiadmin', assetPattern: LINUX,
    token: 'gho_repo', scopes: ['read:user', 'repo'], latch: new AuthFailureLatch(), ...over,
  })

  it('returns the release with no notice on success', async () => {
    const r = await resolvePrivateRelease(input({ fetchFn: okFetch() as unknown as typeof fetch }))
    expect(r.release?.version).toBe('0.2.0')
    expect(r.notice).toBeUndefined()
  })

  it.each([401, 404])('shows the re-sign-in message on %i', async (status) => {
    const r = await resolvePrivateRelease(input({ fetchFn: statusFetch(status) as unknown as typeof fetch }))
    expect(r).toEqual({ release: null, notice: 'Sign in again to update AxiAdmin' })
    expect(signInAgainMessage('AxiAdmin')).toBe('Sign in again to update AxiAdmin')
  })

  it('does not retry with the same token after an auth failure', async () => {
    const latch = new AuthFailureLatch()
    const fetchFn = statusFetch(401)
    await resolvePrivateRelease(input({ latch, fetchFn: fetchFn as unknown as typeof fetch }))
    const again = await resolvePrivateRelease(input({ latch, fetchFn: fetchFn as unknown as typeof fetch }))
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(again.notice).toBe('Sign in again to update AxiAdmin')
  })

  it('retries once the token changes', async () => {
    const latch = new AuthFailureLatch()
    await resolvePrivateRelease(input({ latch, fetchFn: statusFetch(401) as unknown as typeof fetch }))
    const fetchFn = okFetch()
    const r = await resolvePrivateRelease(input({ latch, token: 'gho_new', fetchFn: fetchFn as unknown as typeof fetch }))
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(r.release?.version).toBe('0.2.0')
  })

  it('makes no request without the repo scope, and points at the unlock', async () => {
    const fetchFn = okFetch()
    const r = await resolvePrivateRelease(input({ scopes: ['read:user'], fetchFn: fetchFn as unknown as typeof fetch }))
    expect(fetchFn).not.toHaveBeenCalled()
    expect(r).toEqual({ release: null, notice: unlockMessage('AxiAdmin') })
    expect(unlockMessage('AxiAdmin')).toBe('Unlock private apps in Settings to update AxiAdmin')
  })
})
```

Append inside `describe('AppRow', …)` in `src/__tests__/AppRow.test.tsx`:

```ts
  it('shows a notice in place of the status, without a Retry button', () => {
    const state: AppState = { ...baseState, id: 'axiadmin', installedVersion: '0.1.0', latestVersion: null, notice: 'Sign in again to update AxiAdmin' }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByText('Sign in again to update AxiAdmin')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/privateRelease.test.ts src/__tests__/AppRow.test.tsx`
Expected: FAIL. `privateRelease.test.ts` fails with "Failed to resolve import ../privateRelease". The AppRow test cannot find the notice text.

- [ ] **Step 3: Implement**

`electron/shared/types.ts`: in `ReleaseInfo`, after `downloadUrl`:

```ts
  assetName?: string          // the asset's file name; set when downloadUrl is an API url with no name in it
```

In `AppState`, after `errorMessage?`:

```ts
  notice?: string              // a non-retryable hint shown in place of the status, e.g. "Sign in again to update AxiAdmin"
```

Create `electron/privateRelease.ts`:

```ts
// Release lookup for private: true APP_META entries. Unlike github.ts (public,
// anonymous, release list), this asks /releases/latest with the bearer, and
// returns the asset's API url as downloadUrl: a private asset's
// browser_download_url can't be fetched with a token. The bearer comes only from
// bearerFor, so it can't reach any other path.
import type { ReleaseInfo } from './shared/types'
import type { FetchFn } from './githubAuth'
import { bearerFor } from './tokenScope'

const GITHUB_API = 'https://api.github.com'

export type PrivateReleaseResult =
  | { kind: 'ok'; release: ReleaseInfo }
  | { kind: 'auth' }        // 401/404: token revoked, scope lost, or no access
  | { kind: 'unavailable' } // offline, 5xx, or no matching asset

interface LatestRelease {
  tag_name: string
  published_at?: string
  assets?: { name: string; url: string; size?: number; digest?: string | null }[]
}

export const signInAgainMessage = (name: string): string => `Sign in again to update ${name}`
export const unlockMessage = (name: string): string => `Unlock private apps in Settings to update ${name}`

export async function fetchPrivateRelease(
  repo: string,
  assetPattern: RegExp,
  token: string | null,
  fetchFn: FetchFn = fetch,
): Promise<PrivateReleaseResult> {
  const url = `${GITHUB_API}/repos/${repo}/releases/latest`
  const auth = bearerFor(url, token)
  if (!auth) return { kind: 'unavailable' } // not a private entry, or no token: send nothing
  try {
    const res = await fetchFn(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AxiOM',
        Authorization: auth,
      },
    })
    if (res.status === 401 || res.status === 404) return { kind: 'auth' }
    if (!res.ok) return { kind: 'unavailable' }
    const rel = (await res.json()) as LatestRelease
    const asset = rel.assets?.find(a => assetPattern.test(a.name))
    if (!asset) return { kind: 'unavailable' }
    return {
      kind: 'ok',
      release: {
        version: rel.tag_name.replace(/^v/, ''),
        downloadUrl: asset.url,
        assetName: asset.name,
        assetSize: asset.size,
        assetDigest: asset.digest ?? undefined,
        publishedAt: rel.published_at,
      },
    }
  } catch {
    return { kind: 'unavailable' }
  }
}

/** Remembers which token failed for which app, so the same token is not
 *  retried. A new token (sign in again, unlock) clears it implicitly. */
export class AuthFailureLatch {
  private readonly failed = new Map<string, string>()
  trip(appId: string, token: string): void { this.failed.set(appId, token) }
  isTripped(appId: string, token: string): boolean { return this.failed.get(appId) === token }
}

export interface PrivateCheckInput {
  appId: string
  name: string
  repo: string
  assetPattern: RegExp
  token: string | null
  scopes: readonly string[]
  latch: AuthFailureLatch
  fetchFn?: FetchFn
}

export async function resolvePrivateRelease(i: PrivateCheckInput): Promise<{ release: ReleaseInfo | null; notice?: string }> {
  // A read:user token is guaranteed a 404 here; don't ask, point at the unlock.
  if (!i.token || !i.scopes.includes('repo')) return { release: null, notice: unlockMessage(i.name) }
  if (i.latch.isTripped(i.appId, i.token)) return { release: null, notice: signInAgainMessage(i.name) }
  const r = await fetchPrivateRelease(i.repo, i.assetPattern, i.token, i.fetchFn)
  if (r.kind === 'auth') {
    i.latch.trip(i.appId, i.token)
    return { release: null, notice: signInAgainMessage(i.name) }
  }
  if (r.kind === 'ok') return { release: r.release }
  return { release: null }
}
```

`src/components/AppRow.tsx`:
- Add `notice` to the destructure on the first line of the component: `const { id, installedVersion, latestVersion, downloadUrl, status, downloadProgress, gearLeverMissing, isRunning, notice } = state`.
- In `statusText`, insert `if (notice) return notice` right after the `'launching'` line.
- In `statusClass`, change the first line to `if (status === 'error' || notice) return 'ax-ink-danger'`.

`electron/ipc-handlers.ts`:
- Type import on line 5: add `ReleaseInfo`, giving `import type { AppId, InstallableAppId, AppState, ArcdpsState, ReleaseInfo } from './shared/types'`.
- New import: `import { resolvePrivateRelease, AuthFailureLatch } from './privateRelease'`.
- Module state, after `pendingScopes`:

```ts
// No retry after a private 401/404 until the token changes (privateRelease.ts).
const privateAuthLatch = new AuthFailureLatch()
// Asset file names for downloads whose url (the asset API url) carries none.
const assetNames: Partial<Record<InstallableAppId, string>> = {}
```

- In `runCheckUpdates`, replace the `const release = await fetchLatestRelease(meta.repo, pattern, { includePrerelease: allowPrereleaseApps, })` statement with:

```ts
    let release: ReleaseInfo | null
    let notice: string | undefined
    if (meta.private) {
      const checked = await resolvePrivateRelease({
        appId, name: meta.name, repo: meta.repo, assetPattern: pattern,
        token: githubToken, scopes: githubScopes, latch: privateAuthLatch,
      })
      release = checked.release
      notice = checked.notice
    } else {
      release = await fetchLatestRelease(meta.repo, pattern, { includePrerelease: allowPrereleaseApps })
    }
    if (release?.assetName) assetNames[appId as InstallableAppId] = release.assetName
```

- In the final `setState(win, appId, { status: 'idle', installedVersion, latestVersion: …, downloadUrl: … }, true)` of that loop, add `notice,` after `downloadUrl`.
- In `github:sign-out`, add `notice: undefined` to the hidden-app reset patch.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/privateRelease.test.ts src/__tests__/AppRow.test.tsx && npm run typecheck`
Expected: PASS, and typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add electron/privateRelease.ts electron/__tests__/privateRelease.test.ts electron/shared/types.ts electron/ipc-handlers.ts src/components/AppRow.tsx src/__tests__/AppRow.test.tsx
git commit -m "$(cat <<'EOF'
feat(apps): check private releases with the repo-scoped token

Private entries ask /releases/latest with the bearer and keep the asset
API url for download. 401/404 shows "Sign in again to update <app>" and
is not retried until the token changes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Private asset download through the API url

**Files:**
- Modify: `electron/installer.ts:9-43` (`downloadFile`), `:45-65` (`installWindows`), `:67-78` (`installLinux`), `:80-105` (`updateLinux`)
- Modify: `electron/ipc-handlers.ts` (`axiom:install`)
- Create: `electron/__tests__/installer.test.ts`

**Interfaces:**
- Consumes: `assetDownloadHeaders` (Task 2); `privateAuthLatch`, `assetNames` and `signInAgainMessage` (Task 6).
- Produces:
  - `class HttpStatusError extends Error { readonly status: number }`.
  - `interface DownloadOpts { headers?: Record<string, string>; filename?: string }`.
  - `assetFilename(downloadUrl: string, filename?: string): string`.
  - `downloadFile(url, dest, onProgress, headers?: Record<string, string>)`.
  - `installWindows(downloadUrl, onProgress, onInstalling?, opts?: DownloadOpts)`, `installLinux(downloadUrl, onProgress, opts?: DownloadOpts)`, `updateLinux(appName, appId, downloadUrl, onProgress, opts?: DownloadOpts)`.

- [ ] **Step 1: Write the failing tests**

Create `electron/__tests__/installer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
import { existsSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// A fake https.get: records each request and answers from a queue, so no test
// touches the network.
const h = vi.hoisted(() => ({
  calls: [] as { url: string; headers: Record<string, string> }[],
  replies: [] as { statusCode: number; headers?: Record<string, string>; body?: string }[],
}))

vi.mock('https', () => {
  const get = (url: string, opts: { headers?: Record<string, string> }, cb: (res: unknown) => void) => {
    h.calls.push({ url, headers: { ...(opts?.headers ?? {}) } })
    const reply = h.replies.shift() ?? { statusCode: 500 }
    const res = Object.assign(new PassThrough(), { statusCode: reply.statusCode, headers: reply.headers ?? {} })
    const req = new EventEmitter()
    setImmediate(() => { cb(res); res.end(reply.body ?? '') })
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
    expect(existsSync(dest)).toBe(false)
  })
})

describe('assetFilename', () => {
  it('uses the url basename for a public download', () => {
    expect(assetFilename('https://github.com/darkharasho/axibridge/releases/download/v1.0.0/AxiBridge-1.0.0.AppImage')).toBe('AxiBridge-1.0.0.AppImage')
  })
  it('uses the asset name for an API url, which has none', () => {
    expect(assetFilename(ASSET_API, 'AxiAdmin-0.2.0.AppImage')).toBe('AxiAdmin-0.2.0.AppImage')
  })
  it('strips any directory part from the asset name', () => {
    expect(assetFilename(ASSET_API, '../../AxiAdmin-0.2.0.AppImage')).toBe('AxiAdmin-0.2.0.AppImage')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/installer.test.ts`
Expected: FAIL. `HttpStatusError` and `assetFilename` are not exported. The first test gets `headers: {}` on hop 0, because today's `get(url, cb)` puts the callback in the options position. The 307 and 308 redirects are not followed.

- [ ] **Step 3: Implement**

`electron/installer.ts`: replace `downloadFile` with:

```ts
export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Download failed: HTTP ${status}`)
  }
}

export interface DownloadOpts {
  /** Request headers for the first hop only; never forwarded across a redirect. */
  headers?: Record<string, string>
  /** On-disk file name; defaults to the url's last path segment. */
  filename?: string
}

/** File name to save a download under. A private asset's API url ends in a
 *  numeric id, so the release's asset name is passed in for it. */
export function assetFilename(downloadUrl: string, filename?: string): string {
  return path.basename(filename || new URL(downloadUrl).pathname)
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])

export function downloadFile(
  url: string,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
  headers?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    protocol.get(url, { headers: headers ?? {} }, (res) => {
      // Follow redirects WITHOUT the headers: a private asset's API url
      // redirects to a signed storage url on another host, and the bearer must
      // never leave api.github.com (tokenScope.ts).
      if (res.statusCode && REDIRECT_CODES.has(res.statusCode) && res.headers.location) {
        res.resume()
        const next = new URL(res.headers.location, url).toString()
        downloadFile(next, dest, onProgress).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new HttpStatusError(res.statusCode ?? 0))
        return
      }
      const total = parseInt(res.headers['content-length'] ?? '0', 10)
      let received = 0
      const file = fs.createWriteStream(dest)
      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        onProgress({
          percent: total ? Math.round((received / total) * 100) : 0,
          bytesReceived: received,
          totalBytes: total,
        })
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err) })
      res.on('error', reject)
    }).on('error', reject)
  })
}
```

Thread `DownloadOpts` through the three installers:
- `installWindows(downloadUrl, onProgress, onInstalling?, opts: DownloadOpts = {})`: set `const filename = assetFilename(downloadUrl, opts.filename)` and call `await downloadFile(downloadUrl, dest, onProgress, opts.headers)`.
- `installLinux(downloadUrl, onProgress, opts: DownloadOpts = {})`: same two changes.
- `updateLinux(appName, appId, downloadUrl, onProgress, opts: DownloadOpts = {})`: set `const newFilename = assetFilename(downloadUrl, opts.filename)` and call `await downloadFile(downloadUrl, newPath, onProgress, opts.headers)`.

`electron/ipc-handlers.ts`:
- The installer import gains `HttpStatusError` and `type DownloadOpts`.
- New imports: `import { assetDownloadHeaders } from './tokenScope'`, and add `signInAgainMessage` to the `./privateRelease` import.
- In `axiom:install`, right after `const isUpdate = !!appStates[appId].installedVersion`:

```ts
    // Private entries download through the asset API with the user's token;
    // public downloads stay anonymous (assetDownloadHeaders returns undefined).
    const headers = assetDownloadHeaders(downloadUrl, githubToken)
    if (meta.private && !headers) {
      setState(win, appId, { notice: signInAgainMessage(meta.name) })
      return
    }
    const dl: DownloadOpts = { headers, filename: assetNames[appId] }
```

- Pass `dl` as the last argument to `installWindows(…)`, `updateLinux(…)` and `installLinux(…)`.
- Replace the `catch (err)` body with:

```ts
      if (meta.private && err instanceof HttpStatusError && (err.status === 401 || err.status === 404)) {
        if (githubToken) privateAuthLatch.trip(appId, githubToken)
        setState(win, appId, { status: 'idle', downloadProgress: undefined, downloadUrl: null, notice: signInAgainMessage(meta.name) })
        return
      }
      setState(win, appId, { status: 'error', errorMessage: String(err) })
```

- [ ] **Step 4: Run the tests, typecheck and the full suite**

Run: `npx vitest run --maxWorkers=2 electron/__tests__/installer.test.ts && npm run typecheck && npx vitest run --maxWorkers=2`
Expected: all PASS, and typecheck exits 0. The full suite was 260 tests across 24 files before this plan, and every one of those must still pass.

- [ ] **Step 5: Verify that no public path carries the token**

Run: `grep -n "Authorization" electron/*.ts`
Expected: only `electron/githubAuth.ts` (the `/user` lookups, which go to `api.github.com/user` during sign-in, before any repo scope exists, unchanged), `electron/tokenScope.ts` and `electron/privateRelease.ts`. Nothing in `github.ts`, `installer.ts` or `arcdps.ts`.

- [ ] **Step 6: Commit**

```bash
git add electron/installer.ts electron/__tests__/installer.test.ts electron/ipc-handlers.ts
git commit -m "$(cat <<'EOF'
feat(install): download private assets via the asset API

The first hop carries the bearer and Accept: application/octet-stream;
every redirect (301/302/303/307/308) is followed with no headers, so the
token never reaches the storage host. 401/404 shows the re-sign-in
notice instead of an error.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

- **Spec coverage (§3):**
  - APP_META entry and `private?`: Task 1.
  - Hidden unless allowlisted: Task 1 (`visibleAppStates` and the install guard).
  - Sign-in stays `read:user`, with a one-time unlock that runs a `read:user repo` flow: Tasks 4 and 5.
  - The new token replaces the stored one, with `scopes`: Tasks 3 and 4.
  - Non-allowlisted users never see a `repo` request: `deviceFlowScope` in Task 4 and `canUnlockPrivate` in Task 5.
  - The `githubAuth.ts` comment is updated: Task 4.
  - Private `/releases/latest` with the bearer: Task 6.
  - Asset API `url` with octet-stream, following the redirect: Task 7.
  - The public path is unchanged and anonymous: Task 2.
  - 401/404 shows "Sign in again to update AxiAdmin" with no retry: Tasks 6 and 7.
  - Token containment in one pure function with tests: Task 2.
  - Glyph: Task 1.
- **Spec coverage (§6 axiom lines):**
  - Unlock only for allowlisted logins: Task 4 (`needsPrivateUnlock`, `deviceFlowScope`) and Task 5 (UI).
  - Bearer only to `api.github.com/repos/darkharasho/axiadmin/…`, never public or redirect: Task 2 table and Task 7 redirect tests.
  - 401/404 shows the re-sign-in message: Tasks 6 and 7.
  - An old record without scopes still loads: Task 3.
  - No test touches the network: injected `fetchFn`, mocked `https`, `vi.stubGlobal('fetch')`.
- **Placeholders:** none. Every code step shows its code. The `ipc-handlers.ts` edits are given as exact replacements, because that file has no unit harness. They are verified by typecheck, the full suite and Task 7 Step 5.
- **Type consistency:**
  - `bearerFor`, `assetDownloadHeaders`, `needsPrivateUnlock`, `deviceFlowScope`, `DeviceFlowMode`, `SCOPE_BASIC`, `SCOPE_PRIVATE` and `scopeList` are used identically across Tasks 2, 4, 6 and 7.
  - `resolvePrivateRelease`, `AuthFailureLatch` and `signInAgainMessage` are likewise consistent, as are `canUnlockPrivate`, `notice`, `assetName`, `DownloadOpts` and `HttpStatusError`.
  - `githubAuthBegin(mode)` takes `'sign-in' | 'unlock'` everywhere.
- **Review Focus:** all five lines have pinning tests in their owning tasks (2, 3/4, 6, 7, 6).
