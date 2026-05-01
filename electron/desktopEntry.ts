import fs from 'fs'
import path from 'path'
import os from 'os'

const APPIMAGE_SEARCH_DIRS = [
  path.join(os.homedir(), 'AppImages'),
  path.join(os.homedir(), 'Applications'),
  path.join(os.homedir(), '.local', 'bin'),
  os.homedir(),
]

export function findInstalledAppImage(appName: string): string | null {
  for (const dir of APPIMAGE_SEARCH_DIRS) {
    try {
      const files = fs.readdirSync(dir)
      const match = files.find(
        (f) => f.toLowerCase().endsWith('.appimage') && f.toLowerCase().includes(appName.toLowerCase()),
      )
      if (match) return path.join(dir, match)
    } catch { /* ignore */ }
  }
  return null
}

// Idempotently write ~/.local/share/applications/${appId}.desktop pointing at
// the given AppImage path. AxiOM launches via `gtk-launch ${appId}`, so this
// file's Exec line must always reference an AppImage that actually exists.
//
// Preserves the existing Icon= line if it points at a real file, otherwise
// falls back to a name-based Icon hint. Returns true if the file was changed.
export function writeLinuxDesktopEntry(appId: string, name: string, appImagePath: string): boolean {
  if (process.platform !== 'linux') return false

  const appsDir = path.join(os.homedir(), '.local', 'share', 'applications')
  const desktopPath = path.join(appsDir, `${appId}.desktop`)

  let iconLine = `Icon=${appId}`
  if (fs.existsSync(desktopPath)) {
    try {
      const existing = fs.readFileSync(desktopPath, 'utf8')
      const m = existing.match(/^Icon=(.+)$/m)
      if (m) {
        const iconValue = m[1].trim()
        if (!iconValue.includes('/') || fs.existsSync(iconValue)) iconLine = `Icon=${iconValue}`
      }
    } catch { /* fall through */ }
  }

  const contents =
    `[Desktop Entry]
Type=Application
Name=${name}
${iconLine}
TryExec=${appImagePath}
Exec=env DESKTOPINTEGRATION=1 ${appImagePath} --no-sandbox %U
Terminal=false
Categories=Utility;
StartupWMClass=${name}
X-AppImage-Name=${name}
`

  try {
    fs.mkdirSync(appsDir, { recursive: true })
    if (fs.existsSync(desktopPath) && fs.readFileSync(desktopPath, 'utf8') === contents) return false
    fs.writeFileSync(desktopPath, contents, 'utf8')
    return true
  } catch (err) {
    console.error(`[desktop-entry] failed to write ${desktopPath}:`, (err as Error).message)
    return false
  }
}

// Repair stale ${appId}.desktop entries left behind by previous updates.
// For each app, if an AppImage exists on disk but the desktop entry's Exec
// points at a missing or different file, rewrite it.
export function refreshOrphanedDesktopEntries(apps: Array<{ id: string; name: string }>): void {
  if (process.platform !== 'linux') return
  for (const app of apps) {
    const installed = findInstalledAppImage(app.name)
    if (!installed) continue
    const desktopPath = path.join(os.homedir(), '.local', 'share', 'applications', `${app.id}.desktop`)
    if (!fs.existsSync(desktopPath)) continue
    let needsRefresh = true
    try {
      const content = fs.readFileSync(desktopPath, 'utf8')
      const tryExec = content.match(/^TryExec=(.+)$/m)?.[1]?.trim()
      if (tryExec === installed && fs.existsSync(tryExec)) needsRefresh = false
    } catch { /* fall through to refresh */ }
    if (needsRefresh) writeLinuxDesktopEntry(app.id, app.name, installed)
  }
}
