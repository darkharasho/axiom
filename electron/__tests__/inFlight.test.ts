import { describe, it, expect } from 'vitest'
import { isAppBusy, isArcdpsPluginBusy, preserveInFlightPlugins } from '../inFlight'
import type { ArcdpsPluginState, ArcdpsState } from '../shared/types'

function plugin(over: Partial<ArcdpsPluginState> = {}): ArcdpsPluginState {
  return {
    id: 'arcdps_axipulse',
    name: 'AxiPulse',
    description: '',
    alwaysShow: false,
    installed: true,
    disabled: false,
    installedDir: 'addons/arcdps',
    installedFilename: 'arcdps_axipulse.dll',
    installedTag: 'v1.0.0',
    installedAt: null,
    latestTag: 'v1.1.0',
    downloadUrl: 'https://example.test/a.dll',
    upToDate: false,
    localBuild: false,
    status: 'idle',
    ...over,
  }
}

function state(plugins: ArcdpsPluginState[]): ArcdpsState {
  return { gw2Path: '/gw2', gw2PathSource: 'auto', overrideError: null, plugins }
}

describe('isAppBusy', () => {
  it.each(['downloading', 'installing', 'deleting'] as const)('treats %s as busy', s => {
    expect(isAppBusy(s)).toBe(true)
  })

  it.each(['idle', 'checking', 'launching', 'error', undefined] as const)('treats %s as free', s => {
    expect(isAppBusy(s)).toBe(false)
  })
})

describe('isArcdpsPluginBusy', () => {
  it.each(['downloading', 'installing'] as const)('treats %s as busy', s => {
    expect(isArcdpsPluginBusy(s)).toBe(true)
  })

  it.each(['idle', 'checking', 'error', undefined] as const)('treats %s as free', s => {
    expect(isArcdpsPluginBusy(s)).toBe(false)
  })
})

describe('preserveInFlightPlugins', () => {
  it('keeps a downloading plugin instead of the freshly-scanned one', () => {
    const prev = state([plugin({ status: 'downloading', downloadProgress: { percent: 40, bytesReceived: 4, totalBytes: 10 } })])
    // A refresh mid-download rescans disk and sees the old, still-stale DLL.
    const next = state([plugin({ status: 'idle', upToDate: false })])

    const merged = preserveInFlightPlugins(prev, next)

    expect(merged.plugins[0].status).toBe('downloading')
    expect(merged.plugins[0].downloadProgress).toEqual({ percent: 40, bytesReceived: 4, totalBytes: 10 })
  })

  it('takes the fresh entry for plugins that are not busy', () => {
    const prev = state([plugin({ status: 'idle', latestTag: 'v1.0.0', upToDate: true })])
    const next = state([plugin({ status: 'idle', latestTag: 'v1.1.0', upToDate: false })])

    expect(preserveInFlightPlugins(prev, next).plugins[0]).toEqual(next.plugins[0])
  })

  it('only preserves the busy plugin, not its siblings', () => {
    const busy = plugin({ id: 'arcdps_axipulse', status: 'installing' })
    const idle = plugin({ id: 'healing_stats', status: 'idle', latestTag: 'old' })
    const prev = state([busy, idle])
    const next = state([
      plugin({ id: 'arcdps_axipulse', status: 'idle' }),
      plugin({ id: 'healing_stats', status: 'idle', latestTag: 'new' }),
    ])

    const merged = preserveInFlightPlugins(prev, next)

    expect(merged.plugins[0].status).toBe('installing')
    expect(merged.plugins[1].latestTag).toBe('new')
  })

  it('returns the fresh state untouched when nothing is in flight', () => {
    const prev = state([plugin({ status: 'idle' })])
    const next = state([plugin({ status: 'idle', latestTag: 'v2' })])

    expect(preserveInFlightPlugins(prev, next)).toBe(next)
  })

  it('carries top-level fields (gw2Path, plugin list) from the fresh state', () => {
    const prev = state([plugin({ status: 'downloading' })])
    const next: ArcdpsState = {
      gw2Path: '/new/gw2',
      gw2PathSource: 'manual',
      overrideError: null,
      plugins: [plugin(), plugin({ id: 'player_outline' })],
    }

    const merged = preserveInFlightPlugins(prev, next)

    expect(merged.gw2Path).toBe('/new/gw2')
    expect(merged.gw2PathSource).toBe('manual')
    expect(merged.plugins).toHaveLength(2)
  })

  it('drops a busy plugin that no longer exists in the fresh scan', () => {
    const prev = state([plugin({ id: 'gone', status: 'downloading' })])
    const next = state([plugin({ id: 'still_here' })])

    expect(preserveInFlightPlugins(prev, next).plugins.map(p => p.id)).toEqual(['still_here'])
  })
})
