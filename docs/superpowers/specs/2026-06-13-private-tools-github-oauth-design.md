# Identity-Gated Private Tools (GitHub OAuth) — Design

> **Status:** Approved design, ready for implementation planning.
> **Date:** 2026-06-13

## Goal

Track a private installable app (`axivale`) in AxiOM that is **shipped in the code but hidden** from normal users. Visibility is gated on the authenticated GitHub identity: only an allowlisted GitHub login sees and tracks `private` registry entries. The OAuth token is also attached to all GitHub release fetches, raising the API rate limit from 60/hr (unauthenticated) to 5,000/hr (authenticated).

This is the first use of a general mechanism: any future installable app marked `private: true` is gated by the same allowlist.

## Background

AxiOM today has **no** GitHub authentication — `electron/github.ts#fetchLatestRelease` calls the GitHub API unauthenticated. Installable apps are a hardcoded registry in `electron/apps.ts` (`APP_META`), rendered in order by `src/components/AppList.tsx` (`APP_ORDER`), with update detection orchestrated by `electron/ipc-handlers.ts#runCheckUpdates`. Config persists as plaintext JSON at `~/.config/AxiOM/config.json` via `electron/config.ts`.

The sibling app `axivale` (`/var/home/mstephens/Documents/GitHub/axivale`) already implements the GitHub **device flow** we mirror here:
- `src/main/githubAuth.ts` — device flow (`beginDeviceAuth`, `pollForToken`, `fetchGithubLogin`), client ID `Ov23liFh1ih9LAcnLACw` (env-overridable via `GITHUB_DEVICE_CLIENT_ID`).
- `src/main/secrets.ts` — `safeStorage`-encrypted secret store.
- axivale itself has **no** allowlist (it is open-access); the allowlist is net-new for AxiOM.

The `darkharasho/axivale` GitHub repo is **public**, so reading its releases needs no `repo` scope — `read:user` (to resolve the login) is sufficient, and the token alone lifts the rate limit. The gate is purely **visibility**, which matches the "ship the code but hide it" goal.

## Design

### New: `electron/githubAuth.ts`
Lifted/adapted from axivale's `src/main/githubAuth.ts`.
- `beginDeviceAuth(clientId)` → `{ userCode, verificationUri, deviceCode, interval, expiresIn }`
  (POST `https://github.com/login/device/code`).
- `pollForToken(clientId, deviceCode, { intervalSeconds, expiresInSeconds })` → access token
  (POST `https://github.com/login/oauth/access_token`; continue on `authorization_pending`, back off `+5s` on `slow_down`, fail on expiry).
- `fetchGithubLogin(token)` → `login` (GET `https://api.github.com/user`).
- `GITHUB_DEVICE_CLIENT_ID = process.env.GITHUB_DEVICE_CLIENT_ID || 'Ov23liFh1ih9LAcnLACw'`
- `SCOPE = 'read:user'` (narrower than axivale's `repo read:user` — AxiOM only needs identity).

### New: `electron/secrets.ts`
`safeStorage`-backed encrypted store for a **single** GitHub identity `{ token, login }` (AxiOM needs one identity, not axivale's multi-account keyring). Stored under the AxiOM user-data dir, separate from `config.json`. The plaintext token never touches `config.json`. Exposes `loadIdentity()`, `saveIdentity({token, login})`, `clearIdentity()`.

### New: `electron/privateTools.ts`
```ts
export const PRIVATE_TOOL_ALLOWLIST = ['darkharasho']
export function isPrivateUnlocked(login: string | null): boolean {
  return login != null && PRIVATE_TOOL_ALLOWLIST.includes(login)
}
```
Single source of truth for who may see private tools.

### Modified: `electron/apps.ts`
- Add `private?: boolean` to the app meta type.
- Add the `axivale` entry:
```ts
axivale: {
  id: 'axivale', name: 'AxiVale', repo: 'darkharasho/axivale', configDir: 'axivale',
  private: true,
  assetPattern: { win: /AxiVale.*Setup.*\.exe$/i, linux: /AxiVale.*\.AppImage$/i },
}
```
(Verified against real release asset names: `AxiVale Setup 0.3.1.exe`, `AxiVale-0.3.1.AppImage`.)

### Modified: `electron/github.ts`
`fetchLatestRelease(repo, assetPattern, token?)` — when `token` is present, add `Authorization: Bearer ${token}` to the request headers. Behavior unchanged when absent.

### Modified: `electron/ipc-handlers.ts`
- New IPC handlers: `github:auth-begin`, `github:auth-complete`, `github:status`, `github:sign-out`.
  - `auth-begin` opens the browser (`shell.openExternal`) to the verification URI and returns the device code payload.
  - `auth-complete` polls, resolves login, persists via `secrets.ts`, returns `{ ok, login }`.
  - `status` returns `{ signedIn, login, unlocked }`.
  - `sign-out` clears the stored identity.
- On startup: load identity → resolve `login` → compute `unlocked = isPrivateUnlocked(login)`.
- `runCheckUpdates`: pass the stored token to every `fetchLatestRelease`; **skip apps with `private: true` unless `unlocked`** (a locked user never pings the axivale repo).
- `hasAnyUpdates()`: count `private` apps only when `unlocked`.

### Modified: `electron/preload.ts` + `src/axiom.d.ts`
Expose `githubAuthBegin()`, `githubAuthComplete(deviceCode, interval, expiresIn)`, `githubStatus()`, `githubSignOut()`.

### Modified: `src/components/SettingsView.tsx`
Sign-in lives **here** (not the main list). A "Sign in with GitHub" button that:
- calls `githubAuthBegin()`, displays the user code, opens the browser,
- calls `githubAuthComplete(...)`, then shows "signed in · `<login>`",
- offers sign-out.
Mirrors axivale's `Settings.tsx#signInGithub` flow.

### Modified: `src/components/AppList.tsx`
`APP_ORDER` includes `axivale` only when `unlocked` (read from `github:status`). axivale renders through the **existing** `AppRow` / update / install pipeline — no new row component.

## Data Flow

1. User opens Settings → "Sign in with GitHub".
2. Device code shown; browser opens to `github.com/login/device`.
3. App polls until authorized → receives token.
4. `fetchGithubLogin` → `login`; `{token, login}` saved encrypted via `secrets.ts`.
5. `unlocked = isPrivateUnlocked(login)`.
6. Renderer reads `github:status`; if `unlocked`, `axivale` joins `APP_ORDER`.
7. `runCheckUpdates` fetches axivale's latest release **with the bearer token**; existing install/update path handles it.
8. Signed-out or non-allowlisted users: identical to today's behavior — no private apps, unauthenticated fetches.

## Testing (vitest, mirroring `electron/__tests__`)

- **`githubAuth`** — mock fetch: device-code request; `authorization_pending` then success; `slow_down` backoff; expiry failure.
- **`privateTools`** — `isPrivateUnlocked`: allowlisted login → true; other login → false; `null` → false.
- **`apps`** — `axivale` entry shape; asset patterns match real release names (`AxiVale Setup 0.3.1.exe`, `AxiVale-0.3.1.AppImage`).
- **`github`** — bearer header present when token supplied, absent when not.
- **gating** — locked user's `runCheckUpdates` never fetches `private` repos; `hasAnyUpdates` ignores locked private apps.

## Out of Scope (YAGNI)

- Multi-account keyring (single identity only).
- `repo` scope / private-repo release reads (axivale repo is public).
- A user-facing "show experimental tools" toggle.
- Any UI for editing the allowlist (code-defined only).
