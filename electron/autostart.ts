import { app } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const LINUX_AUTOSTART_FILE = () => path.join(os.homedir(), '.config', 'autostart', 'axiom.desktop')

function getLinuxExecPath(): string {
  return process.env.APPIMAGE ?? app.getPath('exe')
}

function writeLinuxAutostart(exec: string = getLinuxExecPath()): void {
  const file = LINUX_AUTOSTART_FILE()
  const contents = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=AxiOM',
    `Exec="${exec}"`,
    'Icon=axiom',
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    '',
  ].join('\n')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents, 'utf-8')
}

function removeLinuxAutostart(): void {
  try { fs.unlinkSync(LINUX_AUTOSTART_FILE()) } catch { /* ignore */ }
}

export function setAutoStart(enabled: boolean): void {
  if (process.platform === 'linux') {
    // In dev, app.getPath('exe') points at the Electron binary in node_modules,
    // which would write a broken autostart entry. Only touch the file when
    // packaged or when running from an AppImage.
    if (!app.isPackaged && !process.env.APPIMAGE) return
    if (enabled) writeLinuxAutostart()
    else removeLinuxAutostart()
    return
  }
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
}

// A self-update deletes the old versioned AppImage and moves the new build to a
// different path (AxiOM-0.2.8.AppImage -> AxiOM-0.2.9.AppImage). The autostart
// entry's Exec= still points at the now-deleted file, so the app silently fails
// to launch on the next boot. electron-updater emits `appimage-filename-updated`
// with the new path during install — call this with it to heal the entry in
// place, but only when autostart is actually enabled.
export function refreshAutoStartExec(execPath: string): void {
  if (process.platform !== 'linux') return
  if (!fs.existsSync(LINUX_AUTOSTART_FILE())) return
  writeLinuxAutostart(execPath)
}

export function getAutoStart(): boolean {
  if (process.platform === 'linux') {
    return fs.existsSync(LINUX_AUTOSTART_FILE())
  }
  return app.getLoginItemSettings().openAtLogin
}
