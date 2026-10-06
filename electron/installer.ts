import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync, spawn } from 'child_process'
import type { DownloadProgress } from './shared/types'
import { writeLinuxDesktopEntry, findInstalledAppImage } from './desktopEntry'

export class HttpStatusError extends Error {
  constructor(readonly status: number) {
    super(`Download failed: HTTP ${status}`)
  }
}

export interface DownloadOpts {
  /** Request headers for the first hop only; never forwarded across a redirect. */
  headers?: Record<string, string>
  /** On-disk file name; defaults to the url's last path segment. */
  filename?: string
}

/** File name to save a download under. A private asset's API url ends in a
 *  numeric id, so the release's asset name is passed in for it. */
export function assetFilename(downloadUrl: string, filename?: string): string {
  return path.basename(filename || new URL(downloadUrl).pathname)
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

export function downloadFile(
  url: string,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
  headers?: Record<string, string>,
): Promise<void> {
  return downloadHop(url, dest, onProgress, headers ?? {}, 0)
}

function downloadHop(
  url: string,
  dest: string,
  onProgress: (p: DownloadProgress) => void,
  headers: Record<string, string>,
  redirects: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    protocol.get(url, { headers }, (res) => {
      // Follow redirects WITHOUT the headers: a private asset's API url
      // redirects to a signed storage url on another host, and the bearer must
      // never leave api.github.com (tokenScope.ts).
      if (res.statusCode && REDIRECT_CODES.has(res.statusCode) && res.headers.location) {
        res.resume()
        if (redirects >= MAX_REDIRECTS) {
          reject(new Error('Download failed: too many redirects'))
          return
        }
        const next = new URL(res.headers.location, url).toString()
        downloadHop(next, dest, onProgress, {}, redirects + 1).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new HttpStatusError(res.statusCode ?? 0))
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
      res.on('error', (err) => { file.destroy(); fs.unlink(dest, () => {}); reject(err) })
    }).on('error', reject)
  })
}

export async function installWindows(
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
  onInstalling?: () => void,
  opts: DownloadOpts = {},
): Promise<void> {
  const tmpDir = os.tmpdir()
  const filename = assetFilename(downloadUrl, opts.filename)
  const dest = path.join(tmpDir, filename)
  await downloadFile(downloadUrl, dest, onProgress, opts.headers)
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
  opts: DownloadOpts = {},
): Promise<string> {
  const appsDir = path.join(os.homedir(), 'Applications')
  fs.mkdirSync(appsDir, { recursive: true })
  const filename = assetFilename(downloadUrl, opts.filename)
  const dest = path.join(appsDir, filename)
  await downloadFile(downloadUrl, dest, onProgress, opts.headers)
  fs.chmodSync(dest, 0o755)
  return dest
}

export async function updateLinux(
  appName: string,
  appId: string,
  downloadUrl: string,
  onProgress: (p: DownloadProgress) => void,
  opts: DownloadOpts = {},
): Promise<void> {
  const existingPath = findInstalledAppImage(appName)

  const newFilename = assetFilename(downloadUrl, opts.filename)
  const installDir = existingPath ? path.dirname(existingPath) : path.join(os.homedir(), 'AppImages')
  fs.mkdirSync(installDir, { recursive: true })
  const newPath = path.join(installDir, newFilename)

  await downloadFile(downloadUrl, newPath, onProgress, opts.headers)
  fs.chmodSync(newPath, 0o755)

  if (existingPath && existingPath !== newPath) {
    fs.unlinkSync(existingPath)
  }

  // Always (re)write the desktop entry so `gtk-launch ${appId}` resolves to the
  // file we just wrote. Regex-patching the existing file is fragile — the entry
  // may have been created by the AppImage's own first-run integration prompt
  // with a different format, or by a prior update path that left it stale.
  writeLinuxDesktopEntry(appId, appName, newPath)
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
