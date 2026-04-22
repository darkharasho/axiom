import { app, Tray, nativeImage } from 'electron'
import path from 'path'
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

app.on('window-all-closed', () => {
  // Intentionally do nothing — keep the app running as a tray app
})

app.whenReady().then(() => {
  const iconPath = path.join(__dirname, '../public/AxiOM-White.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('AxiOM')
  tray.setContextMenu(null)

  win = createPopupWindow()
  registerIpcHandlers(win)

  tray.on('click', (_event, _bounds, position) => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      showWindowNearTray(win, position)
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

  if (app.isPackaged) {
    autoUpdater.logger = log
    autoUpdater.checkForUpdatesAndNotify()
  }
})

app.on('before-quit', () => {
  tray?.destroy()
})
