import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/axiom-test-userdata' } }))

import { resolveGw2Path, detectInstalledPlugins } from '../arcdps'

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
    expect(result).toEqual({ path: gw2, source: 'manual' })
  })

  it('falls back to AxiAM config when no override', () => {
    const gw2 = path.join(tmpRoot, 'GW2Axiam')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const axiamCfg = path.join(tmpRoot, 'axiam.json')
    fs.writeFileSync(axiamCfg, JSON.stringify({ gw2Path: gw2 }))
    const result = resolveGw2Path({ override: null, axiamConfigPath: axiamCfg, candidates: [] })
    expect(result).toEqual({ path: gw2, source: 'axiam' })
  })

  it('falls back to candidates when AxiAM config missing', () => {
    const gw2 = path.join(tmpRoot, 'GW2Auto')
    fs.mkdirSync(path.join(gw2, 'bin64'), { recursive: true })
    fs.writeFileSync(path.join(gw2, 'bin64', 'Gw2-64.exe'), 'x')
    const result = resolveGw2Path({ override: null, axiamConfigPath: '/nonexistent', candidates: [gw2] })
    expect(result).toEqual({ path: gw2, source: 'auto' })
  })

  it('returns none when nothing resolves', () => {
    const result = resolveGw2Path({ override: null, axiamConfigPath: '/nonexistent', candidates: [] })
    expect(result).toEqual({ path: null, source: 'none' })
  })

  it('ignores AxiAM path that does not contain bin64/Gw2-64.exe', () => {
    const bogus = path.join(tmpRoot, 'NotGW2')
    fs.mkdirSync(bogus, { recursive: true })
    const axiamCfg = path.join(tmpRoot, 'axiam.json')
    fs.writeFileSync(axiamCfg, JSON.stringify({ gw2Path: bogus }))
    const result = resolveGw2Path({ override: null, axiamConfigPath: axiamCfg, candidates: [] })
    expect(result).toEqual({ path: null, source: 'none' })
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

  it('detects arcdps core (d3d11.dll)', () => {
    fs.writeFileSync(path.join(bin64, 'd3d11.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('arcdps')
  })

  it('detects a github plugin in bin64', () => {
    fs.writeFileSync(path.join(bin64, 'arcdps_boon_table.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('boon_table')
  })

  it('detects unofficial_extras in extensions/', () => {
    fs.writeFileSync(path.join(ext, 'extras.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    expect(found.map(p => p.id)).toContain('unofficial_extras')
  })

  it('ignores arbitrary DLLs not in the registry', () => {
    fs.writeFileSync(path.join(bin64, 'random_other.dll'), 'fake')
    expect(detectInstalledPlugins(gw2)).toEqual([])
  })

  it('returns each meta only once even if both bin64 and extensions match', () => {
    fs.writeFileSync(path.join(bin64, 'd3d11.dll'), 'fake')
    const found = detectInstalledPlugins(gw2)
    const arcCount = found.filter(p => p.id === 'arcdps').length
    expect(arcCount).toBe(1)
  })
})
