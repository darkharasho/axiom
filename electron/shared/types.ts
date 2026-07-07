export type AppId = 'axibridge' | 'axiforge' | 'axipulse' | 'axiam' | 'axivale' | 'axiroster' | 'axistream' | 'axitools'
export type InstallableAppId = Exclude<AppId, 'axitools'>

/**
 * Sentinel `installedVersion`: the app is installed but its version could not be
 * determined (e.g. a manually-installed AppImage whose filename carries no version).
 * Treated as "installed" by the UI, but never compared against the latest release.
 */
export const INSTALLED_VERSION_UNKNOWN = 'installed'

/**
 * Single source of truth for "this app should signal an update available".
 * The unknown-version sentinel must NOT count as an update — otherwise a
 * manually-installed app (whose version we can't read) lights the tray dot
 * forever, since `'installed' !== '<latest>'` is always true.
 */
export function appHasUpdate(
  installedVersion: string | null | undefined,
  latestVersion: string | null | undefined,
): boolean {
  return (
    !!installedVersion &&
    installedVersion !== INSTALLED_VERSION_UNKNOWN &&
    !!latestVersion &&
    installedVersion !== latestVersion
  )
}

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
  | 'launching'
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
  isRunning?: boolean
}

export interface GithubAuthState {
  signedIn: boolean
  login: string | null
  unlocked: boolean // login is in the private-tools allowlist
}

export interface ConfigApp {
  installedVersion: string | null
  lastChecked: string | null
}

export type ArcdpsPluginStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'error'

export interface ArcdpsPluginState {
  id: string                          // matches ArcPluginMeta.id
  name: string
  description: string
  alwaysShow: boolean
  installed: boolean
  disabled: boolean                   // matched a .dll_N / .disabled / .old variant
  installedDir: string | null         // relative dir under the GW2 root where the DLL was found (e.g. '', 'bin64', 'addons')
  installedTag: string | null         // recorded by AxiOM on install; null if unknown/manual
  installedAt: string | null          // ISO timestamp from AxiOM install
  latestTag: string | null            // 'latest' arcdps for the core; semver tag for github
  downloadUrl: string | null
  upToDate: boolean | null            // null = unknown
  localBuild: boolean                 // digest mismatch but DLL newer than the latest release — a dev build, not a stale install
  status: ArcdpsPluginStatus
  errorMessage?: string
  downloadProgress?: DownloadProgress
}

// Single source of truth for "this arcdps plugin should signal an update".
// A disabled plugin (the user turned it off via a .disabled/.old/.dll_N rename)
// must NOT light the update dot — otherwise the tray badge shows an "update
// available" for something the user has deliberately shelved.
export function arcdpsPluginHasUpdate(p: Pick<ArcdpsPluginState, 'upToDate' | 'disabled'>): boolean {
  return p.upToDate === false && !p.disabled
}

export interface ArcdpsState {
  gw2Path: string | null
  gw2PathSource: 'axiam' | 'auto' | 'manual' | 'none'
  overrideError: string | null
  plugins: ArcdpsPluginState[]
}

export interface ConfigArcdps {
  gw2PathOverride: string | null
  plugins: Record<string, { installedTag: string | null; installedAt: string | null }>
}

export interface Config {
  autoStart: boolean
  notifyOnUpdates: boolean
  trayBadge: boolean
  apps: Record<InstallableAppId, ConfigApp>
  arcdps: ConfigArcdps
}

export interface ReleaseInfo {
  version: string
  downloadUrl: string
  assetSize?: number          // bytes of the matched release asset
  assetDigest?: string        // "<algo>:<hex>" digest of the asset (e.g. "sha256:…")
  publishedAt?: string        // ISO timestamp of the release
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
    axivale:    { installedVersion: null, lastChecked: null },
    axiroster:  { installedVersion: null, lastChecked: null },
    axistream:  { installedVersion: null, lastChecked: null },
  },
  arcdps: {
    gw2PathOverride: null,
    plugins: {},
  },
}
