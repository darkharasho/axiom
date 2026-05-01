import { app, Tray, nativeImage, nativeTheme, Menu, screen } from 'electron'
import type { KeyboardEvent, Rectangle, Point } from 'electron'
import path from 'path'
import { execSync } from 'child_process'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// Wayland doesn't honour X11 window-type hints (skipTaskbar, type:'toolbar').
// Running under XWayland restores that behaviour for tray popup windows.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}

// Memory trims: this is a 320x420 tray popup with simple CSS transitions —
// no canvas/WebGL/video — so the GPU helper process is pure overhead.
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128')
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion,Translate,MediaRouter',
)
import { createPopupWindow, showWindowNearTray } from './window'
import { registerIpcHandlers, runCheckUpdates, getLastCheckTime, hasAnyUpdates } from './ipc-handlers'
import { readConfig } from './config'
import { setAutoStart } from './autostart'

const CHECK_INTERVAL_MS      = 30 * 60 * 1000  // 30 minutes
const TRAY_RECHECK_MS        =  5 * 60 * 1000  //  5 minutes
const SELF_UPDATE_INTERVAL_MS = 60 * 60 * 1000  //  1 hour
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null
let win: BrowserWindow | null = null

function isWindowsTaskbarDark(): boolean {
  try {
    const out = execSync(
      'reg query "HKCU\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v SystemUsesLightTheme',
      { encoding: 'utf8', windowsHide: true, timeout: 2000 },
    )
    const match = out.match(/SystemUsesLightTheme\s+REG_DWORD\s+0x([0-9a-fA-F]+)/)
    return match ? parseInt(match[1], 16) === 0 : nativeTheme.shouldUseDarkColors
  } catch {
    return nativeTheme.shouldUseDarkColors
  }
}

function getIconPath(badge = false): string {
  let variant: string
  if (process.platform === 'linux') {
    variant = 'white'
  } else if (process.platform === 'win32') {
    variant = isWindowsTaskbarDark() ? 'white' : 'black'
  } else {
    variant = nativeTheme.shouldUseDarkColors ? 'white' : 'black'
  }
  const name = variant === 'white' ? 'White' : 'Black'
  const suffix = badge ? '-badge' : ''
  return path.join(__dirname, `../public/AxiOM-${name}${suffix}.png`)
}

function getAppIcon(badge = false) {
  const raw = nativeImage.createFromPath(getIconPath(badge))
  if (process.platform === 'win32') {
    const sizes = [16, 32, 48, 64, 128, 256]
    const multi = nativeImage.createEmpty()
    for (const s of sizes) {
      multi.addRepresentation({ width: s, height: s, buffer: raw.resize({ width: s, height: s }).toPNG(), scaleFactor: 1.0 })
    }
    return multi
  }
  return raw
}

function updateTrayIcon() {
  const badge = readConfig().trayBadge && hasAnyUpdates()
  tray?.setImage(getAppIcon(badge).resize({ width: 16, height: 16 }))
}

app.on('window-all-closed', () => {
  // Intentionally do nothing — keep the app running as a tray app
})

app.whenReady().then(() => {
  tray = new Tray(getAppIcon().resize({ width: 16, height: 16 }))
  tray.setToolTip('AxiOM')

  win = createPopupWindow()
  registerIpcHandlers(win, updateTrayIcon)

  const toggleWindow = (position: Point, bounds?: Rectangle) => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      showWindowNearTray(win, position, bounds)
      if (Date.now() - getLastCheckTime() > TRAY_RECHECK_MS) {
        runCheckUpdates(win)
      }
    }
  }

  tray.on('click', (_event: KeyboardEvent, bounds: Rectangle, position: Point) => {
    toggleWindow(position, bounds)
  })

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Open AxiOM', click: () => {
        const cursor = screen.getCursorScreenPoint()
        toggleWindow(cursor, tray!.getBounds())
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]))

  const cfg = readConfig()
  setAutoStart(cfg.autoStart)

  win.webContents.once('did-finish-load', () => {
    runCheckUpdates(win!).then(updateTrayIcon)
  })

  setInterval(() => { if (win) runCheckUpdates(win).then(updateTrayIcon) }, CHECK_INTERVAL_MS)

  nativeTheme.on('updated', updateTrayIcon)

  if (app.isPackaged) {
    log.transports.console.level = false
    autoUpdater.logger = log
    // Use checkForUpdates (not checkForUpdatesAndNotify) so we don't fire a
    // system notification — the titlebar indicator in AppList handles UX.
    autoUpdater.checkForUpdates()
    setInterval(() => { autoUpdater.checkForUpdates() }, SELF_UPDATE_INTERVAL_MS)
  }
})

app.on('before-quit', () => {
  tray?.destroy()
})
