import { ipcMain, shell, app, Notification, dialog, clipboard } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { BrowserWindow } from 'electron'
import type { AppId, InstallableAppId, AppState, ArcdpsState } from './shared/types'
import { APP_META, isInstallable, isAppVisible } from './apps'
import { readConfig, patchConfig, setInstalledVersion } from './config'
import { fetchLatestRelease } from './github'
import { beginDeviceAuth, pollForToken, fetchGithubLogin, GITHUB_DEVICE_CLIENT_ID } from './githubAuth'
import { IdentityStore, electronCipher } from './secrets'
import { isPrivateUnlocked } from './privateTools'
import { detectInstalled } from './detect'
import { resolveInstalledVersion } from './installedVersion'
import { appImageMatchesAsset } from './identifyAppImage'
import { INSTALLED_VERSION_UNKNOWN } from './shared/types'
import {
  isGearLeverInstalled,
  installGearLever,
  openInGearLever,
} from './gearlever'
import { installWindows, installLinux, updateLinux, uninstallWindows, uninstallLinux, downloadFile } from './installer'
import { setAutoStart, getAutoStart } from './autostart'
import { isProcessRunning } from './process-check'
import * as fsSync from 'fs'
import * as osSync from 'os'
import * as pathSync from 'path'
import {
  resolveGw2Path,
  defaultAxiamConfigPath,
  defaultGw2Candidates,
  buildArcdpsState,
  installPluginFile,
  checkArcdpsCoreUpdate,
} from './arcdps'
import { getPluginMeta } from './arcdpsRegistry'

function writeAxiomVersionFile(configDir: string | undefined, version: string | null): void {
  if (process.platform !== 'linux' || !configDir || !version) return
  try {
    const dir = pathSync.join(osSync.homedir(), '.config', configDir)
    fsSync.mkdirSync(dir, { recursive: true })
    fsSync.writeFileSync(pathSync.join(dir, 'axiom-version'), version, 'utf-8')
  } catch { /* ignore */ }
}

let appStates: Record<AppId, AppState> = buildInitialStates()
let lastCheckTime = 0
let arcdpsState: ArcdpsState = { gw2Path: null, gw2PathSource: 'none', overrideError: null, plugins: [] }

let identityStore: IdentityStore | null = null
let githubToken: string | null = null
let githubLogin: string | null = null
let unlocked = false

function githubStatus(): import('./shared/types').GithubAuthState {
  return { signedIn: githubToken != null, login: githubLogin, unlocked }
}

function pushGithubStatus(win: BrowserWindow): void {
  win.webContents.send('github:status-updated', githubStatus())
}

async function getIdentityStore(): Promise<IdentityStore> {
  if (!identityStore) {
    const cipher = await electronCipher()
    identityStore = new IdentityStore(pathSync.join(app.getPath('userData'), 'github-identity.json'), cipher)
  }
  return identityStore
}

function applyIdentity(token: string | null, login: string | null): void {
  githubToken = token
  githubLogin = login
  unlocked = isPrivateUnlocked(login)
}

export function getLastCheckTime(): number { return lastCheckTime }

export function hasAnyUpdates(): boolean {
  const appsHave = Object.entries(appStates).some(([id, s]) => {
    const meta = APP_META[id as AppId]
    if (!isAppVisible(meta, unlocked)) return false
    return s.installedVersion != null && s.latestVersion != null && s.installedVersion !== s.latestVersion
  })
  const arcdpsHave = arcdpsState.plugins.some(p => p.upToDate === false)
  return appsHave || arcdpsHave
}

function pushArcdps(win: BrowserWindow): void {
  win.webContents.send('arcdps:state-updated', arcdpsState)
}

function setArcdpsPlugin(win: BrowserWindow, id: string, patch: Partial<ArcdpsState['plugins'][number]>): void {
  arcdpsState = {
    ...arcdpsState,
    plugins: arcdpsState.plugins.map(p => p.id === id ? { ...p, ...patch } : p),
  }
  pushArcdps(win)
}

async function refreshArcdps(win: BrowserWindow): Promise<void> {
  const cfg = readConfig()
  const resolved = resolveGw2Path({
    override: cfg.arcdps.gw2PathOverride,
    axiamConfigPath: defaultAxiamConfigPath(),
    candidates: defaultGw2Candidates(),
  })
  arcdpsState = await buildArcdpsState({
    gw2Path: resolved.path,
    gw2PathSource: resolved.source,
    overrideError: resolved.overrideError,
    recordedInstalls: cfg.arcdps.plugins,
    fetchRelease: (repo, pattern) => fetchLatestRelease(repo, pattern, githubToken ?? undefined),
    fetchCoreMd5: (dll) => checkArcdpsCoreUpdate(dll),
  })
  pushArcdps(win)
}

export async function runCheckUpdates(win: BrowserWindow): Promise<void> {
  const before = { ...appStates }
  for (const [id, meta] of Object.entries(APP_META)) {
    const appId = id as AppId
    if (!isInstallable(meta)) continue
    if (!isAppVisible(meta, unlocked)) continue
    setState(win, appId, { status: 'checking' })
    const platform = process.platform === 'win32' ? 'win' : 'linux'
    const pattern = meta.assetPattern[platform]
    const release = await fetchLatestRelease(meta.repo, pattern, githubToken ?? undefined)
    const detected = await detectInstalled(meta.name, meta.configDir)
    const cfg = readConfig()
    const stored = cfg.apps[appId as InstallableAppId]?.installedVersion ?? null

    // A generically-named AppImage (e.g. a manual `axivale.appimage`) yields the
    // unknown-version sentinel. If that exact file is the current release asset,
    // pin the installed version to the release and persist it so later checks are
    // instant and the app tracks updates like every other one.
    let installedVersion = resolveInstalledVersion(detected.version, stored)
    if (
      detected.version === INSTALLED_VERSION_UNKNOWN &&
      detected.appImagePath &&
      release &&
      appImageMatchesAsset(detected.appImagePath, release.assetSize, release.assetDigest)
    ) {
      installedVersion = release.version
      setInstalledVersion(appId as InstallableAppId, release.version)
      writeAxiomVersionFile(meta.configDir, release.version)
    } else if (detected.version !== INSTALLED_VERSION_UNKNOWN) {
      setInstalledVersion(appId as InstallableAppId, installedVersion)
    }
    setState(win, appId, {
      status: 'idle',
      installedVersion,
      latestVersion: release?.version ?? null,
      downloadUrl: release?.downloadUrl ?? null,
    })
  }
  await refreshArcdps(win)
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
  void (async () => {
    try {
      const store = await getIdentityStore()
      const saved = store.load()
      if (saved) {
        applyIdentity(saved.token, saved.login)
        pushGithubStatus(win)
      }
    } catch { /* no stored identity / safeStorage unavailable */ }
  })()

  ipcMain.handle('github:status', () => githubStatus())

  ipcMain.handle('github:auth-begin', async () => {
    const begin = await beginDeviceAuth(GITHUB_DEVICE_CLIENT_ID)
    await shell.openExternal(begin.verificationUri)
    return {
      userCode: begin.userCode,
      verificationUri: begin.verificationUri,
      deviceCode: begin.deviceCode,
      interval: begin.interval,
      expiresIn: begin.expiresIn,
    }
  })

  ipcMain.handle('github:auth-complete', async (_e, deviceCode: string, interval: number, expiresIn: number) => {
    try {
      const token = await pollForToken(GITHUB_DEVICE_CLIENT_ID, deviceCode, {
        intervalSeconds: interval, expiresInSeconds: expiresIn,
      })
      const login = await fetchGithubLogin(token)
      const store = await getIdentityStore()
      store.save({ token, login })
      applyIdentity(token, login)
      pushGithubStatus(win)
      await runCheckUpdates(win) // populate axivale immediately if now unlocked
      onCheckComplete?.()
      return { ok: true, login }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle('github:sign-out', async () => {
    const store = await getIdentityStore()
    store.clear()
    applyIdentity(null, null)
    // Drop any private app from the visible state so it disappears immediately.
    for (const [id, meta] of Object.entries(APP_META)) {
      if (!isAppVisible(meta, unlocked)) {
        setState(win, id as AppId, { installedVersion: null, latestVersion: null, downloadUrl: null, status: 'idle' })
      }
    }
    pushGithubStatus(win)
    onCheckComplete?.()
    return githubStatus()
  })

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

  ipcMain.handle('arcdps:get-state', () => arcdpsState)

  ipcMain.handle('arcdps:check-updates', async () => {
    await refreshArcdps(win)
    onCheckComplete?.()
  })

  ipcMain.handle('arcdps:set-gw2-path', async (_e, p: string | null) => {
    const cfg = readConfig()
    patchConfig({ arcdps: { ...cfg.arcdps, gw2PathOverride: p } })
    await refreshArcdps(win)
  })

  ipcMain.handle('arcdps:pick-gw2-folder', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Guild Wars 2 install folder',
      properties: ['openDirectory'],
      defaultPath: arcdpsState.gw2Path ?? undefined,
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('arcdps:install', async (_e, id: string) => {
    const meta = getPluginMeta(id)
    if (!meta) return
    const current = arcdpsState
    if (!current.gw2Path) return
    const plugin = current.plugins.find(p => p.id === id)
    if (!plugin?.downloadUrl) return
    if (plugin.status === 'downloading' || plugin.status === 'installing') return

    if (await isProcessRunning('Gw2-64')) {
      setArcdpsPlugin(win, id, { status: 'error', errorMessage: 'Close Guild Wars 2 before updating arcdps plugins.' })
      return
    }

    // Install at the location where the plugin is already detected; otherwise
    // fall back to the first declared location (the preferred default).
    const location = (plugin.installedDir != null
      ? meta.locations.find(l => l.dir === plugin.installedDir)
      : undefined) ?? meta.locations[0]
    const installDirAbs = location.dir === '' ? current.gw2Path : pathSync.join(current.gw2Path, ...location.dir.split('/'))
    const targetPath = pathSync.join(installDirAbs, location.installFilename)

    setArcdpsPlugin(win, id, {
      status: 'downloading',
      errorMessage: undefined,
      downloadProgress: { percent: 0, bytesReceived: 0, totalBytes: 0 },
    })
    try {
      await installPluginFile({
        targetPath,
        downloadUrl: plugin.downloadUrl,
        download: (url, dest) => downloadFile(url, dest, (p) => setArcdpsPlugin(win, id, { downloadProgress: p })),
      })
      const cfg = readConfig()
      const newTag = plugin.latestTag
      patchConfig({
        arcdps: {
          ...cfg.arcdps,
          plugins: {
            ...cfg.arcdps.plugins,
            [id]: { installedTag: newTag, installedAt: new Date().toISOString() },
          },
        },
      })
      setArcdpsPlugin(win, id, {
        status: 'idle',
        installed: true,
        installedTag: newTag,
        installedAt: new Date().toISOString(),
        upToDate: true,
        downloadProgress: undefined,
      })
      onCheckComplete?.()
    } catch (err) {
      setArcdpsPlugin(win, id, { status: 'error', errorMessage: String(err), downloadProgress: undefined })
    }
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
        writeAxiomVersionFile(meta.configDir, newVersion)
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
        writeAxiomVersionFile(meta.configDir, newVersion)
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
      const { execSync, spawn } = await import('child_process')
      try {
        if (await isProcessRunning(meta.name)) {
          console.log(`[launch] ${meta.name}: running — trying to focus an existing window`)
          // Emit FOCUSED only when we actually find+raise a real window. A headless
          // instance has no MainWindowHandle, so nothing matches and we fall through
          // to a normal launch — its single-instance lock then opens a window.
          const focusPs = `
$sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);'
$api = Add-Type -MemberDefinition $sig -Name WinApi -Namespace Native -PassThru
$proc = Get-Process -Name '${meta.name}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($proc) {
  $h = $proc.MainWindowHandle
  if ($api::IsIconic($h)) { [void]$api::ShowWindowAsync($h, 9) }
  [void]$api::SetForegroundWindow($h)
  Write-Output 'FOCUSED'
}`.replace(/\r?\n/g, '; ')
          let focused = false
          try {
            const out = execSync(`powershell -NoProfile -NonInteractive -Command "${focusPs.replace(/"/g, '\\"')}"`, { timeout: 5000 }).toString()
            focused = out.includes('FOCUSED')
          } catch (err) {
            console.error(`[launch] ${meta.name}: focus failed:`, err)
          }
          if (focused) return
          console.log(`[launch] ${meta.name}: no focusable window (headless?) — launching one`)
          // fall through to resolve the install path and spawn a windowed instance
        }
        console.log(`[launch] ${meta.name}: querying registry`)
        const ps = `(Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*', 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*${meta.name}*' } | Select-Object -First 1 DisplayName, DisplayVersion, InstallLocation, DisplayIcon, UninstallString | ConvertTo-Json -Compress)`
        const raw = execSync(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { encoding: 'utf8', timeout: 15000 }).trim()
        console.log(`[launch] ${meta.name}: registry result:`, raw || '(empty)')
        if (!raw) return
        const entry = JSON.parse(raw)
        const loc = entry.InstallLocation?.trim()
        const icon = entry.DisplayIcon?.split(',')[0]?.trim()
        console.log(`[launch] ${meta.name}: InstallLocation=${loc} DisplayIcon=${icon}`)
        const { readdirSync, existsSync, statSync } = await import('fs')
        const pathMod = await import('path')
        let target: string | undefined
        if (icon && existsSync(icon) && icon.toLowerCase().endsWith('.exe')) {
          target = icon
        } else if (loc && existsSync(loc) && statSync(loc).isDirectory()) {
          const exes = readdirSync(loc).filter(f => f.endsWith('.exe') && !/uninstall/i.test(f))
          const preferred = exes.find(f => f.toLowerCase() === `${meta.name.toLowerCase()}.exe`) ?? exes[0]
          if (preferred) target = pathMod.join(loc, preferred)
        }
        console.log(`[launch] ${meta.name}: target=${target}`)
        if (!target) return
        const cwd = pathMod.dirname(target)
        const childEnv = { ...process.env }
        delete childEnv.VITE_DEV_SERVER_URL
        delete childEnv.ELECTRON_RUN_AS_NODE
        delete childEnv.ELECTRON_NO_ATTACH_CONSOLE
        delete childEnv.NODE_OPTIONS
        const child = spawn(target, [], { detached: true, stdio: 'ignore', cwd, env: childEnv, windowsHide: false })
        child.on('error', (err) => console.error(`[launch] ${meta.name}: spawn error:`, err))
        child.unref()
      } catch (e) {
        console.error(`[launch] ${meta.name}: failed:`, e)
      }
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
      if (process.platform === 'linux' && meta.configDir) {
        try {
          fsSync.unlinkSync(pathSync.join(osSync.homedir(), '.config', meta.configDir, 'axiom-version'))
        } catch { /* ignore */ }
      }
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

  ipcMain.handle('axiom:copy-text', (_e, text: string) => {
    clipboard.writeText(text)
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

  const FAKE_UPDATE = !!process.env.AXIOM_FAKE_UPDATE
  const FAKE_VERSION = '9.9.9'
  const runFakeSelfUpdate = () => {
    pushSelfUpdate('checking')
    setTimeout(() => pushSelfUpdate('available', { version: FAKE_VERSION }), 1000)
    setTimeout(() => pushSelfUpdate('downloading'), 2000)
    setTimeout(() => pushSelfUpdate('ready', { version: FAKE_VERSION }), 4000)
  }
  if (FAKE_UPDATE) {
    console.log('[fake-update] AXIOM_FAKE_UPDATE=1 — will simulate self-update sequence')
    win.webContents.once('did-finish-load', runFakeSelfUpdate)
  }

  ipcMain.handle('axiom:check-self-update', () => {
    if (FAKE_UPDATE) { runFakeSelfUpdate(); return }
    if (app.isPackaged) {
      autoUpdater.checkForUpdates()
    } else {
      pushSelfUpdate('not-available')
    }
  })

  ipcMain.handle('axiom:install-self-update', () => {
    if (FAKE_UPDATE) {
      console.log('[fake-update] would quitAndInstall; resetting to idle')
      pushSelfUpdate('idle')
      return
    }
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
