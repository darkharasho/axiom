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
    axiam:     { installedVersion: null, lastChecked: null },
  },
}
