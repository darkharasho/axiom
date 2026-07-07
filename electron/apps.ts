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
  private?: boolean   // gated behind the GitHub allowlist; hidden from normal users
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
      win: /AxiForge.*\.exe$/i,
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
  axivale: {
    id: 'axivale',
    name: 'AxiVale',
    repo: 'darkharasho/axivale',
    configDir: 'axivale',
    assetPattern: {
      win: /AxiVale.*Setup.*\.exe$/i,
      linux: /AxiVale.*\.AppImage$/i,
    },
  },
  axiroster: {
    id: 'axiroster',
    name: 'AxiRoster',
    repo: 'darkharasho/axiroster',
    configDir: 'axiroster',
    // artifactName is "AxiRoster-${version}-${os}-${arch}.${ext}" for every
    // target, so the Windows asset has no "Setup" in its name.
    assetPattern: {
      win: /AxiRoster.*\.exe$/i,
      linux: /AxiRoster.*\.AppImage$/i,
    },
  },
  axistream: {
    id: 'axistream',
    name: 'AxiStream',
    repo: 'darkharasho/axistream',
    // configDir is the Electron userData dirname on Linux, which equals the npm package name
    configDir: '@axistream/app',
    private: true,
    assetPattern: {
      win: /AxiStream.*\.exe$/i,
      linux: /AxiStream.*\.AppImage$/i,
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

export function isAppVisible(meta: AppMeta, unlocked: boolean): boolean {
  const isPrivate = 'private' in meta && meta.private === true
  return !isPrivate || unlocked
}
