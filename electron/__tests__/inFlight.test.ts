import { describe, it, expect } from 'vitest'
import { WriteLog, isAppBusy, isArcdpsPluginBusy, mergeRefreshedPlugins } from '../inFlight'
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

// A check reads config and scans disk up front, then spends seconds on the
// network before writing its result back. Anything the user did in that window
// is newer than the check's snapshot, even if it has already finished and left
// no 'downloading' status behind to notice.
describe('WriteLog', () => {
  it('reports nothing touched when no writes happened', () => {
    const log = new WriteLog()
    const token = log.begin()

    expect(log.touchedSince(token)('axipulse')).toBe(false)
  })

  it('reports a write that landed after the snapshot', () => {
    const log = new WriteLog()
    const token = log.begin()
    log.record('axipulse')

    expect(log.touchedSince(token)('axipulse')).toBe(true)
  })

  it('ignores writes that landed before the snapshot', () => {
    const log = new WriteLog()
    log.record('axipulse')
    const token = log.begin()

    expect(log.touchedSince(token)('axipulse')).toBe(false)
  })

  it('scopes writes to their own id', () => {
    const log = new WriteLog()
    const token = log.begin()
    log.record('axipulse')

    expect(log.touchedSince(token)('healing_stats')).toBe(false)
  })

  it('keeps two overlapping checks independent', () => {
    const log = new WriteLog()
    const older = log.begin()
    log.record('axipulse')
    const newer = log.begin()

    expect(log.touchedSince(older)('axipulse')).toBe(true)
    expect(log.touchedSince(newer)('axipulse')).toBe(false)
  })

  it('keeps a repeated write visible to the older snapshot', () => {
    const log = new WriteLog()
    const token = log.begin()
    log.record('axipulse')
    log.record('axipulse')

    expect(log.touchedSince(token)('axipulse')).toBe(true)
  })
})

describe('mergeRefreshedPlugins', () => {
  const untouched = () => false

  it('keeps an install that completed while the check was still running', () => {
    // The whole point: the install is over, status is back to idle, and the only
    // thing marking it is that its write is newer than the check's snapshot.
    const prev = state([plugin({ status: 'idle', installedTag: 'v1.1.0', upToDate: true })])
    const next = state([plugin({ status: 'idle', installedTag: 'v1.0.0', upToDate: false })])

    const merged = mergeRefreshedPlugins(prev, next, id => id === 'arcdps_axipulse')

    expect(merged.plugins[0].upToDate).toBe(true)
    expect(merged.plugins[0].installedTag).toBe('v1.1.0')
  })

  it('keeps a plugin that is still downloading even if nothing was recorded', () => {
    const prev = state([plugin({ status: 'downloading', downloadProgress: { percent: 40, bytesReceived: 4, totalBytes: 10 } })])
    const next = state([plugin({ status: 'idle', upToDate: false })])

    const merged = mergeRefreshedPlugins(prev, next, untouched)

    expect(merged.plugins[0].status).toBe('downloading')
    expect(merged.plugins[0].downloadProgress).toEqual({ percent: 40, bytesReceived: 4, totalBytes: 10 })
  })

  it('takes the fresh entry for plugins the user did not touch', () => {
    const prev = state([plugin({ latestTag: 'v1.0.0', upToDate: true })])
    const next = state([plugin({ latestTag: 'v1.1.0', upToDate: false })])

    expect(mergeRefreshedPlugins(prev, next, untouched).plugins[0]).toEqual(next.plugins[0])
  })

  it('only preserves the touched plugin, not its siblings', () => {
    const prev = state([
      plugin({ id: 'arcdps_axipulse', upToDate: true }),
      plugin({ id: 'healing_stats', latestTag: 'old' }),
    ])
    const next = state([
      plugin({ id: 'arcdps_axipulse', upToDate: false }),
      plugin({ id: 'healing_stats', latestTag: 'new' }),
    ])

    const merged = mergeRefreshedPlugins(prev, next, id => id === 'arcdps_axipulse')

    expect(merged.plugins[0].upToDate).toBe(true)
    expect(merged.plugins[1].latestTag).toBe('new')
  })

  it('returns the fresh state untouched when nothing is busy or recorded', () => {
    const prev = state([plugin()])
    const next = state([plugin({ latestTag: 'v2' })])

    expect(mergeRefreshedPlugins(prev, next, untouched)).toBe(next)
  })

  it('carries top-level fields (gw2Path, plugin list) from the fresh state', () => {
    const prev = state([plugin({ status: 'downloading' })])
    const next: ArcdpsState = {
      gw2Path: '/new/gw2',
      gw2PathSource: 'manual',
      overrideError: null,
      plugins: [plugin(), plugin({ id: 'player_outline' })],
    }

    const merged = mergeRefreshedPlugins(prev, next, untouched)

    expect(merged.gw2Path).toBe('/new/gw2')
    expect(merged.gw2PathSource).toBe('manual')
    expect(merged.plugins).toHaveLength(2)
  })

  it('drops a touched plugin that no longer exists in the fresh scan', () => {
    const prev = state([plugin({ id: 'gone' })])
    const next = state([plugin({ id: 'still_here' })])

    expect(mergeRefreshedPlugins(prev, next, () => true).plugins.map(p => p.id)).toEqual(['still_here'])
  })
})
