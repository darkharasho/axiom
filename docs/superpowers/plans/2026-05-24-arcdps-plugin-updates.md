# arcdps + Plugin Update Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new top-level view in AxiOM that detects, surfaces, and one-click installs updates for arcdps (the GW2 DPS meter DLL) and a curated set of arcdps plugins.

**Architecture:** A new Electron-side module (`electron/arcdps.ts`) owns the curated plugin registry, GW2 path resolution, DLL detection, version comparison (MD5 for arcdps core via deltaconnected.com, GitHub release lookup for plugins via existing `electron/github.ts`), and atomic install-with-backup. New IPC channels expose state and actions to the renderer. A new React view (`src/components/ArcdpsView.tsx`) with a hook (`src/hooks/useArcdpsState.ts`) mirrors the existing `AppList` pattern.

**Tech Stack:** Electron + TypeScript + React, Vitest, existing helpers in `electron/installer.ts` (`downloadFile`), `electron/github.ts` (`fetchLatestRelease`), `electron/process-check.ts` (`isProcessRunning`), `electron/config.ts` (persistent JSON).

**Spec:** `docs/superpowers/specs/2026-05-24-arcdps-plugin-updates-design.md`

## File Structure

**Create:**
- `electron/arcdps.ts` — registry, detection, version compare, install
- `electron/arcdpsRegistry.ts` — pure data (the 13 entries)
- `electron/__tests__/arcdps.test.ts` — unit tests
- `electron/__tests__/arcdpsRegistry.test.ts` — DLL pattern matching tests
- `src/hooks/useArcdpsState.ts` — React hook
- `src/components/ArcdpsView.tsx` — the view
- `src/components/ArcdpsRow.tsx` — single-plugin row

**Modify:**
- `electron/shared/types.ts` — add `ArcdpsPluginState`, `ArcdpsState`, extend `Config`
- `electron/ipc-handlers.ts` — register `arcdps:*` channels, OR arcdps updates into `hasAnyUpdates()`
- `electron/preload.ts` — expose `arcdps*` methods
- `src/axiom.d.ts` — type the new bridge methods
- `src/App.tsx` — add `'arcdps'` view
- `src/components/AppList.tsx` — add entry button to the new view

---

### Task 1: Define the plugin registry data type and the 13 entries

**Files:**
- Create: `electron/arcdpsRegistry.ts`
- Create: `electron/__tests__/arcdpsRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// electron/__tests__/arcdpsRegistry.test.ts
import { describe, it, expect } from 'vitest'
import { ARCDPS_REGISTRY, getPluginMeta } from '../arcdpsRegistry'

describe('ARCDPS_REGISTRY', () => {
  it('contains arcdps and arcdps_axipulse as always-shown', () => {
    const arc = getPluginMeta('arcdps')
    const axip = getPluginMeta('arcdps_axipulse')
    expect(arc?.alwaysShow).toBe(true)
    expect(axip?.alwaysShow).toBe(true)
  })

  it('marks all other registered plugins as detect-only', () => {
    const detectOnly = ARCDPS_REGISTRY.filter(p => !p.alwaysShow)
    expect(detectOnly.length).toBeGreaterThan(0)
    for (const p of detectOnly) expect(p.alwaysShow).toBe(false)
  })

  it('arcdps source is deltaconnected, all others are github', () => {
    const arc = getPluginMeta('arcdps')!
    expect(arc.source.kind).toBe('deltaconnected')
    for (const p of ARCDPS_REGISTRY) {
      if (p.id !== 'arcdps') expect(p.source.kind).toBe('github')
    }
  })

  it('unofficial_extras installs into the extensions subfolder', () => {
    const ue = getPluginMeta('unofficial_extras')
    expect(ue?.installDir).toBe('bin64/arcdps/extensions')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run electron/__tests__/arcdpsRegistry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

```ts
// electron/arcdpsRegistry.ts
export type ArcSource =
  | { kind: 'deltaconnected' }
  | { kind: 'github'; repo: string }

export type InstallDir = 'bin64' | 'bin64/arcdps/extensions'

export interface ArcPluginMeta {
  id: string
  name: string
  source: ArcSource
  dllPattern: RegExp
  installDir: InstallDir
  assetPattern?: RegExp
  alwaysShow: boolean
}

export const ARCDPS_REGISTRY: ArcPluginMeta[] = [
  {
    id: 'arcdps',
    name: 'arcdps',
    source: { kind: 'deltaconnected' },
    dllPattern: /^d3d11\.dll$/i,
    installDir: 'bin64',
    alwaysShow: true,
  },
  {
    id: 'arcdps_axipulse',
    name: 'AxiPulse (arcdps plugin)',
    source: { kind: 'github', repo: 'darkharasho/arcdps_axipulse' },
    dllPattern: /^arcdps_axipulse\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_axipulse\.dll$/i,
    alwaysShow: true,
  },
  {
    id: 'squad_roles',
    name: 'Squad Roles',
    source: { kind: 'github', repo: 'xvwyh/SquadRoles' },
    dllPattern: /^arcdps_squad_roles\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_squad_roles\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'squad_ready',
    name: 'Squad Ready',
    source: { kind: 'github', repo: 'cheahjs/arcdps-squad-ready-plugin' },
    dllPattern: /^arcdps_squad_ready\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_squad_ready\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'player_list',
    name: 'Player List',
    source: { kind: 'github', repo: 'Calcoph/gw2-player-list' },
    dllPattern: /^arcdps_player_list\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_player_list\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'mechanics_log',
    name: 'Mechanics Log',
    source: { kind: 'github', repo: 'knoxfighter/GW2-ArcDPS-Mechanics-Log' },
    dllPattern: /^arcdps_mechanics?.*\.dll$/i,
    installDir: 'bin64',
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'killproof_me',
    name: 'Killproof.me',
    source: { kind: 'github', repo: 'knoxfighter/arcdps-killproof.me-plugin' },
    dllPattern: /^arcdps_killproof_me\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_killproof_me\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'food_reminder',
    name: 'Food Reminder',
    source: { kind: 'github', repo: 'Zerthox/arcdps-food-reminder' },
    dllPattern: /^arcdps_food[_-]reminder\.dll$/i,
    installDir: 'bin64',
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'arc_clears',
    name: 'arcdps Clears',
    source: { kind: 'github', repo: 'gw2scratch/arcdps-clears' },
    dllPattern: /^arcdps_clears\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_clears\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'chat_log',
    name: 'Chat Log',
    source: { kind: 'github', repo: 'cheahjs/arcdps-chat-log' },
    dllPattern: /^arcdps_chat_log\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_chat_log\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'gw2_buddy',
    name: 'GW2 Buddy',
    source: { kind: 'github', repo: 'Zerthox/gw2-buddy' },
    dllPattern: /^arcdps_buddy\.dll$/i,
    installDir: 'bin64',
    assetPattern: /\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'boon_table',
    name: 'Boon Table',
    source: { kind: 'github', repo: 'knoxfighter/GW2-ArcDPS-Boon-Table' },
    dllPattern: /^arcdps_boon_table\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_boon_table\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'bhud',
    name: 'Blish HUD bridge',
    source: { kind: 'github', repo: 'blish-hud/arcdps-bhud' },
    dllPattern: /^arcdps_bhud\.dll$/i,
    installDir: 'bin64',
    assetPattern: /^arcdps_bhud\.dll$/i,
    alwaysShow: false,
  },
  {
    id: 'unofficial_extras',
    name: 'Unofficial Extras',
    source: { kind: 'github', repo: 'Krappa322/arcdps_unofficial_extras_releases' },
    dllPattern: /^extras\.dll$/i,
    installDir: 'bin64/arcdps/extensions',
    assetPattern: /^extras\.dll$/i,
    alwaysShow: false,
  },
]

export function getPluginMeta(id: string): ArcPluginMeta | undefined {
  return ARCDPS_REGISTRY.find(p => p.id === id)
}
```

> **Note for implementer:** Each plugin's actual release asset name and DLL filename must be verified against the upstream repo's latest release. If a repo ships a zip rather than a bare DLL, this plan does not handle that — flag during implementation and update the spec's open-risks section. If the DLL filename in a real install differs from the regex here, fix the regex (one source of truth).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run electron/__tests__/arcdpsRegistry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/arcdpsRegistry.ts electron/__tests__/arcdpsRegistry.test.ts
git commit -m "feat(arcdps): plugin registry data + types"
```

---

### Task 2: Add arcdps state types to shared types

**Files:**
- Modify: `electron/shared/types.ts`

- [ ] **Step 1: Add the types**

Append to `electron/shared/types.ts`:

```ts
export type ArcdpsPluginStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'error'

export interface ArcdpsPluginState {
  id: string                          // matches ArcPluginMeta.id
  name: string
  alwaysShow: boolean
  installed: boolean
  installedTag: string | null         // recorded by AxiOM on install; null if unknown/manual
  installedAt: string | null          // ISO timestamp from AxiOM install
  latestTag: string | null            // 'latest' arcdps for the core; semver tag for github
  downloadUrl: string | null
  upToDate: boolean | null            // null = unknown
  status: ArcdpsPluginStatus
  errorMessage?: string
  downloadProgress?: DownloadProgress
}

export interface ArcdpsState {
  gw2Path: string | null
  gw2PathSource: 'axiam' | 'auto' | 'manual' | 'none'
  plugins: ArcdpsPluginState[]
}

export interface ConfigArcdps {
  gw2PathOverride: string | null
  plugins: Record<string, { installedTag: string | null; installedAt: string | null }>
}
```

Update the `Config` interface and `DEFAULT_CONFIG`:

```ts
export interface Config {
  autoStart: boolean
  notifyOnUpdates: boolean
  trayBadge: boolean
  apps: Record<InstallableAppId, ConfigApp>
  arcdps: ConfigArcdps
}

export const DEFAULT_CONFIG: Config = {
  autoStart: false,
  notifyOnUpdates: false,
  trayBadge: true,
  apps: {
    axibridge: { installedVersion: null, lastChecked: null },
    axiforge:  { installedVersion: null, lastChecked: null },
    axipulse:  { installedVersion: null, lastChecked: null },
    axiam:     { installedVersion: null, lastChecked: null },
  },
  arcdps: {
    gw2PathOverride: null,
    plugins: {},
  },
}
```

- [ ] **Step 2: Update config merge to handle the new field**

Modify `electron/config.ts` `readConfig`:

```ts
export function readConfig(): Config {
  const p = configPath()
  if (!fs.existsSync(p)) return structuredClone(DEFAULT_CONFIG)
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      apps: { ...DEFAULT_CONFIG.apps, ...raw.apps },
      arcdps: {
        ...DEFAULT_CONFIG.arcdps,
        ...(raw.arcdps ?? {}),
        plugins: { ...DEFAULT_CONFIG.arcdps.plugins, ...(raw.arcdps?.plugins ?? {}) },
      },
    }
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}
```

- [ ] **Step 3: Verify the existing config test still passes**

Run: `npx vitest run electron/__tests__/config.test.ts`
Expected: PASS. If a test asserts the exact shape of `DEFAULT_CONFIG` and now fails because of the added `arcdps` key, update that assertion to include the new field.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors related to the new fields).

- [ ] **Step 5: Commit**

```bash
git add electron/shared/types.ts electron/config.ts electron/__tests__/config.test.ts
git commit -m "feat(arcdps): shared types + config schema for arcdps state"
```

---

### Task 3: GW2 path resolution (AxiAM config + auto-detect + manual override)

**Files:**
- Create: `electron/arcdps.ts` (new — start with just `getGw2Path`)
- Create: `electron/__tests__/arcdps.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// electron/__tests__/arcdps.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/axiom-test-userdata' } }))

import { resolveGw2Path } from '../arcdps'

describe('resolveGw2Path', () => {
  const tmpRoot = path.join(os.tmpdir(), `axiom-arcdps-${Date.now()}`)
  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    fs.mkdirSync(tmpRoot, { recursive: true })
  })

  it('returns manual override when configured', () => {
    const gw2 = path.join(tmpRoot, 'GW2Manual')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const result = resolveGw2Path({ override: gw2, axiamConfigPath: '/nonexistent', candidates: [] })
    expect(result).toEqual({ path: gw2, source: 'manual' })
  })

  it('falls back to AxiAM config when no override', () => {
    const gw2 = path.join(tmpRoot, 'GW2Axiam')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const axiamCfg = path.join(tmpRoot, 'axiam.json')
    fs.writeFileSync(axiamCfg, JSON.stringify({ gw2Path: gw2 }))
    const result = resolveGw2Path({ override: null, axiamConfigPath: axiamCfg, candidates: [] })
    expect(result).toEqual({ path: gw2, source: 'axiam' })
  })

  it('falls back to candidates when AxiAM config missing', () => {
    const gw2 = path.join(tmpRoot, 'GW2Auto')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const result = resolveGw2Path({ override: null, axiamConfigPath: '/nonexistent', candidates: [gw2] })
    expect(result).toEqual({ path: gw2, source: 'auto' })
  })

  it('returns none when nothing resolves', () => {
    const result = resolveGw2Path({ override: null, axiamConfigPath: '/nonexistent', candidates: [] })
    expect(result).toEqual({ path: null, source: 'none' })
  })

  it('ignores AxiAM path that does not contain bin64/Gw2-64.exe', () => {
    const bogus = path.join(tmpRoot, 'NotGW2')
    fs.mkdirSync(bogus, { recursive: true })
    const axiamCfg = path.join(tmpRoot, 'axiam.json')
    fs.writeFileSync(axiamCfg, JSON.stringify({ gw2Path: bogus }))
    const result = resolveGw2Path({ override: null, axiamConfigPath: axiamCfg, candidates: [] })
    expect(result).toEqual({ path: null, source: 'none' })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// electron/arcdps.ts
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { ArcdpsState } from './shared/types'

type Gw2Source = ArcdpsState['gw2PathSource']

export interface ResolveGw2Opts {
  override: string | null
  axiamConfigPath: string
  candidates: string[]
}

function looksLikeGw2(dir: string): boolean {
  try {
    return (
      fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, 'bin64', 'Gw2-64.exe'))
    )
  } catch {
    return false
  }
}

function readAxiamGw2Path(cfgPath: string): string | null {
  try {
    const raw = fs.readFileSync(cfgPath, 'utf-8')
    const parsed = JSON.parse(raw) as { gw2Path?: unknown }
    return typeof parsed.gw2Path === 'string' ? parsed.gw2Path : null
  } catch {
    return null
  }
}

export function resolveGw2Path(opts: ResolveGw2Opts): { path: string | null; source: Gw2Source } {
  if (opts.override && looksLikeGw2(opts.override)) {
    return { path: opts.override, source: 'manual' }
  }
  const fromAxiam = readAxiamGw2Path(opts.axiamConfigPath)
  if (fromAxiam && looksLikeGw2(fromAxiam)) {
    return { path: fromAxiam, source: 'axiam' }
  }
  for (const c of opts.candidates) {
    if (looksLikeGw2(c)) return { path: c, source: 'auto' }
  }
  return { path: null, source: 'none' }
}

export function defaultAxiamConfigPath(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'axiam', 'config.json')
  }
  return path.join(os.homedir(), '.config', 'axiam', 'config.json')
}

export function defaultGw2Candidates(): string[] {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Guild Wars 2',
      'C:\\Program Files (x86)\\Guild Wars 2',
      'C:\\Guild Wars 2',
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Guild Wars 2'),
    ]
  }
  const home = os.homedir()
  return [
    path.join(home, '.steam', 'steam', 'steamapps', 'common', 'Guild Wars 2'),
    path.join(home, '.local', 'share', 'Steam', 'steamapps', 'common', 'Guild Wars 2'),
    path.join(home, 'Games', 'guild-wars-2', 'drive_c', 'Program Files', 'Guild Wars 2'),
  ]
}
```

> **Note for implementer:** The AxiAM config key `gw2Path` is an assumption from the spec's open-risks list. Before integrating, open `darkharasho/axiam`'s source and confirm the actual key. If the key is different (e.g. `installPath`, `gameDir`), update `readAxiamGw2Path` accordingly. If AxiAM doesn't persist the path at all, this function still works — it just always falls through to candidates.

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add electron/arcdps.ts electron/__tests__/arcdps.test.ts
git commit -m "feat(arcdps): resolve GW2 install path (override, AxiAM, auto)"
```

---

### Task 4: Detect installed plugin DLLs in bin64

**Files:**
- Modify: `electron/arcdps.ts`
- Modify: `electron/__tests__/arcdps.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `electron/__tests__/arcdps.test.ts`:

```ts
import { detectInstalledPlugins } from '../arcdps'
import { ARCDPS_REGISTRY } from '../arcdpsRegistry'

describe('detectInstalledPlugins', () => {
  const tmpRoot = path.join(os.tmpdir(), `axiom-arcdps-detect-${Date.now()}`)
  const gw2 = path.join(tmpRoot, 'GW2')
  const bin64 = path.join(gw2, 'bin64')
  const ext = path.join(bin64, 'arcdps', 'extensions')

  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    fs.mkdirSync(ext, { recursive: true })
  })

  it('returns empty when no DLLs present', () => {
    expect(detectInstalledPlugins(gw2)).toEqual([])
  })

  it('detects arcdps core (d3d11.dll)', () => {
    fs.writeFileSync(path.join(bin64, 'd3d11.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('arcdps')
  })

  it('detects a github plugin in bin64', () => {
    fs.writeFileSync(path.join(bin64, 'arcdps_boon_table.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('boon_table')
  })

  it('detects unofficial_extras in extensions/', () => {
    fs.writeFileSync(path.join(ext, 'extras.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('unofficial_extras')
  })

  it('ignores arbitrary DLLs not in the registry', () => {
    fs.writeFileSync(path.join(bin64, 'random_other.dll'), 'fake')
    expect(detectInstalledPlugins(gw2)).toEqual([])
  })

  it('returns each meta only once even if both bin64 and extensions match', () => {
    fs.writeFileSync(path.join(bin64, 'd3d11.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const arcCount = found.filter(p => p.id === 'arcdps').length
    expect(arcCount).toBe(1)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: FAIL — `detectInstalledPlugins` not exported.

- [ ] **Step 3: Implement**

Append to `electron/arcdps.ts`:

```ts
import type { ArcPluginMeta, InstallDir } from './arcdpsRegistry'
import { ARCDPS_REGISTRY } from './arcdpsRegistry'

export interface DetectedPlugin {
  id: string
  meta: ArcPluginMeta
  dllPath: string
  sizeBytes: number
  mtime: Date
}

function safeReaddir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function resolveInstallDir(gw2: string, kind: InstallDir): string {
  return kind === 'bin64'
    ? path.join(gw2, 'bin64')
    : path.join(gw2, 'bin64', 'arcdps', 'extensions')
}

export function detectInstalledPlugins(gw2Path: string): DetectedPlugin[] {
  const out: DetectedPlugin[] = []
  const seen = new Set<string>()
  for (const meta of ARCDPS_REGISTRY) {
    const dir = resolveInstallDir(gw2Path, meta.installDir)
    for (const file of safeReaddir(dir)) {
      if (!meta.dllPattern.test(file)) continue
      if (seen.has(meta.id)) continue
      const full = path.join(dir, file)
      try {
        const st = fs.statSync(full)
        out.push({ id: meta.id, meta, dllPath: full, sizeBytes: st.size, mtime: st.mtime })
        seen.add(meta.id)
      } catch { /* ignore */ }
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: PASS (all detection tests).

- [ ] **Step 5: Commit**

```bash
git add electron/arcdps.ts electron/__tests__/arcdps.test.ts
git commit -m "feat(arcdps): detect installed plugin DLLs"
```

---

### Task 5: arcdps core update check (deltaconnected MD5)

**Files:**
- Modify: `electron/arcdps.ts`
- Modify: `electron/__tests__/arcdps.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `electron/__tests__/arcdps.test.ts`:

```ts
import { computeFileMd5, checkArcdpsCoreUpdate } from '../arcdps'

describe('computeFileMd5', () => {
  it('returns md5 hex of a file', () => {
    const f = path.join(os.tmpdir(), `md5-${Date.now()}.bin`)
    fs.writeFileSync(f, 'hello')
    expect(computeFileMd5(f)).toBe('5d41402abc4b2a76b9719d911017c592')
    fs.unlinkSync(f)
  })
})

describe('checkArcdpsCoreUpdate', () => {
  it('reports up-to-date when hashes match', async () => {
    const dll = path.join(os.tmpdir(), `arc-${Date.now()}.dll`)
    fs.writeFileSync(dll, 'hello')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '5d41402abc4b2a76b9719d911017c592 *d3d11.dll\n',
    } as any)
    const r = await checkArcdpsCoreUpdate(dll, fetchImpl)
    expect(r).toEqual({ upToDate: true, remoteMd5: '5d41402abc4b2a76b9719d911017c592' })
    fs.unlinkSync(dll)
  })

  it('reports update available when hashes differ', async () => {
    const dll = path.join(os.tmpdir(), `arc-${Date.now()}.dll`)
    fs.writeFileSync(dll, 'world')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '5d41402abc4b2a76b9719d911017c592 *d3d11.dll\n',
    } as any)
    const r = await checkArcdpsCoreUpdate(dll, fetchImpl)
    expect(r?.upToDate).toBe(false)
    fs.unlinkSync(dll)
  })

  it('returns null when fetch fails', async () => {
    const dll = path.join(os.tmpdir(), `arc-${Date.now()}.dll`)
    fs.writeFileSync(dll, 'hello')
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false } as any)
    expect(await checkArcdpsCoreUpdate(dll, fetchImpl)).toBeNull()
    fs.unlinkSync(dll)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: FAIL — symbols not exported.

- [ ] **Step 3: Implement**

Append to `electron/arcdps.ts`:

```ts
import crypto from 'crypto'

export const ARCDPS_CORE_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll'
export const ARCDPS_CORE_MD5_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum'

export function computeFileMd5(file: string): string {
  const hash = crypto.createHash('md5')
  hash.update(fs.readFileSync(file))
  return hash.digest('hex')
}

type FetchLike = (url: string) => Promise<{ ok: boolean; text(): Promise<string> }>

export async function checkArcdpsCoreUpdate(
  dllPath: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ upToDate: boolean; remoteMd5: string } | null> {
  try {
    const res = await fetchImpl(ARCDPS_CORE_MD5_URL)
    if (!res.ok) return null
    const body = await res.text()
    // md5sum format: "<hex>  filename" or "<hex> *filename"
    const remoteMd5 = body.trim().split(/\s+/)[0]?.toLowerCase()
    if (!remoteMd5 || !/^[a-f0-9]{32}$/.test(remoteMd5)) return null
    const local = computeFileMd5(dllPath).toLowerCase()
    return { upToDate: local === remoteMd5, remoteMd5 }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/arcdps.ts electron/__tests__/arcdps.test.ts
git commit -m "feat(arcdps): MD5-based core version check via deltaconnected"
```

---

### Task 6: Build full state assembly (combines detection + remote checks)

**Files:**
- Modify: `electron/arcdps.ts`
- Modify: `electron/__tests__/arcdps.test.ts`

- [ ] **Step 1: Add failing test**

Append to `electron/__tests__/arcdps.test.ts`:

```ts
import { buildArcdpsState } from '../arcdps'

describe('buildArcdpsState', () => {
  it('always shows arcdps and arcdps_axipulse even when not installed', async () => {
    const gw2 = path.join(os.tmpdir(), `arcdps-state-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: {},
      fetchRelease: async () => null,
      fetchCoreMd5: async () => null,
    })
    expect(state.plugins.find(p => p.id === 'arcdps')).toBeDefined()
    expect(state.plugins.find(p => p.id === 'arcdps_axipulse')).toBeDefined()
    expect(state.plugins.find(p => p.id === 'boon_table')).toBeUndefined()
  })

  it('shows a detect-only plugin when its DLL exists', async () => {
    const gw2 = path.join(os.tmpdir(), `arcdps-state2-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    fs.writeFileSync(path.join(gw2, 'bin64', 'arcdps_boon_table.dll'), 'fake')
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: { boon_table: { installedTag: 'v1.0', installedAt: '2026-01-01' } },
      fetchRelease: async () => ({ version: '1.1', downloadUrl: 'https://x/y.dll' }),
      fetchCoreMd5: async () => null,
    })
    const bt = state.plugins.find(p => p.id === 'boon_table')!
    expect(bt.installed).toBe(true)
    expect(bt.installedTag).toBe('v1.0')
    expect(bt.latestTag).toBe('1.1')
    expect(bt.upToDate).toBe(false)
  })

  it('returns empty plugins list when no gw2Path', async () => {
    const state = await buildArcdpsState({
      gw2Path: null,
      gw2PathSource: 'none',
      recordedInstalls: {},
      fetchRelease: async () => null,
      fetchCoreMd5: async () => null,
    })
    expect(state.plugins).toEqual([])
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: FAIL — `buildArcdpsState` undefined.

- [ ] **Step 3: Implement**

Append to `electron/arcdps.ts`:

```ts
import type { ArcdpsPluginState } from './shared/types'

export interface BuildStateOpts {
  gw2Path: string | null
  gw2PathSource: ArcdpsState['gw2PathSource']
  recordedInstalls: Record<string, { installedTag: string | null; installedAt: string | null }>
  fetchRelease: (repo: string, assetPattern: RegExp) => Promise<{ version: string; downloadUrl: string } | null>
  fetchCoreMd5: (dllPath: string) => Promise<{ upToDate: boolean; remoteMd5: string } | null>
}

export async function buildArcdpsState(opts: BuildStateOpts): Promise<ArcdpsState> {
  if (!opts.gw2Path) {
    return { gw2Path: null, gw2PathSource: opts.gw2PathSource, plugins: [] }
  }
  const detected = detectInstalledPlugins(opts.gw2Path)
  const detectedById = new Map(detected.map(d => [d.id, d]))

  const plugins: ArcdpsPluginState[] = []
  for (const meta of ARCDPS_REGISTRY) {
    const det = detectedById.get(meta.id)
    if (!meta.alwaysShow && !det) continue
    const recorded = opts.recordedInstalls[meta.id]
    const base: ArcdpsPluginState = {
      id: meta.id,
      name: meta.name,
      alwaysShow: meta.alwaysShow,
      installed: !!det,
      installedTag: recorded?.installedTag ?? null,
      installedAt: recorded?.installedAt ?? null,
      latestTag: null,
      downloadUrl: null,
      upToDate: null,
      status: 'idle',
    }

    if (meta.source.kind === 'deltaconnected' && det) {
      const r = await opts.fetchCoreMd5(det.dllPath)
      if (r) {
        base.latestTag = r.remoteMd5.slice(0, 7)
        base.downloadUrl = ARCDPS_CORE_URL
        base.upToDate = r.upToDate
      }
    } else if (meta.source.kind === 'deltaconnected' && !det) {
      base.downloadUrl = ARCDPS_CORE_URL
    } else if (meta.source.kind === 'github' && meta.assetPattern) {
      const rel = await opts.fetchRelease(meta.source.repo, meta.assetPattern)
      if (rel) {
        base.latestTag = rel.version
        base.downloadUrl = rel.downloadUrl
        base.upToDate = det && recorded?.installedTag === rel.version ? true
          : det && recorded?.installedTag && recorded.installedTag !== rel.version ? false
          : null
      }
    }
    plugins.push(base)
  }
  return { gw2Path: opts.gw2Path, gw2PathSource: opts.gw2PathSource, plugins }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/arcdps.ts electron/__tests__/arcdps.test.ts
git commit -m "feat(arcdps): assemble unified arcdps state"
```

---

### Task 7: Atomic install with backup + rollback

**Files:**
- Modify: `electron/arcdps.ts`
- Modify: `electron/__tests__/arcdps.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `electron/__tests__/arcdps.test.ts`:

```ts
import { installPluginFile } from '../arcdps'

describe('installPluginFile', () => {
  const root = path.join(os.tmpdir(), `arcdps-install-${Date.now()}`)
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    fs.mkdirSync(root, { recursive: true })
  })

  it('places the new file at target when no prior file', async () => {
    const target = path.join(root, 'd3d11.dll')
    const download = vi.fn(async (_url: string, dest: string) => {
      fs.writeFileSync(dest, 'new')
    })
    await installPluginFile({ targetPath: target, downloadUrl: 'http://x', download })
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
  })

  it('backs up existing file and replaces it', async () => {
    const target = path.join(root, 'd3d11.dll')
    fs.writeFileSync(target, 'old')
    const download = vi.fn(async (_url: string, dest: string) => {
      fs.writeFileSync(dest, 'new')
    })
    await installPluginFile({ targetPath: target, downloadUrl: 'http://x', download })
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
    expect(fs.readFileSync(target + '.bak', 'utf-8')).toBe('old')
  })

  it('rolls back from .bak when download fails', async () => {
    const target = path.join(root, 'd3d11.dll')
    fs.writeFileSync(target, 'old')
    const download = vi.fn(async () => { throw new Error('network') })
    await expect(installPluginFile({ targetPath: target, downloadUrl: 'http://x', download }))
      .rejects.toThrow('network')
    expect(fs.readFileSync(target, 'utf-8')).toBe('old')
  })

  it('creates installDir if missing', async () => {
    const target = path.join(root, 'nested', 'sub', 'extras.dll')
    const download = vi.fn(async (_url: string, dest: string) => {
      fs.writeFileSync(dest, 'new')
    })
    await installPluginFile({ targetPath: target, downloadUrl: 'http://x', download })
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: FAIL — `installPluginFile` undefined.

- [ ] **Step 3: Implement**

Append to `electron/arcdps.ts`:

```ts
export interface InstallPluginOpts {
  targetPath: string
  downloadUrl: string
  download: (url: string, dest: string) => Promise<void>
}

export async function installPluginFile(opts: InstallPluginOpts): Promise<void> {
  const dir = path.dirname(opts.targetPath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = opts.targetPath + '.new'
  const bak = opts.targetPath + '.bak'

  try {
    await opts.download(opts.downloadUrl, tmp)
  } catch (err) {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    throw err
  }

  const hadPrior = fs.existsSync(opts.targetPath)
  if (hadPrior) {
    try { fs.unlinkSync(bak) } catch { /* ignore */ }
    fs.renameSync(opts.targetPath, bak)
  }
  try {
    fs.renameSync(tmp, opts.targetPath)
  } catch (err) {
    if (hadPrior) {
      try { fs.renameSync(bak, opts.targetPath) } catch { /* best-effort */ }
    }
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    throw err
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run electron/__tests__/arcdps.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/arcdps.ts electron/__tests__/arcdps.test.ts
git commit -m "feat(arcdps): atomic install with backup + rollback"
```

---

### Task 8: IPC handlers for arcdps state, check, install, and path override

**Files:**
- Modify: `electron/ipc-handlers.ts`

- [ ] **Step 1: Add handlers**

At top of `electron/ipc-handlers.ts`, add imports:

```ts
import {
  resolveGw2Path,
  defaultAxiamConfigPath,
  defaultGw2Candidates,
  buildArcdpsState,
  installPluginFile,
  checkArcdpsCoreUpdate,
  ARCDPS_CORE_URL,
} from './arcdps'
import { ARCDPS_REGISTRY, getPluginMeta } from './arcdpsRegistry'
import { downloadFile } from './installer'
import type { ArcdpsState } from './shared/types'
import path from 'path'
```

Add a module-level cache for arcdps state:

```ts
let arcdpsState: ArcdpsState = { gw2Path: null, gw2PathSource: 'none', plugins: [] }

function pushArcdps(win: BrowserWindow): void {
  win.webContents.send('arcdps:state-updated', arcdpsState)
}

function setArcdpsPlugin(win: BrowserWindow, id: string, patch: Partial<ArcdpsState['plugins'][number]>): void {
  arcdpsState = {
    ...arcdpsState,
    plugins: arcdpsState.plugins.map(p => p.id === id ? { ...p, ...patch } : p),
  }
  pushArcdps(win)
}
```

Add a helper that runs a full refresh:

```ts
async function refreshArcdps(win: BrowserWindow): Promise<void> {
  const cfg = readConfig()
  const resolved = resolveGw2Path({
    override: cfg.arcdps.gw2PathOverride,
    axiamConfigPath: defaultAxiamConfigPath(),
    candidates: defaultGw2Candidates(),
  })
  arcdpsState = await buildArcdpsState({
    gw2Path: resolved.path,
    gw2PathSource: resolved.source,
    recordedInstalls: cfg.arcdps.plugins,
    fetchRelease: (repo, pattern) => fetchLatestRelease(repo, pattern),
    fetchCoreMd5: (dll) => checkArcdpsCoreUpdate(dll),
  })
  pushArcdps(win)
}
```

Register the channels inside `registerIpcHandlers(win, onCheckComplete)`:

```ts
ipcMain.handle('arcdps:get-state', () => arcdpsState)

ipcMain.handle('arcdps:check-updates', async () => {
  await refreshArcdps(win)
  onCheckComplete?.()
})

ipcMain.handle('arcdps:set-gw2-path', async (_e, p: string | null) => {
  const cfg = readConfig()
  patchConfig({ arcdps: { ...cfg.arcdps, gw2PathOverride: p } })
  await refreshArcdps(win)
})

ipcMain.handle('arcdps:install', async (_e, id: string) => {
  const meta = getPluginMeta(id)
  if (!meta) return
  const current = arcdpsState
  if (!current.gw2Path) return
  const plugin = current.plugins.find(p => p.id === id)
  if (!plugin?.downloadUrl) return

  // Refuse if GW2 is running
  if (await isProcessRunning('Gw2-64')) {
    setArcdpsPlugin(win, id, { status: 'error', errorMessage: 'Close Guild Wars 2 before updating arcdps plugins.' })
    return
  }

  // Resolve target filename:
  //   - github plugins use the asset basename
  //   - arcdps core uses d3d11.dll
  const filename = meta.source.kind === 'deltaconnected'
    ? 'd3d11.dll'
    : path.basename(new URL(plugin.downloadUrl).pathname)
  const targetPath = path.join(
    current.gw2Path,
    meta.installDir === 'bin64' ? 'bin64' : path.join('bin64', 'arcdps', 'extensions'),
    filename,
  )

  setArcdpsPlugin(win, id, { status: 'downloading', errorMessage: undefined, downloadProgress: { percent: 0, bytesReceived: 0, totalBytes: 0 } })
  try {
    await installPluginFile({
      targetPath,
      downloadUrl: plugin.downloadUrl,
      download: (url, dest) => downloadFile(url, dest, (p) => setArcdpsPlugin(win, id, { downloadProgress: p })),
    })
    // Record installed tag
    const cfg = readConfig()
    const newTag = plugin.latestTag
    patchConfig({
      arcdps: {
        ...cfg.arcdps,
        plugins: {
          ...cfg.arcdps.plugins,
          [id]: { installedTag: newTag, installedAt: new Date().toISOString() },
        },
      },
    })
    setArcdpsPlugin(win, id, {
      status: 'idle',
      installed: true,
      installedTag: newTag,
      installedAt: new Date().toISOString(),
      upToDate: true,
      downloadProgress: undefined,
    })
    onCheckComplete?.()
  } catch (err) {
    setArcdpsPlugin(win, id, { status: 'error', errorMessage: String(err), downloadProgress: undefined })
  }
})
```

Update `hasAnyUpdates()` near the top of the file to OR-in arcdps:

```ts
export function hasAnyUpdates(): boolean {
  const appsHave = Object.values(appStates).some(s =>
    s.installedVersion != null && s.latestVersion != null && s.installedVersion !== s.latestVersion
  )
  const arcdpsHave = arcdpsState.plugins.some(p => p.upToDate === false)
  return appsHave || arcdpsHave
}
```

Inside `runCheckUpdates`, after the existing per-app loop, also refresh arcdps:

```ts
await refreshArcdps(win)
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run all unit tests**

Run: `npm test`
Expected: PASS (existing tests still pass; nothing new added in this task).

- [ ] **Step 4: Commit**

```bash
git add electron/ipc-handlers.ts
git commit -m "feat(arcdps): IPC handlers for state, check, install, path override"
```

---

### Task 9: Expose arcdps API in preload + axiom.d.ts

**Files:**
- Modify: `electron/preload.ts`
- Modify: `src/axiom.d.ts`

- [ ] **Step 1: Add to preload**

Add to the object passed to `contextBridge.exposeInMainWorld('axiom', { ... })`:

```ts
  getArcdpsState: (): Promise<import('./shared/types').ArcdpsState> =>
    ipcRenderer.invoke('arcdps:get-state'),

  checkArcdpsUpdates: (): Promise<void> =>
    ipcRenderer.invoke('arcdps:check-updates'),

  installArcdpsPlugin: (id: string): Promise<void> =>
    ipcRenderer.invoke('arcdps:install', id),

  setGw2Path: (p: string | null): Promise<void> =>
    ipcRenderer.invoke('arcdps:set-gw2-path', p),

  onArcdpsStateUpdated: (cb: (state: import('./shared/types').ArcdpsState) => void) => {
    ipcRenderer.on('arcdps:state-updated', (_e, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('arcdps:state-updated')
  },
```

- [ ] **Step 2: Mirror in axiom.d.ts**

Add to `Window['axiom']`:

```ts
import type { AppState, AppId, InstallableAppId, Config, ArcdpsState } from '../electron/shared/types'

// ... inside Window['axiom']:
      getArcdpsState: () => Promise<ArcdpsState>
      checkArcdpsUpdates: () => Promise<void>
      installArcdpsPlugin: (id: string) => Promise<void>
      setGw2Path: (p: string | null) => Promise<void>
      onArcdpsStateUpdated: (cb: (state: ArcdpsState) => void) => () => void
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add electron/preload.ts src/axiom.d.ts
git commit -m "feat(arcdps): expose arcdps API over preload bridge"
```

---

### Task 10: useArcdpsState hook

**Files:**
- Create: `src/hooks/useArcdpsState.ts`

- [ ] **Step 1: Implement**

```ts
// src/hooks/useArcdpsState.ts
import { useState, useEffect, useCallback } from 'react'
import type { ArcdpsState } from '@shared/types'

const EMPTY: ArcdpsState = { gw2Path: null, gw2PathSource: 'none', plugins: [] }

export function useArcdpsState() {
  const [state, setState] = useState<ArcdpsState>(EMPTY)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    window.axiom.getArcdpsState().then(setState)
    const unsub = window.axiom.onArcdpsStateUpdated(setState)
    return () => { unsub() }
  }, [])

  const check = useCallback(async () => {
    setChecking(true)
    try { await window.axiom.checkArcdpsUpdates() }
    finally { setChecking(false) }
  }, [])

  const install = useCallback((id: string) => window.axiom.installArcdpsPlugin(id), [])
  const setGw2Path = useCallback((p: string | null) => window.axiom.setGw2Path(p), [])

  return { state, checking, check, install, setGw2Path }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useArcdpsState.ts
git commit -m "feat(arcdps): React hook for arcdps state"
```

---

### Task 11: ArcdpsRow + ArcdpsView components

**Files:**
- Create: `src/components/ArcdpsRow.tsx`
- Create: `src/components/ArcdpsView.tsx`

- [ ] **Step 1: Implement ArcdpsRow**

```tsx
// src/components/ArcdpsRow.tsx
import type { ArcdpsPluginState } from '@shared/types'
import { ProgressBar } from './ProgressBar'

interface Props {
  plugin: ArcdpsPluginState
  onInstall: (id: string) => void
}

function statusLabel(p: ArcdpsPluginState): string {
  if (!p.installed) return 'Not installed'
  if (p.upToDate === true) return 'Up to date'
  if (p.upToDate === false) return 'Update available'
  return 'Unknown'
}

function buttonLabel(p: ArcdpsPluginState): string {
  if (!p.installed) return 'Install'
  if (p.upToDate === false) return 'Update'
  if (p.upToDate === null) return 'Update to latest'
  return 'Up to date'
}

export function ArcdpsRow({ plugin, onInstall }: Props) {
  const busy = plugin.status === 'downloading' || plugin.status === 'installing'
  const disabled = busy || (plugin.installed && plugin.upToDate === true) || !plugin.downloadUrl
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{plugin.name}</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {statusLabel(plugin)}
          {plugin.installedTag && ` · installed ${plugin.installedTag}`}
          {plugin.latestTag && ` · latest ${plugin.latestTag}`}
        </div>
        {plugin.downloadProgress && (
          <ProgressBar percent={plugin.downloadProgress.percent} />
        )}
        {plugin.errorMessage && (
          <div style={{ color: 'var(--danger, #b66)', fontSize: 12 }}>{plugin.errorMessage}</div>
        )}
      </div>
      <button disabled={disabled} onClick={() => onInstall(plugin.id)}>
        {buttonLabel(plugin)}
      </button>
    </div>
  )
}
```

> **Note for implementer:** Check `src/components/ProgressBar.tsx` for its actual prop name (`percent` is a guess from common patterns). If the component takes different props, adapt the call. Also align colors and spacing with the existing `AppRow.tsx` styles so this matches the app's visual language; the inline styles above are a placeholder.

- [ ] **Step 2: Implement ArcdpsView**

```tsx
// src/components/ArcdpsView.tsx
import { useArcdpsState } from '../hooks/useArcdpsState'
import { ArcdpsRow } from './ArcdpsRow'

interface Props { onBack: () => void }

export function ArcdpsView({ onBack }: Props) {
  const { state, checking, check, install, setGw2Path } = useArcdpsState()

  const onPickPath = async () => {
    const input = window.prompt('Enter the full path to your Guild Wars 2 install folder:', state.gw2Path ?? '')
    if (input === null) return
    await setGw2Path(input.trim() || null)
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>← Back</button>
        <h2 style={{ margin: 0, flex: 1 }}>arcdps & Plugins</h2>
        <button onClick={check} disabled={checking}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
        GW2 path: {state.gw2Path ?? '(not found)'} ({state.gw2PathSource})
        {' · '}
        <a href="#" onClick={(e) => { e.preventDefault(); onPickPath() }}>Change…</a>
      </div>

      {state.plugins.length === 0 && (
        <div style={{ opacity: 0.7, padding: 16 }}>
          {state.gw2Path
            ? 'No arcdps or plugins detected yet. Click "Check for updates" to scan.'
            : 'Guild Wars 2 not found. Use the "Change…" link above to point AxiOM at your install folder.'}
        </div>
      )}

      <div>
        {state.plugins.map(p => (
          <ArcdpsRow key={p.id} plugin={p} onInstall={install} />
        ))}
      </div>
    </div>
  )
}
```

> **Note for implementer:** `window.prompt` is a placeholder. The existing app likely uses an Electron native dialog (folder picker) for this kind of input — check whether there's an IPC route for `shell.showOpenDialog` already; if not, add one rather than relying on `window.prompt`, which is poor UX. Acceptable to add a small `arcdps:pick-gw2-folder` IPC channel returning the selected path.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ArcdpsRow.tsx src/components/ArcdpsView.tsx
git commit -m "feat(arcdps): row + view components"
```

---

### Task 12: Wire ArcdpsView into App.tsx and add entry button in AppList

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppList.tsx`

- [ ] **Step 1: Add the view route**

Update `src/App.tsx`:

```tsx
import { ArcdpsView } from './components/ArcdpsView'

type View = 'list' | 'settings' | 'info' | 'arcdps'

// inside the component:
{view === 'arcdps' && (
  <ArcdpsView onBack={() => setView('list')} />
)}
```

And pass an `onOpenArcdps` prop to `AppList`:

```tsx
<AppList
  states={states}
  checking={checking}
  selfUpdate={selfUpdate}
  onOpenSettings={() => setView('settings')}
  onOpenArcdps={() => setView('arcdps')}
  onCheckUpdates={checkUpdates}
  onOpenInfo={id => { setInfoAppId(id); setView('info') }}
/>
```

- [ ] **Step 2: Add the button in AppList**

In `src/components/AppList.tsx`, add `onOpenArcdps: () => void` to the props interface, and render a button next to the Settings button in the header. Match the visual style of the existing Settings button.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/AppList.tsx
git commit -m "feat(arcdps): wire ArcdpsView into App + header entry button"
```

---

### Task 13: End-to-end smoke test in dev

**Files:** none — manual verification.

- [ ] **Step 1: Run the dev build**

Run: `npm run dev`
Expected: AxiOM window opens.

- [ ] **Step 2: Open the new view**

Click the new arcdps button in the header. Expected: ArcdpsView renders; if GW2 install isn't auto-detected, "GW2 path: (not found)" is shown and the always-shown rows do not appear (per `buildArcdpsState` returning empty plugins when `gw2Path` is null).

- [ ] **Step 3: Set the GW2 path and re-check**

Click "Change…" and enter a real GW2 install path (or a fake `<tmp>/bin64/Gw2-64.exe` for smoke). Click "Check for updates". Expected: arcdps + arcdps_axipulse rows appear; if other plugin DLLs are present in `bin64/`, those rows appear too.

- [ ] **Step 4: Trigger an install**

Click "Install" on arcdps. Expected: progress bar fills, status flips to "Up to date", a `.bak` exists if there was a prior file. If GW2 is running, the row shows the "close Guild Wars 2" error message and no file is touched.

- [ ] **Step 5: Verify tray badge**

If any plugin reports an available update, the gold tray badge should appear (same indicator used for app updates).

- [ ] **Step 6: Run the full test suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit any small fixups discovered during smoke**

```bash
git add -A
git commit -m "fix(arcdps): smoke-test polish"
```

(Skip if nothing needed.)

---

## Self-review notes

- **Spec coverage:** UI (Tasks 11–12), data model (Tasks 1–2), GW2 path resolution (Task 3), detection (Task 4), arcdps MD5 check (Task 5), GitHub release lookup integration (Task 6 via injected `fetchRelease`), install/rollback (Task 7), IPC (Task 8), tray badge OR (Task 8), tests (Tasks 1, 3–7). All spec sections covered.
- **Open risks from spec carried forward as implementer notes:** AxiAM config key shape (Task 3 note), per-plugin asset patterns (Task 1 note), `arcdps_axipulse` repo coordinates (Task 1 note), first-detection state handled in `buildArcdpsState` as `upToDate: null` → button label "Update to latest" (Task 11).
- **Type consistency:** `ArcdpsPluginState.id` is `string` (registry IDs aren't a closed union — keeps it open for future entries); `getPluginMeta` accepts `string` and returns `ArcPluginMeta | undefined`. Channel names use `arcdps:*` prefix consistently. `ArcdpsState.gw2PathSource` reused everywhere via the type, not stringly typed.
