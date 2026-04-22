import { app, Tray, nativeImage } from 'electron'
import path from 'path'
import { createPopupWindow, showWindowNearTray } from './window'
import { registerIpcHandlers } from './ipc-handlers'
import { readConfig } from './config'
import { setAutoStart } from './autostart'
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

  tray.on('click', () => {
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      showWindowNearTray(win, tray!)
    }
  })

  const cfg = readConfig()
  setAutoStart(cfg.autoStart)

  win.webContents.once('did-finish-load', () => {
    win?.webContents.send('axiom:request-check-updates')
  })
})

app.on('before-quit', () => {
  tray?.destroy()
})
