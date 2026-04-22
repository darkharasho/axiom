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
): Promise<void> {
  const tmpDir = os.tmpdir()
  const filename = path.basename(new URL(downloadUrl).pathname)
  const dest = path.join(tmpDir, filename)
  await downloadFile(downloadUrl, dest, onProgress)
  await new Promise<void>((resolve, reject) => {
    const child = spawn(dest, [], { detached: true, stdio: 'ignore' })
    child.on('error', reject)
    child.unref()
    // Installer runs independently; resolve immediately after launch
    resolve()
  })
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
