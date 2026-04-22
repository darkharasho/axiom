# AxiOM Toolbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AxiOM, a Linux/Windows system-tray Electron app that installs, updates, deletes, and launches AxiBridge, AxiForge, AxiPulse, and AxiTools from a single dark/gold popup.

**Architecture:** Electron + React + Vite. Main process owns the Tray, a frameless BrowserWindow, all IPC handlers, GitHub release checks, and download/install logic. Renderer is a React app (two views: App List, Settings) bridged via a typed contextBridge preload. Shared types live in `electron/shared/types.ts` and are aliased into the renderer via Vite.

**Tech Stack:** Electron 32, React 18, Vite 5, TypeScript 5, Vitest 1, electron-builder 24, concurrently, wait-on, cross-env.

---

## File Map

```
axiom/
├── electron/
│   ├── shared/
│   │   └── types.ts          # AppId, Config, AppState, ReleaseInfo, DownloadProgress
│   ├── apps.ts               # APP_META: id, name, repo, asset patterns
│   ├── config.ts             # Read/write config.json in userData
│   ├── github.ts             # Fetch releases/latest, pick platform asset
│   ├── detect.ts             # Detect installed version per platform
│   ├── gearlever.ts          # Check, install, hand-off, remove via Gear Lever
│   ├── installer.ts          # Download file with progress, run installer, delete
│   ├── autostart.ts          # app.setLoginItemSettings wrapper
│   ├── window.ts             # BrowserWindow creation and tray-relative positioning
│   ├── ipc-handlers.ts       # Register all ipcMain.handle calls
│   ├── main.ts               # App entry: tray, lifecycle, calls ipc-handlers
│   └── preload.ts            # contextBridge: window.axiom IPC API
├── src/
│   ├── main.tsx              # React root
│   ├── App.tsx               # View router: 'list' | 'settings'
│   ├── hooks/
│   │   ├── useAppStates.ts   # Fetch + subscribe to AppState[]
│   │   └── useConfig.ts      # Read/write Config
│   ├── components/
│   │   ├── AppRow.tsx        # Single app row: icon, name, status, action button
│   │   ├── AppList.tsx       # Header + rows + footer
│   │   ├── ProgressBar.tsx   # Inline download progress bar
│   │   ├── GearLeverPrompt.tsx # "Install Gear Lever" / "Open Flathub" two-button row
│   │   └── SettingsView.tsx  # Auto-start toggle, invite URL field, version
│   └── styles/
│       └── globals.css       # Cinzel import, CSS variables, base reset
├── shared/                   # (symlink or alias target — see vite.config.ts)
├── public/
│   ├── AxiOM-White.svg       # (already exists)
│   └── AxiOM-White.png       # (already exists — used as tray + installer icon)
├── electron/__tests__/
│   ├── setup.ts              # Mock electron module
│   ├── config.test.ts
│   ├── github.test.ts
│   ├── detect.test.ts
│   └── gearlever.test.ts
├── src/__tests__/
│   ├── setup.ts              # @testing-library/jest-dom
│   ├── AppRow.test.tsx
│   └── SettingsView.test.tsx
├── package.json
├── tsconfig.json             # Renderer (browser, JSX)
├── tsconfig.node.json        # Main + preload (Node, no JSX)
├── vite.config.ts
├── vitest.config.ts
├── electron-builder.config.ts
├── index.html
├── .gitignore
└── README.md
```

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `electron-builder.config.ts`
- Create: `index.html`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "axiom",
  "version": "0.1.0",
  "description": "AxiOM — One launcher for every Axi app",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "concurrently -k \"vite\" \"wait-on tcp:5173 && npm run build:electron && cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electron .\"",
    "build:electron": "tsc -p tsconfig.node.json",
    "build:renderer": "vite build",
    "build": "npm run build:renderer && npm run build:electron && electron-builder",
    "build:linux": "npm run build:renderer && npm run build:electron && electron-builder --linux",
    "build:win": "npm run build:renderer && npm run build:electron && electron-builder --win",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.node.json --noEmit",
    "lint": "eslint src electron --ext .ts,.tsx --max-warnings 0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.6",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "concurrently": "^8.2.2",
    "cross-env": "^7.0.3",
    "electron": "^32.0.0",
    "electron-builder": "^24.13.3",
    "jsdom": "^24.1.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "vitest": "^1.6.0",
    "wait-on": "^7.2.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json` (renderer)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "paths": {
      "@shared/*": ["./electron/shared/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `tsconfig.node.json` (main + preload)**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020"],
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist-electron",
    "rootDir": ".",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["electron"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'electron/shared'),
    },
  },
  build: {
    outDir: 'dist',
  },
})
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'electron/shared'),
    },
  },
})
```

- [ ] **Step 6: Create `electron-builder.config.ts`**

```typescript
import type { Configuration } from 'electron-builder'

const config: Configuration = {
  appId: 'io.darkharasho.axiom',
  productName: 'AxiOM',
  directories: { output: 'dist_out' },
  files: ['dist/**', 'dist-electron/**', 'public/**'],
  linux: {
    target: 'AppImage',
    icon: 'public/AxiOM-White.png',
  },
  win: {
    target: 'nsis',
    icon: 'public/AxiOM-White.png',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    installerIcon: 'public/AxiOM-White.png',
    uninstallerIcon: 'public/AxiOM-White.png',
  },
}

export default config
```

- [ ] **Step 7: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com" />
    <title>AxiOM</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules/
dist/
dist-electron/
dist_out/
.superpowers/
*.log
```

- [ ] **Step 9: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` populated, no errors.

- [ ] **Step 10: Commit**

```bash
git init
git add package.json tsconfig.json tsconfig.node.json vite.config.ts vitest.config.ts electron-builder.config.ts index.html .gitignore
git commit -m "feat: scaffold Electron + React + Vite project"
```

---

## Task 2: Shared types and app metadata

**Files:**
- Create: `electron/shared/types.ts`
- Create: `electron/apps.ts`

- [ ] **Step 1: Create `electron/shared/types.ts`**

```typescript
export type AppId = 'axibridge' | 'axiforge' | 'axipulse' | 'axitools'
export type InstallableAppId = Exclude<AppId, 'axitools'>

export interface DownloadProgress {
  percent: number
  bytesReceived: number
  totalBytes: number
}

export type AppStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'deleting'
  | 'error'

export interface AppState {
  id: AppId
  installedVersion: string | null
  latestVersion: string | null
  downloadUrl: string | null
  status: AppStatus
  errorMessage?: string
  downloadProgress?: DownloadProgress
  gearLeverMissing?: boolean
}

export interface ConfigApp {
  installedVersion: string | null
  lastChecked: string | null
}

export interface Config {
  autoStart: boolean
  axitoolsInviteUrl: string
  apps: Record<InstallableAppId, ConfigApp>
}

export interface ReleaseInfo {
  version: string
  downloadUrl: string
}

export const DEFAULT_CONFIG: Config = {
  autoStart: false,
  axitoolsInviteUrl: '',
  apps: {
    axibridge: { installedVersion: null, lastChecked: null },
    axiforge:  { installedVersion: null, lastChecked: null },
    axipulse:  { installedVersion: null, lastChecked: null },
  },
}
```

- [ ] **Step 2: Create `electron/apps.ts`**

```typescript
import type { AppId, InstallableAppId } from './shared/types'

interface AssetPattern {
  win: RegExp
  linux: RegExp
}

interface InstallableAppMeta {
  id: InstallableAppId
  name: string
  repo: string
  assetPattern: AssetPattern
}

interface AxiToolsMeta {
  id: 'axitools'
  name: string
  repo: null
}

export type AppMeta = InstallableAppMeta | AxiToolsMeta

export const APP_META: Record<AppId, AppMeta> = {
  axibridge: {
    id: 'axibridge',
    name: 'AxiBridge',
    repo: 'darkharasho/axibridge',
    assetPattern: {
      win: /AxiBridge.*Setup.*\.exe$/i,
      linux: /AxiBridge.*\.AppImage$/i,
    },
  },
  axiforge: {
    id: 'axiforge',
    name: 'AxiForge',
    repo: 'darkharasho/axiforge',
    assetPattern: {
      win: /AxiForge.*Setup.*\.exe$/i,
      linux: /AxiForge.*\.AppImage$/i,
    },
  },
  axipulse: {
    id: 'axipulse',
    name: 'AxiPulse',
    repo: 'darkharasho/axipulse',
    assetPattern: {
      win: /AxiPulse.*Setup.*\.exe$/i,
      linux: /AxiPulse.*\.AppImage$/i,
    },
  },
  axitools: {
    id: 'axitools',
    name: 'AxiTools',
    repo: null,
  },
}

export function isInstallable(meta: AppMeta): meta is InstallableAppMeta {
  return meta.repo !== null
}
```

- [ ] **Step 3: Commit**

```bash
git add electron/shared/types.ts electron/apps.ts
git commit -m "feat: shared types and app metadata"
```

---

## Task 3: Config persistence

**Files:**
- Create: `electron/config.ts`
- Create: `electron/__tests__/setup.ts`
- Create: `electron/__tests__/config.test.ts`

- [ ] **Step 1: Create test setup `electron/__tests__/setup.ts`**

```typescript
import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/axiom-test-userdata'
      return '/tmp'
    }),
    getVersion: vi.fn(() => '0.1.0'),
    setLoginItemSettings: vi.fn(),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}))
```

- [ ] **Step 2: Write failing tests `electron/__tests__/config.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/axiom-test-config') },
}))

const TEST_DIR = '/tmp/axiom-test-config'

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
  vi.resetModules()
})

describe('config', () => {
  it('returns DEFAULT_CONFIG when no file exists', async () => {
    const { readConfig } = await import('../config')
    const cfg = readConfig()
    expect(cfg.autoStart).toBe(false)
    expect(cfg.apps.axibridge.installedVersion).toBeNull()
  })

  it('writes and reads back a config', async () => {
    const { readConfig, writeConfig } = await import('../config')
    writeConfig({ autoStart: true, axitoolsInviteUrl: 'https://discord.gg/test', apps: readConfig().apps })
    const cfg = readConfig()
    expect(cfg.autoStart).toBe(true)
    expect(cfg.axitoolsInviteUrl).toBe('https://discord.gg/test')
  })

  it('merges partial updates via patchConfig', async () => {
    const { readConfig, patchConfig } = await import('../config')
    patchConfig({ autoStart: true })
    const cfg = readConfig()
    expect(cfg.autoStart).toBe(true)
    expect(cfg.axitoolsInviteUrl).toBe('')
  })

  it('sets installedVersion for an app', async () => {
    const { setInstalledVersion, readConfig } = await import('../config')
    setInstalledVersion('axibridge', '2.5.11')
    expect(readConfig().apps.axibridge.installedVersion).toBe('2.5.11')
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run electron/__tests__/config.test.ts
```

Expected: FAIL — `../config` module not found.

- [ ] **Step 4: Create `electron/config.ts`**

```typescript
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Config, InstallableAppId } from './shared/types'
import { DEFAULT_CONFIG } from './shared/types'

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function readConfig(): Config {
  const p = configPath()
  if (!fs.existsSync(p)) return structuredClone(DEFAULT_CONFIG)
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    // Merge with defaults so new fields are always present
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      apps: { ...DEFAULT_CONFIG.apps, ...raw.apps },
    }
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}

export function writeConfig(cfg: Config): void {
  const p = configPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

export function patchConfig(patch: Partial<Config>): void {
  writeConfig({ ...readConfig(), ...patch })
}

export function setInstalledVersion(appId: InstallableAppId, version: string | null): void {
  const cfg = readConfig()
  cfg.apps[appId] = {
    installedVersion: version,
    lastChecked: new Date().toISOString(),
  }
  writeConfig(cfg)
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npx vitest run electron/__tests__/config.test.ts
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add electron/config.ts electron/__tests__/setup.ts electron/__tests__/config.test.ts
git commit -m "feat: config persistence with read/write/patch"
```

---

## Task 4: GitHub releases API

**Files:**
- Create: `electron/github.ts`
- Create: `electron/__tests__/github.test.ts`

- [ ] **Step 1: Write failing tests `electron/__tests__/github.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetAllMocks()
})

describe('fetchLatestRelease', () => {
  it('returns version and matching linux AppImage URL', async () => {
    const mockAssets = [
      { name: 'AxiBridge-2.6.0-linux.AppImage', browser_download_url: 'https://example.com/AxiBridge-2.6.0-linux.AppImage' },
      { name: 'AxiBridge-2.6.0-Setup.exe', browser_download_url: 'https://example.com/AxiBridge-2.6.0-Setup.exe' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v2.6.0', assets: mockAssets }),
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /AxiBridge.*\.AppImage$/i)
    expect(result).toEqual({
      version: '2.6.0',
      downloadUrl: 'https://example.com/AxiBridge-2.6.0-linux.AppImage',
    })
  })

  it('returns null when no matching asset found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ tag_name: 'v2.6.0', assets: [] }),
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /AxiBridge.*\.AppImage$/i)
    expect(result).toBeNull()
  })

  it('returns null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /AxiBridge.*\.AppImage$/i)
    expect(result).toBeNull()
  })

  it('strips leading v from tag_name', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v1.0.0',
        assets: [{ name: 'App.AppImage', browser_download_url: 'https://example.com/App.AppImage' }],
      }),
    }))

    const { fetchLatestRelease } = await import('../github')
    const result = await fetchLatestRelease('darkharasho/axibridge', /App\.AppImage$/i)
    expect(result?.version).toBe('1.0.0')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run electron/__tests__/github.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `electron/github.ts`**

```typescript
import type { ReleaseInfo } from './shared/types'

const GITHUB_API = 'https://api.github.com'

export async function fetchLatestRelease(
  repo: string,
  assetPattern: RegExp,
): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    })
    if (!res.ok) return null
    const data = await res.json() as { tag_name: string; assets: { name: string; browser_download_url: string }[] }
    const version = data.tag_name.replace(/^v/, '')
    const asset = data.assets.find(a => assetPattern.test(a.name))
    if (!asset) return null
    return { version, downloadUrl: asset.browser_download_url }
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run electron/__tests__/github.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add electron/github.ts electron/__tests__/github.test.ts
git commit -m "feat: GitHub releases API with asset pattern matching"
```

---

## Task 5: Version detection

**Files:**
- Create: `electron/detect.ts`
- Create: `electron/__tests__/detect.test.ts`

- [ ] **Step 1: Write failing tests `electron/__tests__/detect.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import os from 'os'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
}))
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() }
})

beforeEach(() => vi.resetAllMocks())

describe('detectInstalledVersion', () => {
  it('returns version from PowerShell on Windows when found', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('2.5.11\r\n' as any)
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBe('2.5.11')
  })

  it('returns null on Windows when PowerShell returns empty', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('\r\n' as any)
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBeNull()
  })

  it('returns null on Windows when PowerShell throws', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation(() => { throw new Error('PS error') })
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBeNull()
  })

  it('returns version from AppImage filename on Linux', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readdirSync).mockReturnValue(['AxiBridge-2.5.11-linux.AppImage'] as any)
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBe('2.5.11')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run electron/__tests__/detect.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `electron/detect.ts`**

```typescript
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

export async function detectInstalledVersion(appName: string): Promise<string | null> {
  if (process.platform === 'win32') return detectWindows(appName)
  if (process.platform === 'linux') return detectLinux(appName)
  return null
}

function detectWindows(appName: string): string | null {
  try {
    const ps = [
      `$apps = Get-ItemProperty`,
      `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',`,
      `'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'`,
      `-ErrorAction SilentlyContinue;`,
      `$app = $apps | Where-Object { $_.DisplayName -like '*${appName}*' } | Select-Object -First 1;`,
      `if ($app) { $app.DisplayVersion } else { '' }`,
    ].join(' ')
    const result = execSync(`powershell -Command "${ps}"`, {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
    }).trim()
    return result || null
  } catch {
    return null
  }
}

function detectLinux(appName: string): string | null {
  // Check Gear Lever metadata: ~/.local/share/gearlever/<uuid>/metadata.json
  const glDir = path.join(os.homedir(), '.local', 'share', 'gearlever')
  if (fs.existsSync(glDir)) {
    try {
      const entries = fs.readdirSync(glDir)
      for (const entry of entries) {
        const metaPath = path.join(glDir, entry, 'metadata.json')
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as Record<string, unknown>
          const name = (meta.name ?? meta.Name ?? '') as string
          const version = (meta.version ?? meta.Version ?? '') as string
          if (name.toLowerCase().includes(appName.toLowerCase()) && version) {
            return version
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Fallback: scan ~/Applications/ for AppImage filename containing version
  const appsDir = path.join(os.homedir(), 'Applications')
  try {
    const files = fs.readdirSync(appsDir)
    for (const file of files) {
      if (!file.toLowerCase().includes(appName.toLowerCase())) continue
      // Match version pattern like 2.5.11 in filename
      const match = file.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/)
      if (match) return match[1]
    }
  } catch { /* ignore */ }

  return null
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run electron/__tests__/detect.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add electron/detect.ts electron/__tests__/detect.test.ts
git commit -m "feat: installed version detection for Windows (PowerShell) and Linux (Gear Lever + AppImage scan)"
```

---

## Task 6: Gear Lever integration

**Files:**
- Create: `electron/gearlever.ts`
- Create: `electron/__tests__/gearlever.test.ts`

- [ ] **Step 1: Write failing tests `electron/__tests__/gearlever.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', () => ({
  execSync: vi.fn(),
  spawn: vi.fn(),
}))

beforeEach(() => vi.resetAllMocks())

describe('isGearLeverInstalled', () => {
  it('returns true when flatpak list output includes gearlever', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('it.mijorus.gearlever\tGear Lever\t2.0.0\n' as any)

    const { isGearLeverInstalled } = await import('../gearlever')
    expect(isGearLeverInstalled()).toBe(true)
  })

  it('returns false when gearlever not in flatpak list', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('org.other.app\tOther\t1.0.0\n' as any)

    const { isGearLeverInstalled } = await import('../gearlever')
    expect(isGearLeverInstalled()).toBe(false)
  })

  it('returns false when execSync throws', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation(() => { throw new Error('flatpak not found') })

    const { isGearLeverInstalled } = await import('../gearlever')
    expect(isGearLeverInstalled()).toBe(false)
  })
})

describe('openInGearLever', () => {
  it('calls flatpak run with the appimage path', async () => {
    const { spawn } = await import('child_process')
    const mockSpawn = vi.mocked(spawn).mockReturnValue({ unref: vi.fn() } as any)

    const { openInGearLever } = await import('../gearlever')
    openInGearLever('/home/user/Applications/AxiBridge-2.6.0.AppImage')

    expect(mockSpawn).toHaveBeenCalledWith(
      'flatpak',
      ['run', 'it.mijorus.gearlever', '/home/user/Applications/AxiBridge-2.6.0.AppImage'],
      { detached: true, stdio: 'ignore' },
    )
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run electron/__tests__/gearlever.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `electron/gearlever.ts`**

```typescript
import { execSync, spawn } from 'child_process'

export function isGearLeverInstalled(): boolean {
  try {
    const output = execSync('flatpak list --columns=application', {
      encoding: 'utf8',
      timeout: 5000,
    })
    return output.includes('it.mijorus.gearlever')
  } catch {
    return false
  }
}

export function openInGearLever(appImagePath: string): void {
  const child = spawn('flatpak', ['run', 'it.mijorus.gearlever', appImagePath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

export function removeFromGearLever(appImagePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('flatpak', ['run', 'it.mijorus.gearlever', '--remove', appImagePath], {
      detached: false,
      stdio: 'ignore',
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Gear Lever remove exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

export function installGearLever(onData: (chunk: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('flatpak', ['install', '--noninteractive', 'flathub', 'it.mijorus.gearlever'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (d: Buffer) => onData(d.toString()))
    child.stderr?.on('data', (d: Buffer) => onData(d.toString()))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`flatpak install exited with code ${code}`))
    })
    child.on('error', reject)
  })
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run electron/__tests__/gearlever.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add electron/gearlever.ts electron/__tests__/gearlever.test.ts
git commit -m "feat: Gear Lever detection, install, open, and remove"
```

---

## Task 7: Download and installer

**Files:**
- Create: `electron/installer.ts`

- [ ] **Step 1: Create `electron/installer.ts`**

```typescript
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawn } from 'child_process'
import type { DownloadProgress } from './shared/types'

export function downloadFile(
  url: string,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    protocol.get(url, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`))
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

export async function installWindows(
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const tmpDir = os.tmpdir()
  const filename = path.basename(new URL(downloadUrl).pathname)
  const dest = path.join(tmpDir, filename)
  await downloadFile(downloadUrl, dest, onProgress)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(dest, [], { detached: true, stdio: 'ignore' })
    child.on('error', reject)
    child.unref()
    // Installer runs independently; we resolve immediately after launch
    resolve()
  })
}

export async function installLinux(
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  const appsDir = path.join(os.homedir(), 'Applications')
  fs.mkdirSync(appsDir, { recursive: true })
  const filename = path.basename(new URL(downloadUrl).pathname)
  const dest = path.join(appsDir, filename)
  await downloadFile(downloadUrl, dest, onProgress)
  fs.chmodSync(dest, 0o755)
  return dest
}

export function uninstallWindows(appName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const ps = [
        `$app = Get-ItemProperty`,
        `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',`,
        `'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'`,
        `-ErrorAction SilentlyContinue |`,
        `Where-Object { $_.DisplayName -like '*${appName}*' } |`,
        `Select-Object -First 1;`,
        `if ($app -and $app.UninstallString) { Start-Process -FilePath $app.UninstallString -Wait }`,
      ].join(' ')
      execSync(`powershell -Command "${ps}"`, { timeout: 60000, windowsHide: true })
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

export function uninstallLinux(appImagePath: string): void {
  if (fs.existsSync(appImagePath)) {
    fs.unlinkSync(appImagePath)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/installer.ts
git commit -m "feat: download with progress, Windows/Linux install, uninstall"
```

---

## Task 8: Auto-start

**Files:**
- Create: `electron/autostart.ts`

- [ ] **Step 1: Create `electron/autostart.ts`**

```typescript
import { app } from 'electron'

export function setAutoStart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true,
    name: 'AxiOM',
  })
}

export function getAutoStart(): boolean {
  return app.getLoginItemSettings().openAtLogin
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/autostart.ts
git commit -m "feat: auto-start login item wrapper"
```

---

## Task 9: BrowserWindow and tray positioning

**Files:**
- Create: `electron/window.ts`

- [ ] **Step 1: Create `electron/window.ts`**

```typescript
import { BrowserWindow, Tray, screen, app } from 'electron'
import path from 'path'

const WINDOW_WIDTH = 320

export function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })

  return win
}

export function showWindowNearTray(win: BrowserWindow, tray: Tray): void {
  const trayBounds = tray.getBounds()
  const winBounds = win.getBounds()
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
  const workArea = display.workArea

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
  // If tray is in the bottom half of screen, show window above it; otherwise below
  const y = trayBounds.y > workArea.y + workArea.height / 2
    ? trayBounds.y - winBounds.height
    : trayBounds.y + trayBounds.height

  // Clamp to work area
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winBounds.width))

  win.setPosition(x, y, false)
  win.show()
  win.focus()
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/window.ts
git commit -m "feat: frameless popup BrowserWindow with tray-relative positioning"
```

---

## Task 10: IPC handlers

**Files:**
- Create: `electron/ipc-handlers.ts`

- [ ] **Step 1: Create `electron/ipc-handlers.ts`**

```typescript
import { ipcMain, shell, app } from 'electron'
import type { BrowserWindow } from 'electron'
import type { AppId, InstallableAppId, AppState } from './shared/types'
import { APP_META, isInstallable } from './apps'
import { readConfig, patchConfig, setInstalledVersion } from './config'
import { fetchLatestRelease } from './github'
import { detectInstalledVersion } from './detect'
import {
  isGearLeverInstalled,
  installGearLever,
  openInGearLever,
  removeFromGearLever,
} from './gearlever'
import { installWindows, installLinux, uninstallWindows, uninstallLinux } from './installer'
import { setAutoStart, getAutoStart } from './autostart'

// In-memory app states, updated and pushed to renderer
let appStates: Record<AppId, AppState> = buildInitialStates()

function buildInitialStates(): Record<AppId, AppState> {
  const cfg = readConfig()
  const states: Partial<Record<AppId, AppState>> = {}
  for (const [id, meta] of Object.entries(APP_META)) {
    const appId = id as AppId
    const installedVersion = isInstallable(meta)
      ? (cfg.apps[appId as InstallableAppId]?.installedVersion ?? null)
      : null
    states[appId] = {
      id: appId,
      installedVersion,
      latestVersion: null,
      downloadUrl: null,
      status: 'idle',
    }
  }
  return states as Record<AppId, AppState>
}

function pushStates(win: BrowserWindow): void {
  win.webContents.send('axiom:states-updated', Object.values(appStates))
}

function setState(win: BrowserWindow, appId: AppId, patch: Partial<AppState>): void {
  appStates[appId] = { ...appStates[appId], ...patch }
  pushStates(win)
}

export function registerIpcHandlers(win: BrowserWindow): void {
  // Get current states
  ipcMain.handle('axiom:get-states', () => Object.values(appStates))

  // Get / set config
  ipcMain.handle('axiom:get-config', () => readConfig())
  ipcMain.handle('axiom:set-config', (_e, patch: Parameters<typeof patchConfig>[0]) => {
    patchConfig(patch)
    return readConfig()
  })

  // Auto-start
  ipcMain.handle('axiom:get-auto-start', () => getAutoStart())
  ipcMain.handle('axiom:set-auto-start', (_e, enabled: boolean) => {
    setAutoStart(enabled)
    patchConfig({ autoStart: enabled })
  })

  // Check updates for all installable apps
  ipcMain.handle('axiom:check-updates', async () => {
    for (const [id, meta] of Object.entries(APP_META)) {
      const appId = id as AppId
      if (!isInstallable(meta)) continue
      setState(win, appId, { status: 'checking' })
      const platform = process.platform === 'win32' ? 'win' : 'linux'
      const pattern = meta.assetPattern[platform]
      const release = await fetchLatestRelease(meta.repo, pattern)
      const installedVersion = await detectInstalledVersion(meta.name)
      setInstalledVersion(appId as InstallableAppId, installedVersion)
      setState(win, appId, {
        status: 'idle',
        installedVersion,
        latestVersion: release?.version ?? null,
        downloadUrl: release?.downloadUrl ?? null,
      })
    }
  })

  // Download and install
  ipcMain.handle('axiom:install', async (_e, appId: InstallableAppId) => {
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    const { downloadUrl } = appStates[appId]
    if (!downloadUrl) return

    if (process.platform === 'linux' && !isGearLeverInstalled()) {
      setState(win, appId, { gearLeverMissing: true })
      return
    }

    setState(win, appId, { status: 'downloading', downloadProgress: { percent: 0, bytesReceived: 0, totalBytes: 0 } })
    try {
      if (process.platform === 'win32') {
        await installWindows(downloadUrl, (p) => setState(win, appId, { downloadProgress: p }))
        // Re-detect version after installer runs (user must close installer first)
      } else {
        setState(win, appId, { status: 'installing' })
        const appImagePath = await installLinux(downloadUrl, (p) => setState(win, appId, { downloadProgress: p }))
        openInGearLever(appImagePath)
        const newVersion = appStates[appId].latestVersion
        setInstalledVersion(appId, newVersion)
        setState(win, appId, { status: 'idle', installedVersion: newVersion, downloadProgress: undefined })
      }
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  // Launch
  ipcMain.handle('axiom:launch', async (_e, appId: AppId) => {
    if (appId === 'axitools') {
      const cfg = readConfig()
      if (cfg.axitoolsInviteUrl) shell.openExternal(cfg.axitoolsInviteUrl)
      return
    }
    // For installed apps, shell.openPath works for AppImages and .exe
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    // On Linux: find the AppImage in ~/Applications
    if (process.platform === 'linux') {
      const { execSync } = await import('child_process')
      try {
        execSync(`flatpak run it.mijorus.gearlever --launch "${meta.name}"`, { stdio: 'ignore' })
      } catch {
        // Fallback: try opening via shell
      }
    } else {
      // On Windows: find via registry
      const { execSync } = await import('child_process')
      try {
        const ps = `(Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*${meta.name}*' } | Select-Object -First 1).InstallLocation`
        const loc = execSync(`powershell -Command "${ps}"`, { encoding: 'utf8', timeout: 5000 }).trim()
        if (loc) {
          const { readdirSync } = await import('fs')
          const exes = readdirSync(loc).filter(f => f.endsWith('.exe') && !f.includes('Uninstall'))
          if (exes[0]) shell.openPath(`${loc}\\${exes[0]}`)
        }
      } catch { /* ignore */ }
    }
  })

  // Uninstall
  ipcMain.handle('axiom:uninstall', async (_e, appId: InstallableAppId) => {
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    setState(win, appId, { status: 'deleting' })
    try {
      if (process.platform === 'win32') {
        await uninstallWindows(meta.name)
      } else {
        // Find AppImage path from detect then remove
        const { execSync } = await import('child_process')
        try {
          execSync(`flatpak run it.mijorus.gearlever --remove "${meta.name}"`, { stdio: 'ignore' })
        } catch {
          // Fallback: delete AppImage from ~/Applications
          const fs = await import('fs')
          const os = await import('os')
          const path = await import('path')
          const appsDir = path.join(os.homedir(), 'Applications')
          const files = fs.readdirSync(appsDir)
          const appImage = files.find(f => f.toLowerCase().includes(meta.name.toLowerCase()))
          if (appImage) uninstallLinux(path.join(appsDir, appImage))
        }
      }
      setInstalledVersion(appId, null)
      setState(win, appId, { status: 'idle', installedVersion: null })
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  // Gear Lever: install via flatpak
  ipcMain.handle('axiom:install-gear-lever', async (_e, appId: InstallableAppId) => {
    setState(win, appId, { status: 'installing' })
    try {
      await installGearLever((chunk) => win.webContents.send('axiom:gear-lever-progress', chunk))
      setState(win, appId, { status: 'idle', gearLeverMissing: false })
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  // Gear Lever: open Flathub page
  ipcMain.handle('axiom:open-gear-lever-flathub', () => {
    shell.openExternal('https://flathub.org/apps/it.mijorus.gearlever')
  })

  // App version
  ipcMain.handle('axiom:get-version', () => app.getVersion())
}
```

- [ ] **Step 2: Commit**

```bash
git add electron/ipc-handlers.ts
git commit -m "feat: IPC handlers for state, config, install, launch, uninstall, Gear Lever"
```

---

## Task 11: Main process entry point

**Files:**
- Create: `electron/main.ts`
- Create: `electron/preload.ts`

- [ ] **Step 1: Create `electron/main.ts`**

```typescript
import { app, Tray, nativeImage, Menu } from 'electron'
import path from 'path'
import { createPopupWindow, showWindowNearTray } from './window'
import { registerIpcHandlers } from './ipc-handlers'
import { readConfig } from './config'
import { setAutoStart } from './autostart'
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null
let win: BrowserWindow | null = null

app.on('window-all-closed', (e: Event) => {
  // Prevent quit — this is a tray app
  e.preventDefault()
})

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, '../public/AxiOM-White.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('AxiOM')
  tray.setContextMenu(null)

  win = createPopupWindow()
  registerIpcHandlers(win)

  tray.on('click', () => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      showWindowNearTray(win, tray!)
    }
  })

  // Sync auto-start from saved config on first launch
  const cfg = readConfig()
  setAutoStart(cfg.autoStart)

  // Kick off update checks in the background
  win.webContents.once('did-finish-load', () => {
    win?.webContents.send('axiom:request-check-updates')
  })
})

app.on('before-quit', () => {
  tray?.destroy()
})
```

- [ ] **Step 2: Create `electron/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import type { AppId, InstallableAppId, Config, AppState } from './shared/types'

contextBridge.exposeInMainWorld('axiom', {
  getStates: (): Promise<AppState[]> =>
    ipcRenderer.invoke('axiom:get-states'),

  getConfig: (): Promise<Config> =>
    ipcRenderer.invoke('axiom:get-config'),

  setConfig: (patch: Partial<Config>): Promise<Config> =>
    ipcRenderer.invoke('axiom:set-config', patch),

  getAutoStart: (): Promise<boolean> =>
    ipcRenderer.invoke('axiom:get-auto-start'),

  setAutoStart: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke('axiom:set-auto-start', enabled),

  checkUpdates: (): Promise<void> =>
    ipcRenderer.invoke('axiom:check-updates'),

  install: (appId: InstallableAppId): Promise<void> =>
    ipcRenderer.invoke('axiom:install', appId),

  launch: (appId: AppId): Promise<void> =>
    ipcRenderer.invoke('axiom:launch', appId),

  uninstall: (appId: InstallableAppId): Promise<void> =>
    ipcRenderer.invoke('axiom:uninstall', appId),

  installGearLever: (appId: InstallableAppId): Promise<void> =>
    ipcRenderer.invoke('axiom:install-gear-lever', appId),

  openGearLeverFlathub: (): Promise<void> =>
    ipcRenderer.invoke('axiom:open-gear-lever-flathub'),

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('axiom:get-version'),

  onStatesUpdated: (cb: (states: AppState[]) => void) => {
    ipcRenderer.on('axiom:states-updated', (_e, states) => cb(states))
    return () => ipcRenderer.removeAllListeners('axiom:states-updated')
  },

  onRequestCheckUpdates: (cb: () => void) => {
    ipcRenderer.on('axiom:request-check-updates', cb)
    return () => ipcRenderer.removeAllListeners('axiom:request-check-updates')
  },

  onGearLeverProgress: (cb: (chunk: string) => void) => {
    ipcRenderer.on('axiom:gear-lever-progress', (_e, chunk) => cb(chunk))
    return () => ipcRenderer.removeAllListeners('axiom:gear-lever-progress')
  },
})

// Extend Window type
declare global {
  interface Window {
    axiom: typeof import('./preload')['default'] extends never
      ? Record<string, unknown>
      : ReturnType<typeof contextBridge.exposeInMainWorld>
  }
}
```

- [ ] **Step 3: Build electron and verify no TypeScript errors**

```bash
npm run build:electron
```

Expected: `dist-electron/` created with `main.js` and `preload.js`, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts electron/preload.ts
git commit -m "feat: main process entry point and preload IPC bridge"
```

---

## Task 12: React entry, theme, and global styles

**Files:**
- Create: `src/__tests__/setup.ts`
- Create: `src/styles/globals.css`
- Create: `src/main.tsx`

- [ ] **Step 1: Create `src/__tests__/setup.ts`**

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock the window.axiom bridge
vi.stubGlobal('axiom', {
  getStates: vi.fn().mockResolvedValue([]),
  getConfig: vi.fn().mockResolvedValue({
    autoStart: false,
    axitoolsInviteUrl: '',
    apps: {
      axibridge: { installedVersion: null, lastChecked: null },
      axiforge: { installedVersion: null, lastChecked: null },
      axipulse: { installedVersion: null, lastChecked: null },
    },
  }),
  setConfig: vi.fn().mockResolvedValue({}),
  getAutoStart: vi.fn().mockResolvedValue(false),
  setAutoStart: vi.fn().mockResolvedValue(undefined),
  checkUpdates: vi.fn().mockResolvedValue(undefined),
  install: vi.fn().mockResolvedValue(undefined),
  launch: vi.fn().mockResolvedValue(undefined),
  uninstall: vi.fn().mockResolvedValue(undefined),
  installGearLever: vi.fn().mockResolvedValue(undefined),
  openGearLeverFlathub: vi.fn().mockResolvedValue(undefined),
  getVersion: vi.fn().mockResolvedValue('0.1.0'),
  onStatesUpdated: vi.fn().mockReturnValue(() => {}),
  onRequestCheckUpdates: vi.fn().mockReturnValue(() => {}),
  onGearLeverProgress: vi.fn().mockReturnValue(() => {}),
})
```

- [ ] **Step 2: Create `src/styles/globals.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');

:root {
  --bg:           #08090c;
  --panel:        #0c0d10;
  --border:       #1e1f24;
  --border-muted: #14151a;
  --text:         #e2e3e8;
  --text-light:   #aeafb8;
  --text-dim:     #646670;
  --text-faint:   #3a3b40;
  --gold:         #c89850;
  --gold-bright:  #e8b050;
  --gold-border:  rgba(200, 152, 80, 0.27);
  --gold-border-bright: rgba(232, 176, 80, 0.27);
  --font-ui:      'Segoe UI', system-ui, sans-serif;
  --font-title:   'Cinzel', serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  width: 100%;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  overflow: hidden;
}

button {
  font-family: var(--font-ui);
  cursor: pointer;
  border: none;
  outline: none;
}

button:disabled { opacity: 0.5; cursor: default; }
```

- [ ] **Step 3: Create `src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/globals.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/setup.ts src/styles/globals.css src/main.tsx
git commit -m "feat: React entry, test setup, global CSS theme"
```

---

## Task 13: IPC hooks

**Files:**
- Create: `src/hooks/useAppStates.ts`
- Create: `src/hooks/useConfig.ts`

- [ ] **Step 1: Create `src/hooks/useAppStates.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { AppState } from '@shared/types'

export function useAppStates() {
  const [states, setStates] = useState<AppState[]>([])
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    window.axiom.getStates().then(setStates)
    const unsub = window.axiom.onStatesUpdated(setStates)
    const unsubCheck = window.axiom.onRequestCheckUpdates(() => checkUpdates())
    return () => { unsub(); unsubCheck() }
  }, [])

  const checkUpdates = useCallback(async () => {
    setChecking(true)
    await window.axiom.checkUpdates()
    setChecking(false)
  }, [])

  return { states, checking, checkUpdates }
}
```

- [ ] **Step 2: Create `src/hooks/useConfig.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react'
import type { Config } from '@shared/types'

const EMPTY_CONFIG: Config = {
  autoStart: false,
  axitoolsInviteUrl: '',
  apps: {
    axibridge: { installedVersion: null, lastChecked: null },
    axiforge:  { installedVersion: null, lastChecked: null },
    axipulse:  { installedVersion: null, lastChecked: null },
  },
}

export function useConfig() {
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG)

  useEffect(() => {
    window.axiom.getConfig().then(setConfig)
  }, [])

  const updateConfig = useCallback(async (patch: Partial<Config>) => {
    const updated = await window.axiom.setConfig(patch)
    setConfig(updated)
  }, [])

  return { config, updateConfig }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useAppStates.ts src/hooks/useConfig.ts
git commit -m "feat: IPC hooks for app states and config"
```

---

## Task 14: ProgressBar and GearLeverPrompt components

**Files:**
- Create: `src/components/ProgressBar.tsx`
- Create: `src/components/GearLeverPrompt.tsx`

- [ ] **Step 1: Create `src/components/ProgressBar.tsx`**

```tsx
import React from 'react'
import type { DownloadProgress } from '@shared/types'

interface Props {
  progress: DownloadProgress
}

export function ProgressBar({ progress }: Props) {
  const pct = Math.min(100, Math.round(progress.percent))
  const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 90 }}>
      <div style={{
        height: 4,
        background: 'var(--border)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--gold)',
          borderRadius: 2,
          transition: 'width 0.1s linear',
        }} />
      </div>
      <span style={{ color: 'var(--text-dim)', fontSize: 9, textAlign: 'right' }}>
        {progress.totalBytes > 0
          ? `${mb(progress.bytesReceived)} / ${mb(progress.totalBytes)} MB`
          : `${pct}%`}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/GearLeverPrompt.tsx`**

```tsx
import React from 'react'
import type { InstallableAppId } from '@shared/types'

interface Props {
  appId: InstallableAppId
  onInstall: () => void
  onOpenFlathub: () => void
}

export function GearLeverPrompt({ appId, onInstall, onOpenFlathub }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '6px 0',
    }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
        Gear Lever required to manage AppImages
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={onInstall}
          style={{
            flex: 1,
            background: 'var(--gold)',
            color: 'var(--bg)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          Install Gear Lever
        </button>
        <button
          onClick={onOpenFlathub}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
          }}
        >
          Open Flathub ↗
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressBar.tsx src/components/GearLeverPrompt.tsx
git commit -m "feat: ProgressBar and GearLeverPrompt components"
```

---

## Task 15: AppRow component

**Files:**
- Create: `src/components/AppRow.tsx`
- Create: `src/__tests__/AppRow.test.tsx`

- [ ] **Step 1: Write failing tests `src/__tests__/AppRow.test.tsx`**

```tsx
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppRow } from '../components/AppRow'
import type { AppState } from '@shared/types'

const baseState: AppState = {
  id: 'axibridge',
  installedVersion: '2.5.11',
  latestVersion: '2.5.11',
  downloadUrl: null,
  status: 'idle',
}

describe('AppRow', () => {
  it('shows Launch button when installed and up to date', () => {
    render(<AppRow state={baseState} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: /launch/i })).toBeInTheDocument()
  })

  it('shows Update button when newer version available', () => {
    const state = { ...baseState, latestVersion: '2.6.0', downloadUrl: 'https://example.com/app.AppImage' }
    render(<AppRow state={state} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
  })

  it('shows Install button when not installed', () => {
    const state = { ...baseState, installedVersion: null, downloadUrl: 'https://example.com/app.AppImage' }
    render(<AppRow state={state} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
  })

  it('calls onAction with launch when Launch is clicked', () => {
    const onAction = vi.fn()
    render(<AppRow state={baseState} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: /launch/i }))
    expect(onAction).toHaveBeenCalledWith('launch', 'axibridge')
  })

  it('shows Invite button for axitools', () => {
    const state: AppState = { id: 'axitools', installedVersion: null, latestVersion: null, downloadUrl: null, status: 'idle' }
    render(<AppRow state={state} onAction={vi.fn()} />)
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
  })

  it('shows progress bar when downloading', () => {
    const state = {
      ...baseState,
      status: 'downloading' as const,
      downloadProgress: { percent: 45, bytesReceived: 45000, totalBytes: 100000 },
    }
    render(<AppRow state={state} onAction={vi.fn()} />)
    expect(screen.getByText(/45\.0.*100\.0/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/__tests__/AppRow.test.tsx
```

Expected: FAIL — AppRow not found.

- [ ] **Step 3: Create `src/components/AppRow.tsx`**

```tsx
import React from 'react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { ProgressBar } from './ProgressBar'
import { GearLeverPrompt } from './GearLeverPrompt'

const APP_ICONS: Record<AppId, string> = {
  axibridge: '/svg/AxiBridge-white.svg',
  axiforge:  '/svg/axiforge.svg',
  axipulse:  '/svg/axipulse-white.svg',
  axitools:  '/svg/axitools-white.svg',
}

const APP_NAMES: Record<AppId, string> = {
  axibridge: 'AxiBridge',
  axiforge:  'AxiForge',
  axipulse:  'AxiPulse',
  axitools:  'AxiTools',
}

type ActionType = 'launch' | 'install' | 'update' | 'uninstall' | 'invite' | 'install-gear-lever' | 'open-gear-lever-flathub'

interface Props {
  state: AppState
  onAction: (action: ActionType, appId: AppId) => void
}

export function AppRow({ state, onAction }: Props) {
  const { id, installedVersion, latestVersion, downloadUrl, status, downloadProgress, gearLeverMissing } = state
  const isDownloading = status === 'downloading' || status === 'installing' || status === 'deleting'
  const hasUpdate = installedVersion && latestVersion && installedVersion !== latestVersion
  const notInstalled = !installedVersion
  const hasUpdateBorder = !!hasUpdate

  const statusText = () => {
    if (status === 'checking') return 'Checking...'
    if (status === 'downloading') return 'Downloading...'
    if (status === 'installing') return 'Installing...'
    if (status === 'deleting') return 'Removing...'
    if (status === 'error') return 'Error'
    if (id === 'axitools') return 'Discord Bot'
    if (notInstalled) return 'Not installed'
    if (hasUpdate) return `v${latestVersion} available ↑`
    return `v${installedVersion} · up to date`
  }

  const statusColor = () => {
    if (status === 'error') return '#e05252'
    if (hasUpdate) return 'var(--gold-bright)'
    if (notInstalled) return 'var(--text-faint)'
    if (id === 'axitools') return 'var(--text-dim)'
    return 'var(--text-dim)'
  }

  const renderAction = () => {
    if (isDownloading && downloadProgress) {
      return <ProgressBar progress={downloadProgress} />
    }
    if (gearLeverMissing) {
      return (
        <GearLeverPrompt
          appId={id as InstallableAppId}
          onInstall={() => onAction('install-gear-lever', id)}
          onOpenFlathub={() => onAction('open-gear-lever-flathub', id)}
        />
      )
    }
    if (id === 'axitools') {
      return (
        <button onClick={() => onAction('invite', id)} style={btnStyle('invite')}>
          Invite ↗
        </button>
      )
    }
    if (hasUpdate) {
      return (
        <button onClick={() => onAction('update', id)} style={btnStyle('update')}>
          Update
        </button>
      )
    }
    if (notInstalled && downloadUrl) {
      return (
        <button onClick={() => onAction('install', id)} style={btnStyle('install')}>
          Install
        </button>
      )
    }
    if (installedVersion) {
      return (
        <button onClick={() => onAction('launch', id)} style={btnStyle('launch')}>
          Launch
        </button>
      )
    }
    return null
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 6px',
      borderRadius: 6,
      marginBottom: 3,
      background: 'var(--panel)',
      border: `1px solid ${hasUpdateBorder ? 'var(--gold-border-bright)' : 'var(--border)'}`,
    }}>
      <img
        src={APP_ICONS[id]}
        alt={APP_NAMES[id]}
        style={{
          width: 30,
          height: 30,
          objectFit: 'contain',
          flexShrink: 0,
          opacity: notInstalled && id !== 'axitools' ? 0.3 : 1,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: notInstalled && id !== 'axitools' ? 'var(--text-dim)' : 'var(--text)',
        }}>
          {APP_NAMES[id]}
        </div>
        <div style={{ fontSize: 10, color: statusColor(), marginTop: 1 }}>
          {statusText()}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>
        {renderAction()}
      </div>
    </div>
  )
}

function btnStyle(variant: 'launch' | 'update' | 'install' | 'invite'): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 4,
    padding: '4px 12px',
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    border: 'none',
  }
  switch (variant) {
    case 'launch':  return { ...base, background: 'var(--gold)',        color: 'var(--bg)' }
    case 'update':  return { ...base, background: 'var(--gold-bright)', color: 'var(--bg)' }
    case 'install': return { ...base, background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', fontWeight: 400 }
    case 'invite':  return { ...base, background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold-border)' }
  }
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run src/__tests__/AppRow.test.tsx
```

Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppRow.tsx src/__tests__/AppRow.test.tsx
git commit -m "feat: AppRow component with all button states"
```

---

## Task 16: AppList view

**Files:**
- Create: `src/components/AppList.tsx`

- [ ] **Step 1: Create `src/components/AppList.tsx`**

```tsx
import React from 'react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { AppRow } from './AppRow'
import axiomLogo from '../../public/AxiOM-White.svg'

interface Props {
  states: AppState[]
  checking: boolean
  onOpenSettings: () => void
  onCheckUpdates: () => void
}

const APP_ORDER: AppId[] = ['axibridge', 'axiforge', 'axipulse', 'axitools']

export function AppList({ states, checking, onOpenSettings, onCheckUpdates }: Props) {
  const stateMap = Object.fromEntries(states.map(s => [s.id, s])) as Record<AppId, AppState>

  const handleAction = (action: string, appId: AppId) => {
    switch (action) {
      case 'launch':
        window.axiom.launch(appId)
        break
      case 'install':
      case 'update':
        window.axiom.install(appId as InstallableAppId)
        break
      case 'uninstall':
        window.axiom.uninstall(appId as InstallableAppId)
        break
      case 'invite':
        window.axiom.launch(appId)
        break
      case 'install-gear-lever':
        window.axiom.installGearLever(appId as InstallableAppId)
        break
      case 'open-gear-lever-flathub':
        window.axiom.openGearLeverFlathub()
        break
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        <img src={axiomLogo} alt="AxiOM" style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700, letterSpacing: '0.5px' }}>
          <span style={{ color: 'var(--text)' }}>Axi</span>
          <span style={{ color: 'var(--gold)' }}>OM</span>
        </span>
        <button
          onClick={onOpenSettings}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            fontSize: 14,
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
          }}
          title="Settings"
        >
          ⚙
        </button>
      </div>

      {/* App rows */}
      <div style={{ flex: 1 }}>
        {APP_ORDER.map(id => stateMap[id] && (
          <AppRow key={id} state={stateMap[id]} onAction={handleAction} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={onCheckUpdates}
          disabled={checking}
          style={{
            background: 'none',
            color: checking ? 'var(--text-faint)' : 'var(--text-dim)',
            fontSize: 10,
            padding: 0,
          }}
        >
          {checking ? 'Checking...' : 'Check for updates'}
        </button>
        <button
          onClick={() => window.axiom && (window as any).close?.()}
          style={{ background: 'none', color: 'var(--text-faint)', fontSize: 10, padding: 0 }}
        >
          Quit
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AppList.tsx
git commit -m "feat: AppList view with header, rows, and footer"
```

---

## Task 17: SettingsView

**Files:**
- Create: `src/components/SettingsView.tsx`
- Create: `src/__tests__/SettingsView.test.tsx`

- [ ] **Step 1: Write failing tests `src/__tests__/SettingsView.test.tsx`**

```tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsView } from '../components/SettingsView'

describe('SettingsView', () => {
  it('renders auto-start toggle and invite URL field', () => {
    render(<SettingsView onBack={vi.fn()} />)
    expect(screen.getByText(/auto-start/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/discord\.gg/i)).toBeInTheDocument()
  })

  it('calls setAutoStart when toggle is clicked', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    const toggle = screen.getByRole('checkbox', { name: /auto-start/i })
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(window.axiom.setAutoStart).toHaveBeenCalledWith(true)
    })
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<SettingsView onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run src/__tests__/SettingsView.test.tsx
```

Expected: FAIL — SettingsView not found.

- [ ] **Step 3: Create `src/components/SettingsView.tsx`**

```tsx
import React, { useState, useEffect } from 'react'
import { useConfig } from '../hooks/useConfig'

interface Props {
  onBack: () => void
}

export function SettingsView({ onBack }: Props) {
  const { config, updateConfig } = useConfig()
  const [autoStart, setAutoStartLocal] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.axiom.getAutoStart().then(setAutoStartLocal)
    window.axiom.getVersion().then(setVersion)
  }, [])

  const handleAutoStart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked
    setAutoStartLocal(enabled)
    await window.axiom.setAutoStart(enabled)
  }

  const handleInviteUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ axitoolsInviteUrl: e.target.value })
  }

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  }

  const label: React.CSSProperties = { color: 'var(--text-light)', fontSize: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: 'none',
            color: 'var(--text-dim)',
            fontSize: 16,
            padding: '2px 6px 2px 0',
            marginRight: 2,
          }}
        >
          ←
        </button>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: 'var(--text)' }}>Settings</span>
        </span>
      </div>

      {/* Auto-start */}
      <div style={row}>
        <label style={label} htmlFor="auto-start">Auto-start on login</label>
        <input
          id="auto-start"
          type="checkbox"
          checked={autoStart}
          onChange={handleAutoStart}
          aria-label="Auto-start on login"
          style={{ accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
        />
      </div>

      {/* AxiTools invite URL */}
      <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <span style={label}>AxiTools Discord Invite URL</span>
        <input
          type="text"
          value={config.axitoolsInviteUrl}
          onChange={handleInviteUrl}
          placeholder="https://discord.gg/..."
          style={{
            width: '100%',
            background: '#0a0b0e',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '6px 8px',
            color: 'var(--text)',
            fontSize: 11,
            outline: 'none',
          }}
        />
      </div>

      {/* Version */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>AxiOM v{version}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm pass**

```bash
npx vitest run src/__tests__/SettingsView.test.tsx
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsView.tsx src/__tests__/SettingsView.test.tsx
git commit -m "feat: SettingsView with auto-start toggle and AxiTools invite URL"
```

---

## Task 18: App root

**Files:**
- Create: `src/App.tsx`

- [ ] **Step 1: Create `src/App.tsx`**

```tsx
import React, { useState } from 'react'
import { AppList } from './components/AppList'
import { SettingsView } from './components/SettingsView'
import { useAppStates } from './hooks/useAppStates'

type View = 'list' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('list')
  const { states, checking, checkUpdates } = useAppStates()

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg)' }}>
      {view === 'list' && (
        <AppList
          states={states}
          checking={checking}
          onOpenSettings={() => setView('settings')}
          onCheckUpdates={checkUpdates}
        />
      )}
      {view === 'settings' && (
        <SettingsView onBack={() => setView('list')} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests passing.

- [ ] **Step 3: Build the full project**

```bash
npm run build:electron && npm run build:renderer
```

Expected: `dist/` and `dist-electron/` created, no errors.

- [ ] **Step 4: Smoke test in dev mode**

```bash
npm run dev
```

Expected: Electron window opens with tray icon. Popup appears on click. App rows render. Settings gear navigates to settings view.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: App root with list/settings view routing"
```

---

## Task 19: SVG assets

**Files:**
- Create: `public/svg/AxiBridge-white.svg` (copy from `../axibridge/public/svg/AxiBridge-white.svg`)
- Create: `public/svg/axiforge.svg` (copy from `../axiforge/public/svg/build_logo.svg`)
- Create: `public/svg/axipulse-white.svg` (copy from `../axipulse/public/svg/axipulse-white.svg`)
- Create: `public/svg/axitools-white.svg` (copy from `../axitools/media/AxiTools-White.svg`)

- [ ] **Step 1: Copy SVG assets**

```bash
mkdir -p public/svg
cp ../axibridge/public/svg/AxiBridge-white.svg public/svg/AxiBridge-white.svg
cp ../axiforge/public/svg/build_logo.svg public/svg/axiforge.svg
cp ../axipulse/public/svg/axipulse-white.svg public/svg/axipulse-white.svg
cp ../axitools/media/AxiTools-White.svg public/svg/axitools-white.svg
```

- [ ] **Step 2: Verify paths match AppRow.tsx**

The icon paths in `src/components/AppRow.tsx` are:
```
axibridge: '/svg/AxiBridge-white.svg'
axiforge:  '/svg/axiforge.svg'
axipulse:  '/svg/axipulse-white.svg'
axitools:  '/svg/axitools-white.svg'
```

Confirm each file exists in `public/svg/`.

- [ ] **Step 3: Commit**

```bash
git add public/svg/
git commit -m "feat: copy SVG app icons into public/svg"
```

---

## Task 20: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
<p align="center">
  <img src="public/AxiOM-White.png" alt="AxiOM Logo" width="180" />
</p>

<h1 align="center">AxiOM</h1>

<p align="center">
  <strong>One launcher for every Axi app.</strong>
</p>

<p align="center">
  <a href="https://github.com/darkharasho/axiom/releases/latest"><img src="https://img.shields.io/github/v/release/darkharasho/axiom?style=flat-square&color=c89850" alt="Latest Release" /></a>
  <a href="https://github.com/darkharasho/axiom/blob/main/LICENSE"><img src="https://img.shields.io/github/license/darkharasho/axiom?style=flat-square" alt="License" /></a>
  <a href="https://github.com/darkharasho/axiom/releases"><img src="https://img.shields.io/github/downloads/darkharasho/axiom/total?style=flat-square&color=c89850" alt="Downloads" /></a>
</p>

---

## All your Axi apps, one click away.

AxiOM lives in your system tray. Click the icon, see every app in the Axi suite — installed or not — with their current version and whether an update is waiting. Launch what you need, update what's behind, install what you're missing. No browser, no release pages, no manual downloads.

Open AxiOM. Click Launch. Done.

---

## Features

### Unified app management
AxiBridge, AxiForge, AxiPulse, and AxiTools in one place. Each app shows its installed version, the latest available release, and a single action button that does the right thing — Launch, Update, Install, or Invite.

### Automatic update detection
On startup, AxiOM checks GitHub releases for each app and compares against what's installed. A gold badge appears on the tray icon whenever updates are waiting. Click "Check for updates" anytime to refresh.

### Native install and update flows
On Windows, AxiOM downloads the NSIS installer and launches it — UAC, install path, and shortcuts handled exactly as you'd expect. On Linux, AppImages are downloaded to `~/Applications/` and handed off to Gear Lever for full desktop integration.

### Gear Lever integration (Linux)
AxiOM detects whether Gear Lever is installed. If it isn't, it offers to install it via Flatpak or open the Flathub page — right inside the popup, no terminal required.

### Tray-first, always there
Close the window, AxiOM keeps running. The tray icon is always one click from your app launcher. Set it to start on login and forget it's there until you need it.

### Consistent Axi design
Dark background, gold accents, Cinzel titles. AxiOM matches the look and feel of the apps it manages.

---

## Installation

### Linux

Download the latest `.AppImage` from [Releases](https://github.com/darkharasho/axiom/releases/latest), make it executable, and run it:

```bash
chmod +x AxiOM-*.AppImage
./AxiOM-*.AppImage
```

Or use Gear Lever to integrate it into your desktop.

### Windows

Download the latest `.exe` installer from [Releases](https://github.com/darkharasho/axiom/releases/latest) and run it.

---

## Development

```bash
git clone https://github.com/darkharasho/axiom
cd axiom
npm install
npm run dev
```

```bash
npm test          # Run unit tests
npm run typecheck # TypeScript check
npm run build     # Production build + package
```

---

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with marketing pitch, features, install instructions"
```

---

## Task 21: GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Linux AppImage
        run: npm run build:linux

      - name: Upload AppImage to release
        uses: softprops/action-gh-release@v2
        with:
          files: dist_out/*.AppImage
          draft: false
          prerelease: false

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Windows installer
        run: npm run build:win

      - name: Upload installer to release
        uses: softprops/action-gh-release@v2
        with:
          files: dist_out/*.exe
          draft: false
          prerelease: false
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/release.yml
git commit -m "ci: GitHub Actions release workflow for Linux AppImage and Windows NSIS"
```

---

## Task 22: Wire Quit button and final integration

**Files:**
- Modify: `electron/main.ts`
- Modify: `src/components/AppList.tsx`

- [ ] **Step 1: Add quit IPC to preload `electron/preload.ts`**

Add to `contextBridge.exposeInMainWorld('axiom', { ... })`:

```typescript
  quit: (): void => ipcRenderer.send('axiom:quit'),
```

- [ ] **Step 2: Handle quit in `electron/ipc-handlers.ts`**

Add inside `registerIpcHandlers`:

```typescript
  ipcMain.on('axiom:quit', () => {
    app.quit()
  })
```

- [ ] **Step 3: Update Quit button in `src/components/AppList.tsx`**

Replace the Quit button:

```tsx
<button
  onClick={() => window.axiom.quit()}
  style={{ background: 'none', color: 'var(--text-faint)', fontSize: 10, padding: 0 }}
>
  Quit
</button>
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests passing.

- [ ] **Step 5: Full dev smoke test**

```bash
npm run dev
```

Verify:
- Tray icon appears
- Click opens popup
- ⚙ opens settings, ← goes back
- Quit closes the app
- All four app rows render with correct names and icons

- [ ] **Step 6: Commit**

```bash
git add electron/preload.ts electron/ipc-handlers.ts src/components/AppList.tsx
git commit -m "feat: wire Quit button through IPC"
```

---

## Final checklist

- [ ] `npm test` — all green
- [ ] `npm run typecheck` — no errors
- [ ] `npm run build:linux` — AppImage produced in `dist_out/`
- [ ] `npm run build:win` (on Windows or CI) — NSIS `.exe` produced
- [ ] Tray icon visible on Linux and Windows
- [ ] Popup positions near tray icon and hides on blur
- [ ] All four app rows render with correct SVG icons
- [ ] Update detection fetches from GitHub and updates button state
- [ ] Install/Update/Launch/Uninstall flows functional per platform
- [ ] Gear Lever missing prompt shows both buttons on Linux
- [ ] Settings auto-start toggle persists across restarts
- [ ] AxiTools Invite URL saved and used when Invite ↗ is clicked
- [ ] GitHub Actions workflow triggers on `v*` tags and uploads both artifacts
