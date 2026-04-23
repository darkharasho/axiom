import { ipcMain, shell, app, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
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
import { installWindows, installLinux, updateLinux, uninstallWindows, uninstallLinux } from './installer'
import { setAutoStart, getAutoStart } from './autostart'
import { isProcessRunning } from './process-check'

let appStates: Record<AppId, AppState> = buildInitialStates()
let lastCheckTime = 0

export function getLastCheckTime(): number { return lastCheckTime }

export function hasAnyUpdates(): boolean {
  return Object.values(appStates).some(s =>
    s.installedVersion != null && s.latestVersion != null && s.installedVersion !== s.latestVersion
  )
}

export async function runCheckUpdates(win: BrowserWindow): Promise<void> {
  const before = { ...appStates }
  for (const [id, meta] of Object.entries(APP_META)) {
    const appId = id as AppId
    if (!isInstallable(meta)) continue
    setState(win, appId, { status: 'checking' })
    const platform = process.platform === 'win32' ? 'win' : 'linux'
    const pattern = meta.assetPattern[platform]
    const release = await fetchLatestRelease(meta.repo, pattern)
    const detected = await detectInstalledVersion(meta.name, meta.configDir)
    const cfg = readConfig()
    const stored = cfg.apps[appId as InstallableAppId]?.installedVersion ?? null
    const installedVersion = detected === 'installed' ? stored : detected
    if (detected !== 'installed') setInstalledVersion(appId as InstallableAppId, installedVersion)
    setState(win, appId, {
      status: 'idle',
      installedVersion,
      latestVersion: release?.version ?? null,
      downloadUrl: release?.downloadUrl ?? null,
    })
  }
  lastCheckTime = Date.now()

  // Send notifications for newly discovered updates
  const cfg = readConfig()
  if (cfg.notifyOnUpdates && Notification.isSupported()) {
    for (const [id] of Object.entries(APP_META)) {
      const appId = id as AppId
      const prev = before[appId]
      const curr = appStates[appId]
      const hadUpdate = prev?.installedVersion && prev?.latestVersion && prev.installedVersion !== prev.latestVersion
      const hasUpdate = curr?.installedVersion && curr?.latestVersion && curr.installedVersion !== curr.latestVersion
      if (!hadUpdate && hasUpdate) {
        new Notification({
          title: 'AxiOM — Update Available',
          body: `${curr.id} ${curr.latestVersion} is available`,
        }).show()
      }
    }
  }
}

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

export function registerIpcHandlers(win: BrowserWindow, onCheckComplete?: () => void): void {
  ipcMain.handle('axiom:get-states', () => Object.values(appStates))

  ipcMain.handle('axiom:get-config', () => readConfig())
  ipcMain.handle('axiom:set-config', (_e, patch: Partial<ReturnType<typeof readConfig>>) => {
    patchConfig(patch)
    if ('trayBadge' in patch) onCheckComplete?.()
    return readConfig()
  })

  ipcMain.handle('axiom:get-auto-start', () => getAutoStart())
  ipcMain.handle('axiom:set-auto-start', (_e, enabled: boolean) => {
    setAutoStart(enabled)
    patchConfig({ autoStart: enabled })
  })

  ipcMain.handle('axiom:check-updates', async () => {
    await runCheckUpdates(win)
    onCheckComplete?.()
  })

  ipcMain.handle('axiom:install', async (_e, appId: InstallableAppId) => {
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    const { downloadUrl } = appStates[appId]
    if (!downloadUrl) return

    const isUpdate = !!appStates[appId].installedVersion

    if (process.platform === 'linux' && !isUpdate && !isGearLeverInstalled()) {
      setState(win, appId, { gearLeverMissing: true })
      return
    }

    setState(win, appId, { status: 'downloading', downloadProgress: { percent: 0, bytesReceived: 0, totalBytes: 0 } })
    try {
      if (process.platform === 'win32') {
        await installWindows(
          downloadUrl,
          (p) => setState(win, appId, { downloadProgress: p }),
          () => setState(win, appId, { status: 'installing', downloadProgress: undefined }),
        )
        const newVersion = appStates[appId].latestVersion
        setInstalledVersion(appId, newVersion)
        setState(win, appId, { status: 'idle', installedVersion: newVersion })
      } else {
        setState(win, appId, { status: 'installing' })
        if (isUpdate) {
          await updateLinux(meta.name, appId, downloadUrl, (p) => setState(win, appId, { downloadProgress: p }))
        } else {
          const appImagePath = await installLinux(downloadUrl, (p) => setState(win, appId, { downloadProgress: p }))
          openInGearLever(appImagePath)
        }
        const newVersion = appStates[appId].latestVersion
        setInstalledVersion(appId, newVersion)
        setState(win, appId, { status: 'idle', installedVersion: newVersion, downloadProgress: undefined })
      }
      onCheckComplete?.()
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  const AXITOOLS_INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1433732142629912626&permissions=8&integration_type=0&scope=bot'

  ipcMain.handle('axiom:launch', async (_e, appId: AppId) => {
    if (appId === 'axitools') {
      shell.openExternal(AXITOOLS_INVITE_URL)
      return
    }
    activateHyperMode()
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    setState(win, appId, { status: 'launching' })
    setTimeout(() => setState(win, appId, { status: 'idle' }), 3000)
    if (process.platform === 'linux') {
      const { spawn } = await import('child_process')
      const os = await import('os')
      const pathMod = await import('path')
      // Prefer gtk-launch with GearLever's .desktop file — it applies the correct
      // Exec flags (DESKTOPINTEGRATION=1, --no-sandbox) that Electron AppImages need
      const desktopFile = pathMod.join(os.homedir(), '.local', 'share', 'applications', `${appId}.desktop`)
      const fs = await import('fs')
      if (fs.existsSync(desktopFile)) {
        // Use systemd-run to launch in a fresh user scope, escaping AxiOM's cgroup.
        // This matches how DE app launchers work and avoids GPU sandbox failures in
        // newer Electron versions (37+) when launched from a terminal cgroup.
        spawn('systemd-run', ['--user', '--scope', '--', 'env', '-u', 'VITE_DEV_SERVER_URL', 'gtk-launch', appId], { detached: true, stdio: 'ignore' }).unref()
        return
      }
      // Fallback: spawn AppImage directly
      const searchDirs = [
        pathMod.join(os.homedir(), 'AppImages'),
        pathMod.join(os.homedir(), 'Applications'),
        pathMod.join(os.homedir(), 'Downloads'),
        pathMod.join(os.homedir(), '.local', 'bin'),
        os.homedir(),
      ]
      for (const dir of searchDirs) {
        try {
          const files = fs.readdirSync(dir)
          const appImage = files.find(f => f.toLowerCase().endsWith('.appimage') && f.toLowerCase().includes(meta.name.toLowerCase()))
          if (appImage) {
            spawn(pathMod.join(dir, appImage), [], { detached: true, stdio: 'ignore' }).unref()
            break
          }
        } catch { /* ignore */ }
      }
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
        const fs = await import('fs')
        const os = await import('os')
        const pathMod = await import('path')
        const searchDirs = [
          pathMod.join(os.homedir(), 'AppImages'),
          pathMod.join(os.homedir(), 'Applications'),
          pathMod.join(os.homedir(), 'Downloads'),
          pathMod.join(os.homedir(), '.local', 'bin'),
          os.homedir(),
        ]
        for (const dir of searchDirs) {
          try {
            const files = fs.readdirSync(dir)
            const appImage = files.find(f => f.toLowerCase().endsWith('.appimage') && f.toLowerCase().includes(meta.name.toLowerCase()))
            if (appImage) { uninstallLinux(pathMod.join(dir, appImage)); break }
          } catch { /* ignore */ }
        }
      }
      setInstalledVersion(appId, null)
      setState(win, appId, { status: 'idle', installedVersion: null })
    } catch (err) {
      setState(win, appId, { status: 'error', errorMessage: String(err) })
    }
  })

  ipcMain.handle('axiom:install-gear-lever', async (_e, appId: InstallableAppId) => {
    setState(win, appId, { status: 'installing', gearLeverMissing: false })
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

  ipcMain.handle('axiom:open-external', (_e, url: string) => {
    shell.openExternal(url)
  })

  type SelfUpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'
  const pushSelfUpdate = (status: SelfUpdateStatus, extra?: { version?: string; error?: string }) =>
    win.webContents.send('axiom:self-update-status', { status, ...extra })

  autoUpdater.on('checking-for-update',  ()     => pushSelfUpdate('checking'))
  autoUpdater.on('update-available',     (info) => pushSelfUpdate('available',     { version: info.version }))
  autoUpdater.on('update-not-available', ()     => pushSelfUpdate('not-available'))
  autoUpdater.on('download-progress',    ()     => pushSelfUpdate('downloading'))
  autoUpdater.on('update-downloaded',    (info) => pushSelfUpdate('ready',         { version: info.version }))
  autoUpdater.on('error',                (err)  => pushSelfUpdate('error',         { error: err.message }))

  ipcMain.handle('axiom:check-self-update', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates()
    } else {
      pushSelfUpdate('not-available')
    }
  })

  ipcMain.handle('axiom:install-self-update', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('axiom:browse-files', async (_e, appId: InstallableAppId) => {
    const meta = APP_META[appId]
    if (!isInstallable(meta)) return
    if (process.platform === 'linux') {
      const fs = await import('fs')
      const os = await import('os')
      const pathMod = await import('path')
      const searchDirs = [
        pathMod.join(os.homedir(), 'AppImages'),
        pathMod.join(os.homedir(), 'Applications'),
        pathMod.join(os.homedir(), 'Downloads'),
        pathMod.join(os.homedir(), '.local', 'bin'),
        os.homedir(),
      ]
      for (const dir of searchDirs) {
        try {
          const files = fs.readdirSync(dir)
          const appImage = files.find(f => f.toLowerCase().endsWith('.appimage') && f.toLowerCase().includes(meta.name.toLowerCase()))
          if (appImage) { shell.showItemInFolder(pathMod.join(dir, appImage)); return }
        } catch { /* ignore */ }
      }
    } else {
      const { execSync } = await import('child_process')
      try {
        const ps = `(Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*${meta.name}*' } | Select-Object -First 1).InstallLocation`
        const loc = execSync(`powershell -Command "${ps}"`, { encoding: 'utf8', timeout: 5000 }).trim()
        if (loc) shell.openPath(loc)
      } catch { /* ignore */ }
    }
  })

  ipcMain.handle('axiom:get-version', () => app.getVersion())

  ipcMain.on('axiom:quit', () => {
    app.quit()
  })

  const POLL_NORMAL_MS = 3000
  const POLL_HYPER_MS = 500
  const HYPER_DURATION_MS = 10000

  let hyperModeUntil = 0
  let pollTimer: ReturnType<typeof setTimeout> | null = null

  function activateHyperMode() {
    hyperModeUntil = Date.now() + HYPER_DURATION_MS
  }

  async function pollRunningStates() {
    const entries = Object.entries(APP_META).filter(([id, meta]) => {
      const appId = id as AppId
      return isInstallable(meta) && appStates[appId].installedVersion
    })
    await Promise.all(entries.map(async ([id, meta]) => {
      const appId = id as AppId
      const running = await isProcessRunning(meta.name)
      if (running !== appStates[appId].isRunning) {
        setState(win, appId, { isRunning: running })
        activateHyperMode()
      }
    }))
  }

  function scheduleNextPoll() {
    const delay = Date.now() < hyperModeUntil ? POLL_HYPER_MS : POLL_NORMAL_MS
    pollTimer = setTimeout(async () => {
      await pollRunningStates()
      scheduleNextPoll()
    }, delay)
  }

  pollRunningStates()
  scheduleNextPoll()
  win.on('closed', () => { if (pollTimer) clearTimeout(pollTimer) })
}
