import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { ArcdpsPluginState, ArcdpsState } from './shared/types'

type Gw2Source = ArcdpsState['gw2PathSource']

export interface ResolveGw2Opts {
  override: string | null
  axiamConfigPath: string
  candidates: string[]
}

function hasGw2Exe(dir: string): boolean {
  try {
    if (!fs.statSync(dir).isDirectory()) return false
    return fs.readdirSync(dir).some(f => /^gw2(-64)?\.exe$/i.test(f))
  } catch {
    return false
  }
}

// A folder counts as a GW2 install if Gw2(-64).exe appears in it OR in a
// bin64/ subfolder. The launcher lives in the root; the game binary lives in
// bin64/. Different installs (Steam/standalone/Wine) put the exe in different
// places, so accept either.
function looksLikeGw2(dir: string): boolean {
  if (hasGw2Exe(dir)) return true
  if (hasGw2Exe(path.join(dir, 'bin64'))) return true
  return false
}

function normalizeGw2Root(dir: string): string {
  // If the user picked the bin64/ folder, walk up one level so the root is stored.
  return path.basename(dir).toLowerCase() === 'bin64' ? path.dirname(dir) : dir
}

function readAxiamGw2Path(cfgPath: string): string | null {
  try {
    const raw = fs.readFileSync(cfgPath, 'utf-8')
    const parsed = JSON.parse(raw) as { gw2Path?: unknown }
    return typeof parsed.gw2Path === 'string' ? parsed.gw2Path : null
  } catch {
    return null
  }
}

export function resolveGw2Path(opts: ResolveGw2Opts): { path: string | null; source: Gw2Source; overrideError: string | null } {
  if (opts.override) {
    if (looksLikeGw2(opts.override)) {
      return { path: normalizeGw2Root(opts.override), source: 'manual', overrideError: null }
    }
    // Override was set by the user but no Gw2(-64).exe found under bin64/.
    // Fall through to other sources, but report the rejection so the UI can show it.
    const fromAxiam = readAxiamGw2Path(opts.axiamConfigPath)
    if (fromAxiam && looksLikeGw2(fromAxiam)) {
      return { path: normalizeGw2Root(fromAxiam), source: 'axiam', overrideError: `No Gw2-64.exe found in ${opts.override} or its bin64/ subfolder.` }
    }
    for (const c of opts.candidates) {
      if (looksLikeGw2(c)) return { path: normalizeGw2Root(c), source: 'auto', overrideError: `No Gw2-64.exe found in ${opts.override} or its bin64/ subfolder.` }
    }
    return { path: null, source: 'none', overrideError: `No Gw2-64.exe found in ${opts.override} or its bin64/ subfolder.` }
  }
  const fromAxiam = readAxiamGw2Path(opts.axiamConfigPath)
  if (fromAxiam && looksLikeGw2(fromAxiam)) {
    return { path: normalizeGw2Root(fromAxiam), source: 'axiam', overrideError: null }
  }
  for (const c of opts.candidates) {
    if (looksLikeGw2(c)) return { path: normalizeGw2Root(c), source: 'auto', overrideError: null }
  }
  return { path: null, source: 'none', overrideError: null }
}

export function defaultAxiamConfigPath(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'axiam', 'config.json')
  }
  return path.join(os.homedir(), '.config', 'axiam', 'config.json')
}

export function defaultGw2Candidates(): string[] {
  if (process.platform === 'win32') {
    return [
      'C:\\Program Files\\Guild Wars 2',
      'C:\\Program Files (x86)\\Guild Wars 2',
      'C:\\Guild Wars 2',
      path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Guild Wars 2'),
    ]
  }
  const home = os.homedir()
  return [
    path.join(home, '.steam', 'steam', 'steamapps', 'common', 'Guild Wars 2'),
    path.join(home, '.local', 'share', 'Steam', 'steamapps', 'common', 'Guild Wars 2'),
    path.join(home, 'Games', 'guild-wars-2', 'drive_c', 'Program Files', 'Guild Wars 2'),
  ]
}

export const ARCDPS_CORE_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll'
export const ARCDPS_CORE_MD5_URL = 'https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum'

export function computeFileMd5(file: string): string {
  const hash = crypto.createHash('md5')
  hash.update(fs.readFileSync(file))
  return hash.digest('hex')
}

type FetchLike = (url: string) => Promise<{ ok: boolean; text(): Promise<string> }>

export async function checkArcdpsCoreUpdate(
  dllPath: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<{ upToDate: boolean; remoteMd5: string; localMd5: string } | null> {
  try {
    const res = await fetchImpl(ARCDPS_CORE_MD5_URL)
    if (!res.ok) return null
    const body = await res.text()
    // md5sum format: "<hex>  filename" or "<hex> *filename"
    const remoteMd5 = body.trim().split(/\s+/)[0]?.toLowerCase()
    if (!remoteMd5 || !/^[a-f0-9]{32}$/.test(remoteMd5)) return null
    const localMd5 = computeFileMd5(dllPath).toLowerCase()
    return { upToDate: localMd5 === remoteMd5, remoteMd5, localMd5 }
  } catch {
    return null
  }
}

import type { ArcPluginMeta, InstallDir, PluginLocation } from './arcdpsRegistry'
import { ARCDPS_REGISTRY } from './arcdpsRegistry'

export interface DetectedPlugin {
  id: string
  meta: ArcPluginMeta
  location: PluginLocation
  dllPath: string
  sizeBytes: number
  mtime: Date
}

function safeReaddir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

export function resolveInstallDir(gw2: string, kind: InstallDir): string {
  // '' = GW2 install root
  return kind === '' ? gw2 : path.join(gw2, ...kind.split('/'))
}

export function detectInstalledPlugins(gw2Path: string): DetectedPlugin[] {
  const nexusInstalled = fs.existsSync(path.join(gw2Path, 'addons'))
  const out: DetectedPlugin[] = []
  const seen = new Set<string>()
  for (const meta of ARCDPS_REGISTRY) {
    for (const location of meta.locations) {
      if (seen.has(meta.id)) break
      // arcdps shares its d3d11.dll filename with GW2 Nexus's loader. If Nexus
      // is installed (addons/ exists) the root d3d11.dll is Nexus, not arcdps.
      if (meta.id === 'arcdps' && location.dir === '' && nexusInstalled) continue
      const dir = resolveInstallDir(gw2Path, location.dir)
      for (const file of safeReaddir(dir)) {
        if (!location.dllPattern.test(file)) continue
        const full = path.join(dir, file)
        try {
          const st = fs.statSync(full)
          out.push({ id: meta.id, meta, location, dllPath: full, sizeBytes: st.size, mtime: st.mtime })
          seen.add(meta.id)
          break
        } catch { /* ignore */ }
      }
    }
  }
  return out
}

export interface BuildStateOpts {
  gw2Path: string | null
  gw2PathSource: ArcdpsState['gw2PathSource']
  overrideError?: string | null
  recordedInstalls: Record<string, { installedTag: string | null; installedAt: string | null }>
  fetchRelease: (repo: string, assetPattern: RegExp) => Promise<{ version: string; downloadUrl: string } | null>
  fetchCoreMd5: (dllPath: string) => Promise<{ upToDate: boolean; remoteMd5: string; localMd5: string } | null>
}

export async function buildArcdpsState(opts: BuildStateOpts): Promise<ArcdpsState> {
  if (!opts.gw2Path) {
    return { gw2Path: null, gw2PathSource: opts.gw2PathSource, overrideError: opts.overrideError ?? null, plugins: [] }
  }
  const detected = detectInstalledPlugins(opts.gw2Path)
  const detectedById = new Map(detected.map(d => [d.id, d]))

  const plugins: ArcdpsPluginState[] = []
  for (const meta of ARCDPS_REGISTRY) {
    const det = detectedById.get(meta.id)
    if (!meta.alwaysShow && !det) continue
    const recorded = opts.recordedInstalls[meta.id]
    const base: ArcdpsPluginState = {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      alwaysShow: meta.alwaysShow,
      installed: !!det,
      installedDir: det ? det.location.dir : null,
      installedTag: recorded?.installedTag ?? null,
      installedAt: recorded?.installedAt ?? null,
      latestTag: null,
      downloadUrl: null,
      upToDate: null,
      status: 'idle',
    }

    if (meta.source.kind === 'deltaconnected' && det) {
      const r = await opts.fetchCoreMd5(det.dllPath)
      if (r) {
        base.installedTag = r.localMd5.slice(0, 7)
        base.latestTag = r.remoteMd5.slice(0, 7)
        base.downloadUrl = ARCDPS_CORE_URL
        base.upToDate = r.upToDate
      }
    } else if (meta.source.kind === 'deltaconnected' && !det) {
      base.downloadUrl = ARCDPS_CORE_URL
    } else if (meta.source.kind === 'github' && meta.assetPattern) {
      const rel = await opts.fetchRelease(meta.source.repo, meta.assetPattern)
      if (rel) {
        base.latestTag = rel.version
        base.downloadUrl = rel.downloadUrl
        base.upToDate = det && recorded?.installedTag === rel.version ? true
          : det && recorded?.installedTag && recorded.installedTag !== rel.version ? false
          : null
      }
    }
    plugins.push(base)
  }
  return { gw2Path: opts.gw2Path, gw2PathSource: opts.gw2PathSource, overrideError: opts.overrideError ?? null, plugins }
}

export interface InstallPluginOpts {
  targetPath: string
  downloadUrl: string
  download: (url: string, dest: string) => Promise<void>
}

export async function installPluginFile(opts: InstallPluginOpts): Promise<void> {
  const dir = path.dirname(opts.targetPath)
  fs.mkdirSync(dir, { recursive: true })
  const tmp = opts.targetPath + '.new'
  const bak = opts.targetPath + '.bak'

  try {
    await opts.download(opts.downloadUrl, tmp)
  } catch (err) {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    throw err
  }

  const hadPrior = fs.existsSync(opts.targetPath)
  if (hadPrior) {
    try { fs.unlinkSync(bak) } catch { /* ignore */ }
    fs.renameSync(opts.targetPath, bak)
  }
  try {
    fs.renameSync(tmp, opts.targetPath)
  } catch (err) {
    if (hadPrior) {
      try { fs.renameSync(bak, opts.targetPath) } catch { /* best-effort */ }
    }
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    throw err
  }
}
