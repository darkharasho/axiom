import fs from 'fs'
import path from 'path'
import os from 'os'

const APPIMAGE_SEARCH_DIRS = [
  path.join(os.homedir(), 'AppImages'),
  path.join(os.homedir(), 'Applications'),
  path.join(os.homedir(), '.local', 'bin'),
  os.homedir(),
]

// Extract a comparable version tuple from an AppImage filename, e.g.
// "AxiBridge-2.13.5.AppImage" -> [2, 13, 5]. Returns null when the filename
// carries no version (e.g. a manually-installed "axiam.AppImage").
export function parseVersionFromName(filename: string): number[] | null {
  const m = filename.match(/(\d+(?:\.\d+)+)/)
  return m ? m[1].split('.').map((n) => parseInt(n, 10)) : null
}

// Numeric version compare. A versioned name always outranks an unversioned one.
function compareVersions(a: number[] | null, b: number[] | null): number {
  if (a && b) {
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0)
      if (d !== 0) return d
    }
    return 0
  }
  if (a) return 1
  if (b) return -1
  return 0
}

// Find the installed AppImage for an app, preferring the NEWEST version when
// several coexist (e.g. AxiBridge 2.5.9, 2.5.12 and 2.13.5 side by side).
// readdir order is arbitrary, so returning the first match could downgrade the
// launcher to an old build — compare versions numerically, breaking ties by
// most-recently-modified file.
export function findInstalledAppImage(
  appName: string,
  dirs: string[] = APPIMAGE_SEARCH_DIRS,
): string | null {
  const needle = appName.toLowerCase()
  let best: { path: string; version: number[] | null; mtimeMs: number } | null = null
  for (const dir of dirs) {
    let entries: string[]
    try {
      entries = fs.readdirSync(dir)
    } catch {
      continue
    }
    for (const f of entries) {
      const lower = f.toLowerCase()
      if (!lower.endsWith('.appimage') || !lower.includes(needle)) continue
      const full = path.join(dir, f)
      let mtimeMs = 0
      try {
        mtimeMs = fs.statSync(full).mtimeMs
      } catch { /* treat unreadable as oldest */ }
      const version = parseVersionFromName(f)
      const cmp = best ? compareVersions(version, best.version) : 1
      if (!best || cmp > 0 || (cmp === 0 && mtimeMs > best.mtimeMs)) {
        best = { path: full, version, mtimeMs }
      }
    }
  }
  return best ? best.path : null
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
