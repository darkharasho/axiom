export type AppId = 'axibridge' | 'axiforge' | 'axipulse' | 'axiam' | 'axitools'
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
  installedDir: string | null         // relative dir under the GW2 root where the DLL was found (e.g. '', 'bin64', 'addons')
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
  },
  arcdps: {
    gw2PathOverride: null,
    plugins: {},
  },
}
