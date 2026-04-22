import type { AppState, AppId, InstallableAppId, Config } from '../electron/shared/types'

declare global {
  interface Window {
    axiom: {
      getStates: () => Promise<AppState[]>
      getConfig: () => Promise<Config>
      setConfig: (patch: Partial<Config>) => Promise<Config>
      getAutoStart: () => Promise<boolean>
      setAutoStart: (enabled: boolean) => Promise<void>
      checkUpdates: () => Promise<void>
      install: (appId: InstallableAppId) => Promise<void>
      launch: (appId: AppId) => Promise<void>
      uninstall: (appId: InstallableAppId) => Promise<void>
      installGearLever: (appId: InstallableAppId) => Promise<void>
      openGearLeverFlathub: () => Promise<void>
      getVersion: () => Promise<string>
      quit: () => void
      onStatesUpdated: (cb: (states: AppState[]) => void) => () => void
      onRequestCheckUpdates: (cb: () => void) => () => void
      onGearLeverProgress: (cb: (chunk: string) => void) => () => void
    }
  }
}

export {}
