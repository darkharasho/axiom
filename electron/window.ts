import { BrowserWindow, Tray, screen } from 'electron'
import path from 'path'

const WINDOW_WIDTH = 320

export function createPopupWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: 420,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })

  return win
}

export function showWindowNearTray(win: BrowserWindow, tray: Tray): void {
  const trayBounds = tray.getBounds()
  const winBounds = win.getBounds()

  // On Linux tray.getBounds() often returns {0,0,0,0} — fall back to cursor position
  const anchor = (trayBounds.width === 0 && trayBounds.height === 0)
    ? screen.getCursorScreenPoint()
    : { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y + trayBounds.height / 2 }

  const display = screen.getDisplayNearestPoint(anchor)
  const workArea = display.workArea

  let x = Math.round(anchor.x - winBounds.width / 2)
  // If anchor is in the bottom half of screen, show window above it; otherwise below
  const y = anchor.y > workArea.y + workArea.height / 2
    ? Math.round(anchor.y - winBounds.height)
    : Math.round(anchor.y)

  // Clamp to work area
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winBounds.width))

  win.setPosition(x, y, false)
  win.show()
  win.focus()
}
