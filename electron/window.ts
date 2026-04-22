import { BrowserWindow, screen } from 'electron'
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

export function showWindowNearTray(win: BrowserWindow, cursor: { x: number; y: number }): void {
  const winBounds = win.getBounds()
  const display = screen.getDisplayNearestPoint(cursor)
  const workArea = display.workArea

  // Center the window horizontally on the cursor, position above or below based on taskbar location
  let x = Math.round(cursor.x - winBounds.width / 2)
  const inBottomHalf = cursor.y > workArea.y + workArea.height / 2
  const y = inBottomHalf
    ? Math.round(cursor.y - winBounds.height - 8)
    : Math.round(cursor.y + 8)

  // Clamp to work area so window never goes offscreen
  x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winBounds.width))

  win.setPosition(x, y, false)
  win.show()
  win.focus()
}
