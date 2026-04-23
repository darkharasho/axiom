import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawn } from 'child_process'
import type { DownloadProgress } from './shared/types'

export function downloadFile(
  url: string,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    protocol.get(url, (res) => {
      // Follow redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`))
        return
      }
      const total = parseInt(res.headers['content-length'] ?? '0', 10)
      let received = 0
      const file = fs.createWriteStream(dest)
      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        onProgress({
          percent: total ? Math.round((received / total) * 100) : 0,
          bytesReceived: received,
          totalBytes: total,
        })
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err) })
      res.on('error', reject)
    }).on('error', reject)
  })
}

export async function installWindows(
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
  onInstalling?: () => void,
): Promise<void> {
  const tmpDir = os.tmpdir()
  const filename = path.basename(new URL(downloadUrl).pathname)
  const dest = path.join(tmpDir, filename)
  await downloadFile(downloadUrl, dest, onProgress)
  onInstalling?.()
  await new Promise<void>((resolve, reject) => {
    // /S = silent (no UI), /LAUNCH=0 suppresses post-install launch on NSIS installers that support it
    const child = spawn(dest, ['/S', '/LAUNCH=0'], { stdio: 'ignore', windowsHide: true })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 || code === null) resolve()
      else reject(new Error(`Installer exited with code ${code}`))
    })
  })
  fs.unlink(dest, () => {})
}

export async function installLinux(
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<string> {
  const appsDir = path.join(os.homedir(), 'Applications')
  fs.mkdirSync(appsDir, { recursive: true })
  const filename = path.basename(new URL(downloadUrl).pathname)
  const dest = path.join(appsDir, filename)
  await downloadFile(downloadUrl, dest, onProgress)
  fs.chmodSync(dest, 0o755)
  return dest
}

export async function updateLinux(
  appName: string,
  appId: string,
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
): Promise<void> {
  const searchDirs = [
    path.join(os.homedir(), 'AppImages'),
    path.join(os.homedir(), 'Applications'),
    path.join(os.homedir(), '.local', 'bin'),
    os.homedir(),
  ]

  let existingPath: string | null = null
  for (const dir of searchDirs) {
    try {
      const files = fs.readdirSync(dir)
      const match = files.find(f => f.toLowerCase().endsWith('.appimage') && f.toLowerCase().includes(appName.toLowerCase()))
      if (match) { existingPath = path.join(dir, match); break }
    } catch { /* ignore */ }
  }

  const newFilename = path.basename(new URL(downloadUrl).pathname)
  const installDir = existingPath ? path.dirname(existingPath) : path.join(os.homedir(), 'AppImages')
  fs.mkdirSync(installDir, { recursive: true })
  const newPath = path.join(installDir, newFilename)

  await downloadFile(downloadUrl, newPath, onProgress)
  fs.chmodSync(newPath, 0o755)

  if (existingPath && existingPath !== newPath) {
    fs.unlinkSync(existingPath)
    // Update the GearLever .desktop file if the path changed
    const desktopPath = path.join(os.homedir(), '.local', 'share', 'applications', `${appId}.desktop`)
    if (fs.existsSync(desktopPath)) {
      const content = fs.readFileSync(desktopPath, 'utf-8')
      const updated = content
        .replace(new RegExp(existingPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPath)
      fs.writeFileSync(desktopPath, updated, 'utf-8')
    }
  }
}

export function uninstallWindows(appName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const ps = [
        `$app = Get-ItemProperty`,
        `'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',`,
        `'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'`,
        `-ErrorAction SilentlyContinue |`,
        `Where-Object { $_.DisplayName -like '*${appName}*' } |`,
        `Select-Object -First 1;`,
        `if ($app -and $app.UninstallString) { Start-Process -FilePath $app.UninstallString -Wait }`,
      ].join(' ')
      execSync(`powershell -Command "${ps}"`, { timeout: 60000, windowsHide: true })
      resolve()
    } catch (err) {
      reject(err)
    }
  })
}

export function uninstallLinux(appImagePath: string): void {
  if (fs.existsSync(appImagePath)) {
    fs.unlinkSync(appImagePath)
  }
}
