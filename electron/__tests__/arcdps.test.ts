import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/axiom-test-userdata' } }))

import { resolveGw2Path, detectInstalledPlugins, computeFileMd5, checkArcdpsCoreUpdate, buildArcdpsState, installPluginFile, setPluginDisabled } from '../arcdps'
import { arcdpsPluginHasUpdate } from '../shared/types'

describe('resolveGw2Path', () => {
  const tmpRoot = path.join(os.tmpdir(), `axiom-arcdps-${Date.now()}`)
  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    fs.mkdirSync(tmpRoot, { recursive: true })
  })

  it('returns manual override when configured', () => {
    const gw2 = path.join(tmpRoot, 'GW2Manual')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const result = resolveGw2Path({ override: gw2, axiamConfigPath: '/nonexistent', candidates: [] })
    expect(result).toEqual({ path: gw2, source: 'manual', overrideError: null })
  })

  it('falls back to AxiAM config when no override', () => {
    const gw2 = path.join(tmpRoot, 'GW2Axiam')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const axiamCfg = path.join(tmpRoot, 'axiam.json')
    fs.writeFileSync(axiamCfg, JSON.stringify({ gw2Path: gw2 }))
    const result = resolveGw2Path({ override: null, axiamConfigPath: axiamCfg, candidates: [] })
    expect(result).toEqual({ path: gw2, source: 'axiam', overrideError: null })
  })

  it('falls back to candidates when AxiAM config missing', () => {
    const gw2 = path.join(tmpRoot, 'GW2Auto')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const result = resolveGw2Path({ override: null, axiamConfigPath: '/nonexistent', candidates: [gw2] })
    expect(result).toEqual({ path: gw2, source: 'auto', overrideError: null })
  })

  it('returns none when nothing resolves', () => {
    const result = resolveGw2Path({ override: null, axiamConfigPath: '/nonexistent', candidates: [] })
    expect(result).toEqual({ path: null, source: 'none', overrideError: null })
  })

  it('ignores AxiAM path that does not contain bin64/Gw2-64.exe', () => {
    const bogus = path.join(tmpRoot, 'NotGW2')
    fs.mkdirSync(bogus, { recursive: true })
    const axiamCfg = path.join(tmpRoot, 'axiam.json')
    fs.writeFileSync(axiamCfg, JSON.stringify({ gw2Path: bogus }))
    const result = resolveGw2Path({ override: null, axiamConfigPath: axiamCfg, candidates: [] })
    expect(result).toEqual({ path: null, source: 'none', overrideError: null })
  })
})

describe('detectInstalledPlugins', () => {
  const tmpRoot = path.join(os.tmpdir(), `axiom-arcdps-detect-${Date.now()}`)
  const gw2 = path.join(tmpRoot, 'GW2')
  const bin64 = path.join(gw2, 'bin64')
  const ext = path.join(bin64, 'arcdps', 'extensions')

  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    fs.mkdirSync(ext, { recursive: true })
  })

  it('returns empty when no DLLs present', () => {
    expect(detectInstalledPlugins(gw2)).toEqual([])
  })

  it('detects arcdps core (d3d11.dll in GW2 root)', () => {
    fs.writeFileSync(path.join(gw2, 'd3d11.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const arc = found.find(p => p.id === 'arcdps')
    expect(arc).toBeDefined()
    expect(arc!.location.dir).toBe('')
  })

  it('detects arcdps under Nexus (addons/ArcDPS.dll)', () => {
    const addonsDir = path.join(gw2, 'addons')
    fs.mkdirSync(addonsDir, { recursive: true })
    fs.writeFileSync(path.join(addonsDir, 'ArcDPS.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const arc = found.find(p => p.id === 'arcdps')
    expect(arc).toBeDefined()
    expect(arc!.location.dir).toBe('addons')
  })

  it('detects a github plugin in bin64', () => {
    fs.writeFileSync(path.join(bin64, 'arcdps_boon_table.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const bt = found.find(p => p.id === 'boon_table')
    expect(bt).toBeDefined()
    expect(bt!.location.dir).toBe('bin64')
  })

  it('detects a github plugin in addons/ (Nexus location)', () => {
    fs.mkdirSync(path.join(gw2, 'addons'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'addons', 'arcdps_boon_table.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const bt = found.find(p => p.id === 'boon_table')
    expect(bt).toBeDefined()
    expect(bt!.location.dir).toBe('addons')
  })

  it('detects unofficial_extras in extensions/', () => {
    fs.writeFileSync(path.join(ext, 'extras.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('unofficial_extras')
  })

  it('detects an arcdps hot-swap numbered file (Foo.dll_0) as an active install, not disabled', () => {
    // arcdps writes an updated extension as `<name>.dll_<n>` while the running
    // copy is locked, then loads that file directly. It is active, not disabled.
    fs.mkdirSync(path.join(gw2, 'addons'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'addons', 'Unofficial_Extras.dll_0'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const ue = found.find(p => p.id === 'unofficial_extras')
    expect(ue).toBeDefined()
    expect(ue!.disabled).toBe(false)
  })

  it('marks a .disabled variant as disabled', () => {
    fs.mkdirSync(path.join(gw2, 'addons'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'addons', 'arcdps_boon_table.dll.disabled'), 'fake')
    const bt = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')
    expect(bt).toBeDefined()
    expect(bt!.disabled).toBe(true)
  })

  it('prefers a live .dll over a numbered hot-swap sibling', () => {
    fs.mkdirSync(path.join(gw2, 'addons'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'addons', 'Unofficial_Extras.dll'), 'live')
    fs.writeFileSync(path.join(gw2, 'addons', 'Unofficial_Extras.dll_0'), 'stale')
    const ue = detectInstalledPlugins(gw2).find(p => p.id === 'unofficial_extras')!
    expect(ue.disabled).toBe(false)
    expect(path.basename(ue.dllPath)).toBe('Unofficial_Extras.dll')
  })

  it('ignores arbitrary DLLs not in the registry', () => {
    fs.writeFileSync(path.join(gw2, 'random_other.dll'), 'fake')
    expect(detectInstalledPlugins(gw2)).toEqual([])
  })

  it('returns each meta only once even when present in multiple locations', () => {
    fs.writeFileSync(path.join(gw2, 'd3d11.dll'), 'fake')
    const addonsDir = path.join(gw2, 'addons')
    fs.mkdirSync(addonsDir, { recursive: true })
    fs.writeFileSync(path.join(addonsDir, 'ArcDPS.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const arcCount = found.filter(p => p.id === 'arcdps').length
    expect(arcCount).toBe(1)
  })
})

describe('setPluginDisabled', () => {
  const tmpRoot = path.join(os.tmpdir(), `axiom-arcdps-toggle-${Date.now()}`)
  const gw2 = path.join(tmpRoot, 'GW2')
  const addons = path.join(gw2, 'addons')

  beforeEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
    fs.mkdirSync(addons, { recursive: true })
  })

  it('disables an active plugin by renaming to .disabled', () => {
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll'), 'dll')
    const det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    expect(det.disabled).toBe(false)
    const newPath = setPluginDisabled(det, true)
    expect(newPath.endsWith('arcdps_boon_table.dll.disabled')).toBe(true)
    expect(fs.existsSync(path.join(addons, 'arcdps_boon_table.dll'))).toBe(false)
    expect(detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!.disabled).toBe(true)
  })

  it('re-enables a disabled plugin by stripping the suffix', () => {
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll.disabled'), 'dll')
    const det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    expect(det.disabled).toBe(true)
    const newPath = setPluginDisabled(det, false)
    expect(newPath.endsWith('arcdps_boon_table.dll')).toBe(true)
    expect(detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!.disabled).toBe(false)
  })

  it('round-trips: disable then enable restores the original file', () => {
    const orig = path.join(addons, 'arcdps_boon_table.dll')
    fs.writeFileSync(orig, 'dll')
    let det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    setPluginDisabled(det, true)
    det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    setPluginDisabled(det, false)
    expect(fs.existsSync(orig)).toBe(true)
  })

  it('is a no-op when already in the requested state', () => {
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll'), 'dll')
    const det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    expect(setPluginDisabled(det, false)).toBe(det.dllPath)
  })

  it('normalises an arcdps hot-swap numbered file when disabling', () => {
    fs.writeFileSync(path.join(addons, 'Unofficial_Extras.dll_0'), 'dll')
    const det = detectInstalledPlugins(gw2).find(p => p.id === 'unofficial_extras')!
    expect(det.disabled).toBe(false)
    const newPath = setPluginDisabled(det, true)
    expect(newPath.endsWith('Unofficial_Extras.dll.disabled')).toBe(true)
  })

  it('disabling clears a stale .disabled and keeps only the live copy as .disabled', () => {
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll'), 'live')
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll.disabled'), 'stale')
    const det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    const newPath = setPluginDisabled(det, true)
    expect(newPath.endsWith('arcdps_boon_table.dll.disabled')).toBe(true)
    expect(fs.existsSync(path.join(addons, 'arcdps_boon_table.dll'))).toBe(false)
    expect(fs.readFileSync(path.join(addons, 'arcdps_boon_table.dll.disabled'), 'utf-8')).toBe('live')
  })

  it('re-enabling cleans up a leftover .disabled left beside an install .bak', () => {
    // Regression: a plugin installed via the app leaves a `.bak`; disabling then
    // re-enabling used to strip the `.bak` and strand the real `.disabled`,
    // wedging the next disable on "already exists".
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll.disabled'), 'current')
    fs.writeFileSync(path.join(addons, 'arcdps_boon_table.dll.bak'), 'old')
    const det = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    expect(det.disabled).toBe(true)
    setPluginDisabled(det, false)
    // Exactly one file remains: the live DLL with the current bytes.
    expect(fs.readdirSync(addons).sort()).toEqual(['arcdps_boon_table.dll'])
    expect(fs.readFileSync(path.join(addons, 'arcdps_boon_table.dll'), 'utf-8')).toBe('current')
    // And a subsequent disable no longer collides.
    const again = detectInstalledPlugins(gw2).find(p => p.id === 'boon_table')!
    expect(() => setPluginDisabled(again, true)).not.toThrow()
    expect(fs.readdirSync(addons).sort()).toEqual(['arcdps_boon_table.dll.disabled'])
  })
})

describe('computeFileMd5', () => {
  it('returns md5 hex of a file', () => {
    const f = path.join(os.tmpdir(), `md5-${Date.now()}.bin`)
    fs.writeFileSync(f, 'hello')
    expect(computeFileMd5(f)).toBe('5d41402abc4b2a76b9719d911017c592')
    fs.unlinkSync(f)
  })
})

describe('checkArcdpsCoreUpdate', () => {
  it('reports up-to-date when hashes match', async () => {
    const dll = path.join(os.tmpdir(), `arc-${Date.now()}.dll`)
    fs.writeFileSync(dll, 'hello')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '5d41402abc4b2a76b9719d911017c592 *d3d11.dll\n',
    } as any)
    const r = await checkArcdpsCoreUpdate(dll, fetchImpl)
    expect(r).toEqual({ upToDate: true, remoteMd5: '5d41402abc4b2a76b9719d911017c592', localMd5: '5d41402abc4b2a76b9719d911017c592' })
    fs.unlinkSync(dll)
  })

  it('reports update available when hashes differ', async () => {
    const dll = path.join(os.tmpdir(), `arc-${Date.now()}.dll`)
    fs.writeFileSync(dll, 'world')
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '5d41402abc4b2a76b9719d911017c592 *d3d11.dll\n',
    } as any)
    const r = await checkArcdpsCoreUpdate(dll, fetchImpl)
    expect(r?.upToDate).toBe(false)
    fs.unlinkSync(dll)
  })

  it('returns null when fetch fails', async () => {
    const dll = path.join(os.tmpdir(), `arc-${Date.now()}.dll`)
    fs.writeFileSync(dll, 'hello')
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false } as any)
    expect(await checkArcdpsCoreUpdate(dll, fetchImpl)).toBeNull()
    fs.unlinkSync(dll)
  })
})

describe('buildArcdpsState', () => {
  it('always shows arcdps and arcdps_axipulse even when not installed', async () => {
    const gw2 = path.join(os.tmpdir(), `arcdps-state-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: {},
      fetchRelease: async () => null,
      fetchCoreMd5: async () => null,
    })
    expect(state.plugins.find(p => p.id === 'arcdps')).toBeDefined()
    expect(state.plugins.find(p => p.id === 'arcdps_axipulse')).toBeDefined()
    expect(state.plugins.find(p => p.id === 'boon_table')).toBeUndefined()
  })

  it('shows a detect-only plugin when its DLL exists', async () => {
    const gw2 = path.join(os.tmpdir(), `arcdps-state2-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    fs.writeFileSync(path.join(gw2, 'bin64', 'arcdps_boon_table.dll'), 'fake')
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: { boon_table: { installedTag: 'v1.0', installedAt: '2026-01-01' } },
      fetchRelease: async () => ({ version: '1.1', downloadUrl: 'https://x/y.dll' }),
      fetchCoreMd5: async () => null,
    })
    const bt = state.plugins.find(p => p.id === 'boon_table')!
    expect(bt.installed).toBe(true)
    expect(bt.installedTag).toBe('v1.0')
    expect(bt.latestTag).toBe('1.1')
    expect(bt.upToDate).toBe(false)
  })

  it('uses asset digest (not size) to decide up-to-date when sizes collide', async () => {
    // Regression: AxiPulse v0.1.8 and v0.2.0 shipped DLLs with identical
    // byte sizes. Size-only equivalence falsely reported "up to date".
    const gw2 = path.join(os.tmpdir(), `arcdps-state-digest-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const dll = path.join(gw2, 'bin64', 'arcdps_axipulse.dll')
    const localBytes = Buffer.from('local-v0.1.8-bytes')
    fs.writeFileSync(dll, localBytes)
    const remoteSha256 = 'a'.repeat(64) // differs from sha256(localBytes)
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: { arcdps_axipulse: { installedTag: '0.1.8', installedAt: '2026-05-25' } },
      fetchRelease: async () => ({
        version: '0.2.0',
        downloadUrl: 'https://example.test/arcdps_axipulse.dll',
        assetSize: localBytes.length,            // collides on purpose
        assetDigest: `sha256:${remoteSha256}`,
      }),
      fetchCoreMd5: async () => null,
    })
    const p = state.plugins.find(x => x.id === 'arcdps_axipulse')!
    expect(p.upToDate).toBe(false)
    expect(p.installedTag).toBe('0.1.8')
    expect(p.latestTag).toBe('0.2.0')
  })

  it('reports up-to-date when local digest matches the asset digest', async () => {
    const gw2 = path.join(os.tmpdir(), `arcdps-state-digest-match-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const dll = path.join(gw2, 'bin64', 'arcdps_axipulse.dll')
    const bytes = Buffer.from('matching-bytes')
    fs.writeFileSync(dll, bytes)
    const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: {},
      fetchRelease: async () => ({
        version: '0.2.0',
        downloadUrl: 'https://example.test/arcdps_axipulse.dll',
        assetSize: 999,                          // intentionally wrong
        assetDigest: `sha256:${sha256}`,
      }),
      fetchCoreMd5: async () => null,
    })
    const p = state.plugins.find(x => x.id === 'arcdps_axipulse')!
    expect(p.upToDate).toBe(true)
    expect(p.installedTag).toBe('0.2.0')
  })

  it('flags a digest mismatch as a local build when the DLL is newer than the release', async () => {
    // A locally built DLL never hashes like any release asset. If its mtime
    // postdates the latest release's publish time, it cannot be a stale old
    // version — don't offer a "downgrade" update for it.
    const gw2 = path.join(os.tmpdir(), `arcdps-state-localbuild-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const dll = path.join(gw2, 'bin64', 'arcdps_axipulse.dll')
    fs.writeFileSync(dll, 'freshly-built-local-bytes') // mtime = now
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: {},
      fetchRelease: async () => ({
        version: '0.3.1',
        downloadUrl: 'https://example.test/arcdps_axipulse.dll',
        assetDigest: `sha256:${'a'.repeat(64)}`,
        publishedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(), // released yesterday
      }),
      fetchCoreMd5: async () => null,
    })
    const p = state.plugins.find(x => x.id === 'arcdps_axipulse')!
    expect(p.localBuild).toBe(true)
    expect(p.upToDate).toBeNull()
    expect(arcdpsPluginHasUpdate(p)).toBe(false)
  })

  it('still flags an update when the mismatched DLL predates the release', async () => {
    const gw2 = path.join(os.tmpdir(), `arcdps-state-stale-${Date.now()}`)
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const dll = path.join(gw2, 'bin64', 'arcdps_axipulse.dll')
    fs.writeFileSync(dll, 'old-release-bytes')
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    fs.utimesSync(dll, old, old) // installed a month ago
    const state = await buildArcdpsState({
      gw2Path: gw2,
      gw2PathSource: 'manual',
      recordedInstalls: {},
      fetchRelease: async () => ({
        version: '0.3.1',
        downloadUrl: 'https://example.test/arcdps_axipulse.dll',
        assetDigest: `sha256:${'a'.repeat(64)}`,
        publishedAt: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
      }),
      fetchCoreMd5: async () => null,
    })
    const p = state.plugins.find(x => x.id === 'arcdps_axipulse')!
    expect(p.localBuild).toBe(false)
    expect(p.upToDate).toBe(false)
    expect(arcdpsPluginHasUpdate(p)).toBe(true)
  })

  it('returns empty plugins list when no gw2Path', async () => {
    const state = await buildArcdpsState({
      gw2Path: null,
      gw2PathSource: 'none',
      recordedInstalls: {},
      fetchRelease: async () => null,
      fetchCoreMd5: async () => null,
    })
    expect(state.plugins).toEqual([])
  })
})

describe('installPluginFile', () => {
  const root = path.join(os.tmpdir(), `arcdps-install-${Date.now()}`)
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true })
    fs.mkdirSync(root, { recursive: true })
  })

  it('places the new file at target when no prior file', async () => {
    const target = path.join(root, 'd3d11.dll')
    const download = vi.fn(async (_url: string, dest: string) => {
      fs.writeFileSync(dest, 'new')
    })
    await installPluginFile({ targetPath: target, downloadUrl: 'http://x', download })
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
  })

  it('backs up existing file and replaces it', async () => {
    const target = path.join(root, 'd3d11.dll')
    fs.writeFileSync(target, 'old')
    const download = vi.fn(async (_url: string, dest: string) => {
      fs.writeFileSync(dest, 'new')
    })
    await installPluginFile({ targetPath: target, downloadUrl: 'http://x', download })
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
    expect(fs.readFileSync(target + '.bak', 'utf-8')).toBe('old')
  })

  it('rolls back from .bak when download fails', async () => {
    const target = path.join(root, 'd3d11.dll')
    fs.writeFileSync(target, 'old')
    const download = vi.fn(async () => { throw new Error('network') })
    await expect(installPluginFile({ targetPath: target, downloadUrl: 'http://x', download }))
      .rejects.toThrow('network')
    expect(fs.readFileSync(target, 'utf-8')).toBe('old')
  })

  it('creates installDir if missing', async () => {
    const target = path.join(root, 'nested', 'sub', 'extras.dll')
    const download = vi.fn(async (_url: string, dest: string) => {
      fs.writeFileSync(dest, 'new')
    })
    await installPluginFile({ targetPath: target, downloadUrl: 'http://x', download })
    expect(fs.readFileSync(target, 'utf-8')).toBe('new')
  })
})

describe('arcdpsPluginHasUpdate', () => {
  const base = { upToDate: false, disabled: false }
  it('flags an enabled, out-of-date plugin', () => {
    expect(arcdpsPluginHasUpdate({ ...base })).toBe(true)
  })
  it('does NOT flag a disabled plugin even when out of date', () => {
    // Regression: a disabled plugin (Player_List.dll.disabled) was lighting the
    // tray update dot, so AxiOM showed a red dot with "no update available".
    expect(arcdpsPluginHasUpdate({ upToDate: false, disabled: true })).toBe(false)
  })
  it('does not flag an up-to-date plugin', () => {
    expect(arcdpsPluginHasUpdate({ upToDate: true, disabled: false })).toBe(false)
  })
  it('treats unknown (null) upToDate as no update', () => {
    expect(arcdpsPluginHasUpdate({ upToDate: null, disabled: false })).toBe(false)
  })
})
