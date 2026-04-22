import { ipcMain, shell, app } from 'electron'
import type { BrowserWindow } from 'electron'
import type { AppId, InstallableAppId, AppState } from './shared/types'
import { APP_META, isInstallable } from './apps'
import { readConfig, patchConfig, setInstalledVersion } from './config'
import { fetchLatestRelease } from './github'
import { detectInstalledVersion } from './detect'
import {
  isGearLeverInstalled,
  installGearLever,
  openInGearLever,
} from './gearlever'
import { installWindows, installLinux, uninstallWindows, uninstallLinux } from './installer'
import { setAutoStart, getAutoStart } from './autostart'

let appStates: Record<AppId, AppState> = buildInitialStates()

function buildInitialStates(): Record<AppId, AppState> {
  const cfg = readConfig()
  const states: Partial<Record<AppId, AppState>> = {}
  for (const [id, meta] of Object.entries(APP_META)) {
    const appId = id as AppId
    const installedVersion = isInstallable(meta)
      ? (cfg.apps[appId as InstallableAppId]?.installedVersion ?? null)
      : null
    states[appId] = {
      id: appId,
      installedVersion,
      latestVersion: null,
      downloadUrl: null,
      status: 'idle',
    }
  }
  return states as Record<AppId, AppState>
}

function pushStates(win: BrowserWindow): void {
  win.webContents.send('axiom:states-updated', Object.values(appStates))
}

function setState(win: BrowserWindow, appId: AppId, patch: Partial<AppState>): void {
  appStates[appId] = { ...appStates[appId], ...patch }
  pushStates(win)
}

export function registerIpcHandlers(win: BrowserWindow): void {
  ipcMain.handle('axiom:get-states', () => Object.values(appStates))

  ipcMain.handle('axiom:get-config', () => readConfig())
  ipcMain.handle('axiom:set-config', (_e, patch: Partial<ReturnType<typeof readConfig>>) => {
    patchConfig(patch)
    return readConfig()
  })

  ipcMain.handle('axiom:get-auto-start', () => getAutoStart())
  ipcMain.handle('axiom:set-auto-start', (_e, enabled: boolean) => {
    setAutoStart(enabled)
    patchConfig({ autoStart: enabled })
  })

  ipcMain.handle('axiom:check-updates', async () => {
    for (const [id, meta] of Object.entries(APP_META)) {
      const appId = id as AppId
      if (!isInstallable(meta)) continue
      setState(win, appId, { status: 'checking' })
      const platform = process.platform === 'win32' ? 'win' : 'linux'
      const pattern = meta.assetPattern[platform]
      const release = await fetchLatestRelease(meta.repo, pattern)
      const installedVersion = await detectInstalledVersion(meta.name)
      setInstalledVersion(appId as InstallableAppId, installedVersion)
      setState(win, appId, {
        status: 'idle',
        installedVersion,
        latestVersion: release?.version ?? null,
        downloadUrl: release?.downloadUrl ?? null,
      })
    }
  })

  ipcMain.handle('axiom:install', async (_e, appId: InstallableAppId) => {
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    const { downloadUrl } = appStates[appId]
    if (!downloadUrl) return

    if (process.platform === 'linux' && !isGearLeverInstalled()) {
      setState(win, appId, { gearLeverMissing: true })
      return
    }

    setState(win, appId, { status: 'downloading', downloadProgress: { percent: 0, bytesReceived: 0, totalBytes: 0 } })
    try {
      if (process.platform === 'win32') {
        await installWindows(downloadUrl, (p) => setState(win, appId, { downloadProgress: p }))
      } else {
        setState(win, appId, { status: 'installing' })
        const appImagePath = await installLinux(downloadUrl, (p) => setState(win, appId, { downloadProgress: p }))
        openInGearLever(appImagePath)
        const newVersion = appStates[appId].latestVersion
        setInstalledVersion(appId, newVersion)
        setState(win, appId, { status: 'idle', installedVersion: newVersion, downloadProgress: undefined })
      }
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  ipcMain.handle('axiom:launch', async (_e, appId: AppId) => {
    if (appId === 'axitools') {
      const cfg = readConfig()
      if (cfg.axitoolsInviteUrl) shell.openExternal(cfg.axitoolsInviteUrl)
      return
    }
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    if (process.platform === 'linux') {
      const { execSync } = await import('child_process')
      try {
        execSync(`flatpak run it.mijorus.gearlever --launch "${meta.name}"`, { stdio: 'ignore' })
      } catch { /* ignore */ }
    } else {
      const { execSync } = await import('child_process')
      try {
        const ps = `(Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*${meta.name}*' } | Select-Object -First 1).InstallLocation`
        const loc = execSync(`powershell -Command "${ps}"`, { encoding: 'utf8', timeout: 5000 }).trim()
        if (loc) {
          const { readdirSync } = await import('fs')
          const exes = readdirSync(loc).filter(f => f.endsWith('.exe') && !f.includes('Uninstall'))
          if (exes[0]) shell.openPath(`${loc}\\${exes[0]}`)
        }
      } catch { /* ignore */ }
    }
  })

  ipcMain.handle('axiom:uninstall', async (_e, appId: InstallableAppId) => {
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    setState(win, appId, { status: 'deleting' })
    try {
      if (process.platform === 'win32') {
        await uninstallWindows(meta.name)
      } else {
        const { execSync } = await import('child_process')
        try {
          execSync(`flatpak run it.mijorus.gearlever --remove "${meta.name}"`, { stdio: 'ignore' })
        } catch {
          const fs = await import('fs')
          const os = await import('os')
          const pathMod = await import('path')
          const appsDir = pathMod.join(os.homedir(), 'Applications')
          const files = fs.readdirSync(appsDir)
          const appImage = files.find(f => f.toLowerCase().includes(meta.name.toLowerCase()))
          if (appImage) uninstallLinux(pathMod.join(appsDir, appImage))
        }
      }
      setInstalledVersion(appId, null)
      setState(win, appId, { status: 'idle', installedVersion: null })
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  ipcMain.handle('axiom:install-gear-lever', async (_e, appId: InstallableAppId) => {
    setState(win, appId, { status: 'installing' })
    try {
      await installGearLever((chunk) => win.webContents.send('axiom:gear-lever-progress', chunk))
      setState(win, appId, { status: 'idle', gearLeverMissing: false })
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  ipcMain.handle('axiom:open-gear-lever-flathub', () => {
    shell.openExternal('https://flathub.org/apps/it.mijorus.gearlever')
  })

  ipcMain.handle('axiom:get-version', () => app.getVersion())

  ipcMain.on('axiom:quit', () => {
    app.quit()
  })
}
