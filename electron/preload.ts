import { contextBridge, ipcRenderer } from 'electron'
import type { AppId, InstallableAppId, Config, AppState, ArcdpsState, GithubAuthState } from './shared/types'

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

  browseFiles: (appId: InstallableAppId): Promise<void> =>
    ipcRenderer.invoke('axiom:browse-files', appId),

  installGearLever: (appId: InstallableAppId): Promise<void> =>
    ipcRenderer.invoke('axiom:install-gear-lever', appId),

  openGearLeverFlathub: (): Promise<void> =>
    ipcRenderer.invoke('axiom:open-gear-lever-flathub'),

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke('axiom:get-version'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('axiom:open-external', url),

  copyText: (text: string): Promise<void> =>
    ipcRenderer.invoke('axiom:copy-text', text),

  getSelfUpdateStatus: (): Promise<{ status: string; version?: string; error?: string }> =>
    ipcRenderer.invoke('axiom:get-self-update-status'),

  checkSelfUpdate: (): Promise<void> =>
    ipcRenderer.invoke('axiom:check-self-update'),

  installSelfUpdate: (): Promise<void> =>
    ipcRenderer.invoke('axiom:install-self-update'),

  onSelfUpdateStatus: (cb: (data: { status: string; version?: string; error?: string }) => void) => {
    ipcRenderer.on('axiom:self-update-status', (_e, data) => cb(data))
    return () => ipcRenderer.removeAllListeners('axiom:self-update-status')
  },

  quit: (): void => ipcRenderer.send('axiom:quit'),

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

  getArcdpsState: (): Promise<ArcdpsState> =>
    ipcRenderer.invoke('arcdps:get-state'),

  checkArcdpsUpdates: (): Promise<void> =>
    ipcRenderer.invoke('arcdps:check-updates'),

  installArcdpsPlugin: (id: string): Promise<void> =>
    ipcRenderer.invoke('arcdps:install', id),

  setArcdpsPluginDisabled: (id: string, disabled: boolean): Promise<void> =>
    ipcRenderer.invoke('arcdps:set-disabled', id, disabled),

  setGw2Path: (p: string | null): Promise<void> =>
    ipcRenderer.invoke('arcdps:set-gw2-path', p),

  pickGw2Folder: (): Promise<string | null> =>
    ipcRenderer.invoke('arcdps:pick-gw2-folder'),

  onArcdpsStateUpdated: (cb: (state: ArcdpsState) => void) => {
    ipcRenderer.on('arcdps:state-updated', (_e, state) => cb(state))
    return () => ipcRenderer.removeAllListeners('arcdps:state-updated')
  },

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
})
