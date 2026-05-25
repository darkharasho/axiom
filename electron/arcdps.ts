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

function looksLikeGw2(dir: string): boolean {
  try {
    return (
      fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, 'bin64', 'Gw2-64.exe'))
    )
  } catch {
    return false
  }
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

export function resolveGw2Path(opts: ResolveGw2Opts): { path: string | null; source: Gw2Source } {
  if (opts.override && looksLikeGw2(opts.override)) {
    return { path: opts.override, source: 'manual' }
  }
  const fromAxiam = readAxiamGw2Path(opts.axiamConfigPath)
  if (fromAxiam && looksLikeGw2(fromAxiam)) {
    return { path: fromAxiam, source: 'axiam' }
  }
  for (const c of opts.candidates) {
    if (looksLikeGw2(c)) return { path: c, source: 'auto' }
  }
  return { path: null, source: 'none' }
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
): Promise<{ upToDate: boolean; remoteMd5: string } | null> {
  try {
    const res = await fetchImpl(ARCDPS_CORE_MD5_URL)
    if (!res.ok) return null
    const body = await res.text()
    // md5sum format: "<hex>  filename" or "<hex> *filename"
    const remoteMd5 = body.trim().split(/\s+/)[0]?.toLowerCase()
    if (!remoteMd5 || !/^[a-f0-9]{32}$/.test(remoteMd5)) return null
    const local = computeFileMd5(dllPath).toLowerCase()
    return { upToDate: local === remoteMd5, remoteMd5 }
  } catch {
    return null
  }
}

import type { ArcPluginMeta, InstallDir } from './arcdpsRegistry'
import { ARCDPS_REGISTRY } from './arcdpsRegistry'

export interface DetectedPlugin {
  id: string
  meta: ArcPluginMeta
  dllPath: string
  sizeBytes: number
  mtime: Date
}

function safeReaddir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function resolveInstallDir(gw2: string, kind: InstallDir): string {
  return kind === 'bin64'
    ? path.join(gw2, 'bin64')
    : path.join(gw2, 'bin64', 'arcdps', 'extensions')
}

export function detectInstalledPlugins(gw2Path: string): DetectedPlugin[] {
  const out: DetectedPlugin[] = []
  const seen = new Set<string>()
  for (const meta of ARCDPS_REGISTRY) {
    const dir = resolveInstallDir(gw2Path, meta.installDir)
    for (const file of safeReaddir(dir)) {
      if (!meta.dllPattern.test(file)) continue
      if (seen.has(meta.id)) continue
      const full = path.join(dir, file)
      try {
        const st = fs.statSync(full)
        out.push({ id: meta.id, meta, dllPath: full, sizeBytes: st.size, mtime: st.mtime })
        seen.add(meta.id)
      } catch { /* ignore */ }
    }
  }
  return out
}

export interface BuildStateOpts {
  gw2Path: string | null
  gw2PathSource: ArcdpsState['gw2PathSource']
  recordedInstalls: Record<string, { installedTag: string | null; installedAt: string | null }>
  fetchRelease: (repo: string, assetPattern: RegExp) => Promise<{ version: string; downloadUrl: string } | null>
  fetchCoreMd5: (dllPath: string) => Promise<{ upToDate: boolean; remoteMd5: string } | null>
}

export async function buildArcdpsState(opts: BuildStateOpts): Promise<ArcdpsState> {
  if (!opts.gw2Path) {
    return { gw2Path: null, gw2PathSource: opts.gw2PathSource, plugins: [] }
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
      alwaysShow: meta.alwaysShow,
      installed: !!det,
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
  return { gw2Path: opts.gw2Path, gw2PathSource: opts.gw2PathSource, plugins }
}
