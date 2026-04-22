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
  configDir: string  // directory name under ~/.config/ where axiom-version is written
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
    configDir: 'axibridge',
    assetPattern: {
      win: /AxiBridge.*Setup.*\.exe$/i,
      linux: /AxiBridge.*\.AppImage$/i,
    },
  },
  axiforge: {
    id: 'axiforge',
    name: 'AxiForge',
    repo: 'darkharasho/axiforge',
    configDir: 'axiforge-desktop',
    assetPattern: {
      win: /AxiForge.*Setup.*\.exe$/i,
      linux: /AxiForge.*\.AppImage$/i,
    },
  },
  axipulse: {
    id: 'axipulse',
    name: 'AxiPulse',
    repo: 'darkharasho/axipulse',
    configDir: 'axipulse',
    assetPattern: {
      win: /AxiPulse.*Setup.*\.exe$/i,
      linux: /AxiPulse.*\.AppImage$/i,
    },
  },
  axiam: {
    id: 'axiam',
    name: 'AxiAM',
    repo: 'darkharasho/axiam',
    configDir: 'axiam',
    assetPattern: {
      win: /AxiAM.*Setup.*\.exe$/i,
      linux: /AxiAM.*\.AppImage$/i,
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
