import { describe, it, expect } from 'vitest'
import { ARCDPS_REGISTRY, getPluginMeta } from '../arcdpsRegistry'

describe('ARCDPS_REGISTRY', () => {
  // First-party plugins are shown even when not installed, so users can
  // install them straight from AxiOM. Third-party plugins are detect-only.
  const ALWAYS_SHOWN = ['arcdps', 'arcdps_axipulse', 'player_outline']

  it('marks the first-party plugins as always-shown', () => {
    for (const id of ALWAYS_SHOWN) expect(getPluginMeta(id)?.alwaysShow).toBe(true)
  })

  it('marks all other registered plugins as detect-only', () => {
    const detectOnly = ARCDPS_REGISTRY.filter(p => !ALWAYS_SHOWN.includes(p.id))
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

  it('unofficial_extras supports both the Nexus addons/ location and the legacy extensions subfolder', () => {
    const ue = getPluginMeta('unofficial_extras')!
    const dirs = ue.locations.map(l => l.dir)
    expect(dirs).toContain('addons')
    expect(dirs).toContain('bin64/arcdps/extensions')
  })

  it('unofficial_extras assetPattern matches the asset name the release actually ships', () => {
    // The Krappa322/arcdps_unofficial_extras_releases release publishes its DLL
    // as "arcdps_unofficial_extras.dll" (not "extras.dll"). If the assetPattern
    // doesn't match it, fetchLatestRelease returns null and version matching never runs.
    const ue = getPluginMeta('unofficial_extras')!
    expect(ue.assetPattern!.test('arcdps_unofficial_extras.dll')).toBe(true)
    // Still tolerate the canonical / Nexus-renamed variants seen in the wild.
    expect(ue.assetPattern!.test('extras.dll')).toBe(true)
    expect(ue.assetPattern!.test('Unofficial_Extras.dll')).toBe(true)
  })

  it('arcdps prefers addons/ (ArcDPS.dll, Nexus chainload) over GW2 root (d3d11.dll)', () => {
    // addons/ must be checked first because Nexus also uses root d3d11.dll
    const arc = getPluginMeta('arcdps')!
    expect(arc.locations.map(l => l.dir)).toEqual(['addons', ''])
    expect(arc.locations[0].installFilename).toBe('ArcDPS.dll')
    expect(arc.locations[1].installFilename).toBe('d3d11.dll')
  })

  // The asset name each GitHub release actually publishes, captured from the
  // releases API. If a plugin's assetPattern stops matching its real asset,
  // fetchLatestRelease returns null and version matching silently dies.
  const REAL_ASSET_NAMES: Record<string, string> = {
    arcdps_axipulse: 'arcdps_axipulse.dll',
    squad_roles: 'arcdps_squadroles.dll',
    squad_ready: 'arcdps_squad_ready.dll',
    player_list: 'player_list.dll',
    mechanics_log: 'd3d9_arcdps_mechanics.dll',
    healing_stats: 'arcdps_healing_stats.dll',
    killproof_me: 'd3d9_arcdps_killproof_me.dll',
    food_reminder: 'arcdps_food_reminder.dll',
    arc_clears: 'arcdps_clears.dll',
    chat_log: 'arcdps_chat_log.dll',
    gw2_buddy: 'arcdps_buddy.dll',
    boon_table: 'd3d9_arcdps_table.dll',
    bhud: 'arcdps_bhud.dll',
    commander_tag_accessibility: 'CommanderTagAccessibility.dll',
    player_outline: 'arcdps_player_outline.dll',
    unofficial_extras: 'arcdps_unofficial_extras.dll',
  }

  it('every github plugin assetPattern matches the asset its release actually ships', () => {
    for (const [id, assetName] of Object.entries(REAL_ASSET_NAMES)) {
      const meta = getPluginMeta(id)!
      expect(meta.assetPattern, `${id} has no assetPattern`).toBeTruthy()
      expect(meta.assetPattern!.test(assetName), `${id}: ${meta.assetPattern} does not match ${assetName}`).toBe(true)
    }
  })

  it('every registered github plugin is covered by the real-asset check', () => {
    const githubIds = ARCDPS_REGISTRY.filter(p => p.source.kind === 'github').map(p => p.id)
    for (const id of githubIds) expect(REAL_ASSET_NAMES).toHaveProperty(id)
  })

  it('gw2_buddy assetPattern ignores the bundled nexus_buddy.dll', () => {
    // The release ships both arcdps_buddy.dll and nexus_buddy.dll; we must not
    // pick the Nexus build for an arcdps install.
    const meta = getPluginMeta('gw2_buddy')!
    expect(meta.assetPattern!.test('nexus_buddy.dll')).toBe(false)
  })

  it('every entry has a non-empty description', () => {
    for (const p of ARCDPS_REGISTRY) {
      expect(p.description.length).toBeGreaterThan(0)
    }
  })
})
