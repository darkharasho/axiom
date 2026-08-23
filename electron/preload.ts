import { contextBridge, ipcRenderer } from 'electron'
import type { AppId, InstallableAppId, Config, AppState, ArcdpsState, GithubAuthState } from './shared/types'

// Register one listener and hand back a teardown that removes only that listener.
// `removeAllListeners(channel)` would wipe every subscriber on the channel, which
// breaks whenever two components listen at once (e.g. useSelfUpdate is mounted in
// both App and SettingsView — closing settings used to kill App's subscription).
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: unknown, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => { ipcRenderer.removeListener(channel, listener) }
}

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

  onSelfUpdateStatus: (cb: (data: { status: string; version?: string; error?: string }) => void) =>
    subscribe('axiom:self-update-status', cb),

  quit: (): void => ipcRenderer.send('axiom:quit'),

  onStatesUpdated: (cb: (states: AppState[]) => void) =>
    subscribe('axiom:states-updated', cb),

  onRequestCheckUpdates: (cb: () => void) =>
    subscribe('axiom:request-check-updates', () => cb()),

  onGearLeverProgress: (cb: (chunk: string) => void) =>
    subscribe('axiom:gear-lever-progress', cb),

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

  onArcdpsStateUpdated: (cb: (state: ArcdpsState) => void) =>
    subscribe('arcdps:state-updated', cb),

  githubGetStatus: (): Promise<GithubAuthState> =>
    ipcRenderer.invoke('github:status'),

  githubAuthBegin: (): Promise<{ userCode: string; verificationUri: string; deviceCode: string; interval: number; expiresIn: number }> =>
    ipcRenderer.invoke('github:auth-begin'),

  githubAuthComplete: (deviceCode: string, interval: number, expiresIn: number): Promise<{ ok: boolean; login?: string; error?: string }> =>
    ipcRenderer.invoke('github:auth-complete', deviceCode, interval, expiresIn),

  githubSignOut: (): Promise<GithubAuthState> =>
    ipcRenderer.invoke('github:sign-out'),

  onGithubStatusUpdated: (cb: (state: GithubAuthState) => void) =>
    subscribe('github:status-updated', cb),
})
