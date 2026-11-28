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
  // Beta entry that only ships rc builds: always offer prereleases for it,
  // whatever the global "prerelease apps" setting says. Pair with an allowlist.
  prerelease?: boolean
  // A native app, not Electron: its .desktop entry gets no Electron flags (AxiDPS
  // rejects --no-sandbox and exits), and only a process named exactly `name` counts
  // as it running (AxiDPS's own axidps-core and axidps-overlay must not).
  native?: boolean
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
  axidps: { id: 'axidps', name: 'AxiDPS', repo: 'darkharasho/axidps-releases', configDir: 'axidps', allowlist: ['darkharasho', 'skavok', 'gw2dui', 'Revan-Malice'], prerelease: true, native: true, assetPattern: { win: /axidps.*Setup.*\.exe$/i, linux: /axidps.*\.AppImage$/i } },
  axitools: {
    id: 'axitools',
    name: 'AxiTools',
    repo: null,
  },
}

export function isInstallable(meta: AppMeta): meta is InstallableAppMeta {
  return meta.repo !== null
}

// remoteAllows: the signed-in user's hashed id is on the app's remote allowlist
// (see remoteAllowlist.ts). It never opens a private-repo app: those also need
// GitHub collaborator access, which a flag can't grant.
export function isAppVisible(meta: AppMeta, login: string | null, remoteAllows = false): boolean {
  const allowlist = 'allowlist' in meta ? meta.allowlist : undefined
  if (!allowlist) return true
  if (login != null && allowlist.includes(login)) return true
  return !('private' in meta && meta.private === true) && remoteAllows
}

// The renderer must never learn that a gated app exists for a login that can't
// see it, so the main process filters before every send.
export function visibleAppStates<T extends { id: AppId }>(
  states: readonly T[],
  login: string | null,
  remoteAllows: (id: AppId) => boolean = () => false,
): T[] {
  return states.filter(s => isAppVisible(APP_META[s.id], login, remoteAllows(s.id)))
}
