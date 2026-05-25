import { describe, it, expect } from 'vitest'
import { ARCDPS_REGISTRY, getPluginMeta } from '../arcdpsRegistry'

describe('ARCDPS_REGISTRY', () => {
  it('contains arcdps and arcdps_axipulse as always-shown', () => {
    const arc = getPluginMeta('arcdps')
    const axip = getPluginMeta('arcdps_axipulse')
    expect(arc?.alwaysShow).toBe(true)
    expect(axip?.alwaysShow).toBe(true)
  })

  it('marks all other registered plugins as detect-only', () => {
    const detectOnly = ARCDPS_REGISTRY.filter(p => !p.alwaysShow)
    expect(detectOnly.length).toBeGreaterThan(0)
    for (const p of detectOnly) expect(p.alwaysShow).toBe(false)
  })

  it('arcdps source is deltaconnected, all others are github', () => {
    const arc = getPluginMeta('arcdps')!
    expect(arc.source.kind).toBe('deltaconnected')
    for (const p of ARCDPS_REGISTRY) {
      if (p.id !== 'arcdps') expect(p.source.kind).toBe('github')
    }
  })

  it('unofficial_extras installs into the extensions subfolder', () => {
    const ue = getPluginMeta('unofficial_extras')
    expect(ue?.installDir).toBe('bin64/arcdps/extensions')
  })
})
