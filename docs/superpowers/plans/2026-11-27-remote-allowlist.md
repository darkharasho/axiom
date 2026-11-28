# Remote allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Testers for gated AxiOM apps are added/removed in AxiAdmin as hashed GitHub ids in an axi-config flag, with no AxiOM release per tester.

**Architecture:** AxiOM reads flag `allowlist.<appId>` (app `axiom`) from the axi-config client it already runs for the ban check, hashes the signed-in user's numeric GitHub id once, and ORs that into app visibility. AxiAdmin gets a Testers section that resolves a login to an id (existing lookup), hashes it, and rewrites the flag through the existing admin flags API.

**Tech Stack:** Electron + TypeScript, vitest, `@axiapps/axi-config` (`hashIdentity`, `AxiConfig.flag/onChange`), React (AxiAdmin renderer).

**Spec:** `docs/superpowers/specs/2026-11-27-remote-allowlist-design.md` (axiom repo)

## Global Constraints

- Flag: app `axiom`, key `allowlist.<appId>` (e.g. `allowlist.axidps`); value = array of `hashIdentity('github_user', String(numericId))` hex strings.
- A valid entry is exactly `/^[0-9a-f]{64}$/`; anything else in the value is ignored; a non-array value counts as `[]`.
- The remote list never makes a `private: true` app visible and never affects `isPrivateUnlocked`/`isPrivateEligible`/repo scope.
- The code `allowlist` stays and still grants visibility (offline floor).
- Tester logins never go into the flag, logs, or anything sent off the machine; AxiAdmin's hash→login map lives only in its userData.
- vitest at most 2 workers (`npx vitest run --maxWorkers=2 <files>`).
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No real name anywhere.

## Review Focus

1. Signed out / id unknown → no remote visibility; signing in later makes a listed app appear without restart.
2. Flag missing, a string, an object, or holding uppercase/short hex → treated as no entries, no throw.
3. Config changes while running (tester removed) → the app disappears from the list on the next push.
4. A `private: true` app's id listed remotely → still hidden.
5. AxiAdmin: adding a login already present → no duplicate; removing the last tester → flag unset, not `[]`.

---

### Task 1 (axiom): remote allowlist module and visibility rule

**Files:**
- Create: `electron/remoteAllowlist.ts`, `electron/__tests__/remoteAllowlist.test.ts`
- Modify: `electron/apps.ts` (`isAppVisible`, `visibleAppStates`), `electron/__tests__/apps.test.ts`

**Interfaces:**
- Produces:
  - `parseHashList(v: unknown): string[]`
  - `interface RemoteAllowlist { setGithubId(id: number | null): Promise<void>; allows(appId: AppId): boolean; onChange(fn: () => void): () => void }`
  - `createRemoteAllowlist(config: Pick<AxiConfig, 'flag' | 'onChange'>, hash?: (id: number) => Promise<string>): RemoteAllowlist` — default `hash` = `id => hashIdentity('github_user', String(id))`; `onChange` listeners fire after `setGithubId` resolves and on every config change.
  - `isAppVisible(meta: AppMeta, login: string | null, remoteAllows = false): boolean`
  - `visibleAppStates(states, login, remoteAllows: (id: AppId) => boolean = () => false)`

- [ ] **Step 1: failing tests** in `remoteAllowlist.test.ts` with a fake config (`flag(key, fb)` reading a map, `onChange` storing listeners) and a fake `hash` (`id => Promise.resolve('a'.repeat(63) + String(id % 10))`):
  - `parseHashList`: `['a'.repeat(64), 'A'.repeat(64), 'abc', 5]` → `['a'.repeat(64)]`; `'x'` → `[]`; `{}` → `[]`; `undefined` → `[]`.
  - `allows('axidps')` is false before `setGithubId`; after `setGithubId(1)` with the flag holding the hash for 1 → true; after `setGithubId(null)` → false.
  - flag changed in the fake + its listeners fired → `allows` reflects the new list and `onChange` subscribers were called.
  - In `apps.test.ts`: `isAppVisible(APP_META.axidps, 'someone', true)` → true; `isAppVisible(APP_META.axidps, 'someone')` → false; `isAppVisible(APP_META.axiadmin, 'someone', true)` → false (private); existing tests unchanged.
- [ ] **Step 2:** `npx vitest run --maxWorkers=2 electron/__tests__/remoteAllowlist.test.ts electron/__tests__/apps.test.ts` → FAIL (module missing / new assertions).
- [ ] **Step 3:** implement. `allows` reads `config.flag('allowlist.' + appId, [])` through `parseHashList` on each call (cheap; no cache to go stale). `isAppVisible`: no allowlist → true; login listed → true; else `meta.private !== true && remoteAllows`.
- [ ] **Step 4:** same command → PASS; then `npx vitest run --maxWorkers=2` → all pass.
- [ ] **Step 5:** commit `Gated apps: a remote allowlist of hashed GitHub ids`.

### Task 2 (axiom): wire it into the main process

**Files:**
- Modify: `electron/ipc-handlers.ts` (the 4 `isAppVisible` calls, `pushStates`, `get-states`, `applyIdentity`), `electron/main.ts` (after `startAccess`)
- Test: `electron/__tests__/ipc-handlers*.test.ts` if one covers `pushStates`/`get-states`; otherwise add `electron/__tests__/remoteAllowlistWiring.test.ts`

**Interfaces:**
- Consumes: Task 1's `RemoteAllowlist`, `isAppVisible(meta, login, remoteAllows)`, `visibleAppStates(states, login, remoteAllows)`.
- Produces: `export function setRemoteAllowlist(r: RemoteAllowlist | null, win: BrowserWindow): void` in `ipc-handlers.ts`.

- [ ] **Step 1: failing test:** with a stub `RemoteAllowlist` whose `allows('axidps')` is true, after `setRemoteAllowlist(stub, win)` the `axiom:get-states` handler (or `pushStates` via the stub's `onChange`) includes `axidps` for a login not on the code list; with `allows` false it does not; firing the stub's `onChange` sends `axiom:states-updated`.
- [ ] **Step 2:** run it → FAIL.
- [ ] **Step 3:** implement. One private helper `visible(meta)` = `isAppVisible(meta, githubLogin, remote?.allows(meta.id) ?? false)` used by every call site. `setRemoteAllowlist` stores `r`, subscribes `r.onChange` → `pushStates(win)` and, when an app became visible that has `latestVersion === null`, `void runCheckUpdates(win)`. `applyIdentity` calls `void remote?.setGithubId(id)`. In `main.ts`, when `access` is not blocked: `setRemoteAllowlist(createRemoteAllowlist(access.config), win)` then `void ...setGithubId(getGithubId())` — after `registerIpcHandlers`.
- [ ] **Step 4:** test → PASS; `npx vitest run --maxWorkers=2` and `npm run typecheck` (if present) → clean.
- [ ] **Step 5:** commit `Gated apps follow the remote allowlist while running`.

### Task 3 (axiadmin): Testers section

**Files:**
- Create: `shared/testers.ts`, `electron/testers.ts`, `electron/testers.test.ts`, `src/panels/flags/TestersSection.tsx`, `src/panels/flags/TestersSection.test.tsx`
- Modify: `shared/channels.ts`, `shared/types.ts` (bridge type), `electron/ipc.ts`, `electron/preload.ts`, `electron/main.ts` (names file path), `src/panels/flags/FlagsPanel.tsx` (render the section above the table)

**Interfaces:**
- Produces (`shared/testers.ts`): `TESTER_APPS: readonly {id: string; name: string}[] = [{id: 'axidps', name: 'AxiDPS'}]`; `testerFlagKey(appId) => 'allowlist.' + appId`; `TESTER_FLAG_APP = 'axiom'`; `parseHashList` (same rule as Task 1).
- Produces (`electron/testers.ts`): `createTesters(d: {api: Pick<AdminApi,'listFlags'|'setFlag'|'unsetFlag'>; lookup: (kind, v) => Promise<LookupResult>; namesFile: string; hash?: (id: string) => Promise<string>})` → `{list(appId): Promise<ApiResult<{hash: string; login: string | null}[]>>; add(appId, login): Promise<{ok: true; display: string} | {ok: false; reason: string}>; remove(appId, hash): Promise<{ok: boolean; reason?: string}>}`. Unknown `appId` (not in `TESTER_APPS`) → `{ok: false}`.
- Channels: `testersList: 'testers:list'`, `testersAdd: 'testers:add'`, `testersRemove: 'testers:remove'`; bridge `testers.{list, add, remove}`.

- [ ] **Step 1: failing tests** (`testers.test.ts`, fake api/lookup/hash, temp names file):
  - `add('axidps', 'Revan-Malice')` with lookup → `{ok, value: '42'}` calls `setFlag('axiom', 'allowlist.axidps', [h42])` and the names file maps `h42 → 'Revan-Malice'`.
  - adding the same login again → `setFlag` value still has one `h42`.
  - `remove('axidps', h42)` when it is the only entry → `unsetFlag('axiom', 'allowlist.axidps')`; with two entries → `setFlag` with the other.
  - `list` returns names for known hashes and `login: null` for unknown; malformed entries in the flag are dropped.
  - lookup failure → `add` returns `{ok: false, reason}` and no `setFlag`.
  - `TestersSection.test.tsx`: shows rows (login, or first 8 hex chars + `…` when unknown), Add calls `testers.add` and reloads, Remove asks via `ConfirmDialog` then calls `testers.remove`.
- [ ] **Step 2:** `npx vitest run --maxWorkers=2 electron/testers.test.ts src/panels/flags/TestersSection.test.tsx` → FAIL.
- [ ] **Step 3:** implement. `hash` default = `id => hashIdentity('github_user', id)` from `@axiapps/axi-config/identity`. Read-modify-write: `listFlags` → find `{app:'axiom', key}` → `parseHashList` → write. Names file: plain JSON `{[hash]: login}` at `join(userData, 'testers.json')`, written after a successful `setFlag`. IPC handlers validate `appId`/`login`/`hash` are strings (reuse `isText`).
- [ ] **Step 4:** tests → PASS; `npm test` and `npm run typecheck` → clean.
- [ ] **Step 5:** commit `Flags: a Testers section for gated AxiOM apps`.

### Task 4: seed and release (owner confirms first)

- [ ] Seed `allowlist.axidps` with the current non-owner testers (`skavok`, `gw2dui`, `Revan-Malice`) through the new Testers section or the API, so removing them from code later is possible. Code list stays as is this round.
- [ ] Ask the owner before cutting the AxiOM release (notes: "Early-testing access can now change without an update." — no app names) and an AxiAdmin release; show the CI watcher cards.
