import { app, Tray, nativeImage, nativeTheme } from 'electron'
import path from 'path'
import { execSync } from 'child_process'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// Wayland doesn't honour X11 window-type hints (skipTaskbar, type:'toolbar').
// Running under XWayland restores that behaviour for tray popup windows.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('ozone-platform', 'x11')
}
import { createPopupWindow, showWindowNearTray } from './window'
import { registerIpcHandlers, runCheckUpdates, getLastCheckTime } from './ipc-handlers'
import { readConfig } from './config'
import { setAutoStart } from './autostart'

const CHECK_INTERVAL_MS = 30 * 60 * 1000  // 30 minutes
const TRAY_RECHECK_MS   =  5 * 60 * 1000  //  5 minutes
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

function getIconPath(): string {
  let variant: string
  if (process.platform === 'linux') {
    variant = 'white'
  } else if (process.platform === 'win32') {
    variant = isWindowsTaskbarDark() ? 'white' : 'black'
  } else {
    variant = nativeTheme.shouldUseDarkColors ? 'white' : 'black'
  }
  return path.join(__dirname, `../public/AxiOM-${variant === 'white' ? 'White' : 'Black'}.png`)
}

function getAppIcon() {
  const raw = nativeImage.createFromPath(getIconPath())
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

app.on('window-all-closed', () => {
  // Intentionally do nothing — keep the app running as a tray app
})

app.whenReady().then(() => {
  tray = new Tray(getAppIcon().resize({ width: 16, height: 16 }))
  tray.setToolTip('AxiOM')
  tray.setContextMenu(null)

  win = createPopupWindow()
  registerIpcHandlers(win)

  tray.on('click', (_event, bounds, position) => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      showWindowNearTray(win, position, bounds)
      if (Date.now() - getLastCheckTime() > TRAY_RECHECK_MS) {
        runCheckUpdates(win)
      }
    }
  })

  const cfg = readConfig()
  setAutoStart(cfg.autoStart)

  win.webContents.once('did-finish-load', () => {
    runCheckUpdates(win!)
  })

  setInterval(() => { if (win) runCheckUpdates(win) }, CHECK_INTERVAL_MS)

  nativeTheme.on('updated', () => {
    tray?.setImage(getAppIcon().resize({ width: 16, height: 16 }))
  })

  if (app.isPackaged) {
    log.transports.console.level = false
    autoUpdater.logger = log
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('before-quit', () => {
  tray?.destroy()
})
