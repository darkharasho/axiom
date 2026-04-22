import * as childProcess from 'child_process'
import * as fs from 'fs'
import path from 'path'
import os from 'os'

export async function detectInstalledVersion(appName: string): Promise<string | null> {
  if (process.platform === 'win32') return detectWindows(appName)
  if (process.platform === 'linux') return detectLinux(appName)
  return null
}

function detectWindows(appName: string): string | null {
  try {
    const ps = [
      `$apps = Get-ItemProperty`,
      `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',`,
      `'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'`,
      `-ErrorAction SilentlyContinue;`,
      `$app = $apps | Where-Object { $_.DisplayName -like '*${appName}*' } | Select-Object -First 1;`,
      `if ($app) { $app.DisplayVersion } else { '' }`,
    ].join(' ')
    const result = childProcess.execSync(`powershell -Command "${ps}"`, {
      encoding: 'utf8',
      timeout: 8000,
      windowsHide: true,
    }).trim()
    return result || null
  } catch {
    return null
  }
}

function detectLinux(appName: string): string | null {
  // Check Gear Lever metadata: ~/.local/share/gearlever/<uuid>/metadata.json
  const glDir = path.join(os.homedir(), '.local', 'share', 'gearlever')
  if (fs.existsSync(glDir)) {
    try {
      const entries = fs.readdirSync(glDir)
      for (const entry of entries) {
        const metaPath = path.join(glDir, entry, 'metadata.json')
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as Record<string, unknown>
          const name = (meta.name ?? meta.Name ?? '') as string
          const version = (meta.version ?? meta.Version ?? '') as string
          if (name.toLowerCase().includes(appName.toLowerCase()) && version) {
            return version
          }
        }
      }
    } catch { /* ignore */ }
  }

  // Fallback: scan ~/Applications/ for AppImage filename containing version
  const appsDir = path.join(os.homedir(), 'Applications')
  try {
    const files = fs.readdirSync(appsDir)
    for (const file of files) {
      if (!file.toLowerCase().includes(appName.toLowerCase())) continue
      // Match version pattern like 2.5.11 in filename
      const match = file.match(/(\d+\.\d+\.\d+(?:\.\d+)?)/)
      if (match) return match[1]
    }
  } catch { /* ignore */ }

  return null
}
