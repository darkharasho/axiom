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
})
