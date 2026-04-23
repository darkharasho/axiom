import { BrowserWindow, screen, nativeImage } from 'electron'
import path from 'path'

const WINDOW_WIDTH = 320

export function createPopupWindow(): BrowserWindow {
  const icon = nativeImage.createFromPath(path.join(__dirname, '../public/AxiOM-White.png'))

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: 420,
    show: false,
    frame: false,
    icon,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    ...(process.platform === 'linux' && { type: 'toolbar' }),
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

  win.setSkipTaskbar(true)

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) win.hide()
  })

  return win
}

export function showWindowNearTray(
  win: BrowserWindow,
  cursor: { x: number; y: number },
  trayBounds?: { x: number; y: number; width: number; height: number },
): void {
  const { width: winW, height: winH } = win.getBounds()
  const display = screen.getDisplayNearestPoint(cursor)
  const workArea = display.workArea
  const MARGIN = 8

  let x: number
  let y: number

  if (process.platform === 'win32' && trayBounds && trayBounds.width > 0) {
    // Centre the window horizontally on the tray icon
    x = Math.round(trayBounds.x + trayBounds.width / 2 - winW / 2)

    // Detect which edge the taskbar is on and place the window on the inside
    const taskbarAtBottom = trayBounds.y > workArea.y + workArea.height / 2
    if (taskbarAtBottom) {
      y = workArea.y + workArea.height - winH - MARGIN
    } else {
      y = workArea.y + MARGIN
    }

    // Clamp so the window stays within the work area
    x = Math.max(workArea.x + MARGIN, Math.min(x, workArea.x + workArea.width - winW - MARGIN))
  } else {
    // Linux / fallback: bottom-right corner
    x = workArea.x + workArea.width - winW - MARGIN
    y = workArea.y + workArea.height - winH - MARGIN
  }

  win.setPosition(x, y, false)
  win.show()
  win.focus()
}
