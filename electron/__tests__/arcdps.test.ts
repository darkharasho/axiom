import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

vi.mock('electron', () => ({ app: { getPath: () => '/tmp/axiom-test-userdata' } }))

import { resolveGw2Path } from '../arcdps'

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
