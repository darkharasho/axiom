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
  allowlist?: readonly string[]  // GitHub logins gated to this app; hidden from everyone else. Absent = public.
  // Private GitHub repo: release lookups and downloads need the signed-in user's
  // repo-scoped token, and only ever send it to this repo's API paths (see
  // tokenScope.ts). Always pair with an allowlist, which decides visibility.
  private?: boolean
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
    assetPattern: {
      win: /AxiStream.*\.exe$/i,
      linux: /AxiStream.*\.AppImage$/i,
    },
  },
  axiadmin: {
    id: 'axiadmin',
    name: 'AxiAdmin',
    repo: 'darkharasho/axiadmin',
    configDir: 'axiadmin',
    private: true,
    allowlist: ['darkharasho'],
    assetPattern: {
      win: /AxiAdmin.*Setup.*\.exe$/i,
      linux: /AxiAdmin.*\.AppImage$/i,
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

export function isAppVisible(meta: AppMeta, login: string | null): boolean {
  const allowlist = 'allowlist' in meta ? meta.allowlist : undefined
  if (!allowlist) return true
  return login != null && allowlist.includes(login)
}

// The renderer must never learn that a gated app exists for a login that can't
// see it, so the main process filters before every send.
export function visibleAppStates<T extends { id: AppId }>(states: readonly T[], login: string | null): T[] {
  return states.filter(s => isAppVisible(APP_META[s.id], login))
}
