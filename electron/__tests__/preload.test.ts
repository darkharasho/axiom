import { describe, it, expect, beforeEach, vi } from 'vitest'

// The preload script calls contextBridge.exposeInMainWorld at import time, so we
// capture the exposed API and drive a fake ipcRenderer that behaves like the real
// EventEmitter-backed one (multiple listeners per channel, targeted removal).
type Listener = (event: unknown, ...args: unknown[]) => void
const listeners = new Map<string, Listener[]>()

const ipcRenderer = {
  invoke: vi.fn(),
  send: vi.fn(),
  on(channel: string, listener: Listener) {
    const existing = listeners.get(channel) ?? []
    listeners.set(channel, [...existing, listener])
  },
  removeListener(channel: string, listener: Listener) {
    listeners.set(channel, (listeners.get(channel) ?? []).filter(l => l !== listener))
  },
  removeAllListeners(channel: string) {
    listeners.delete(channel)
  },
}

let api: Record<string, any>

vi.mock('electron', () => ({
  ipcRenderer,
  contextBridge: {
    exposeInMainWorld: (_name: string, value: Record<string, any>) => {
      api = value
    },
  },
}))

function emit(channel: string, payload?: unknown) {
  for (const l of [...(listeners.get(channel) ?? [])]) l({}, payload)
}

beforeEach(async () => {
  listeners.clear()
  await import('../preload')
})

// Every subscription must unsubscribe only itself. `useSelfUpdate` is mounted in
// both App and SettingsView at once, so a teardown that wiped the whole channel
// killed App's listener when SettingsView unmounted — the titlebar update badge
// then went dead until relaunch.
const SUBSCRIPTIONS = [
  ['onSelfUpdateStatus', 'axiom:self-update-status'],
  ['onStatesUpdated', 'axiom:states-updated'],
  ['onRequestCheckUpdates', 'axiom:request-check-updates'],
  ['onGearLeverProgress', 'axiom:gear-lever-progress'],
  ['onArcdpsStateUpdated', 'arcdps:state-updated'],
  ['onGithubStatusUpdated', 'github:status-updated'],
] as const

describe('preload subscriptions', () => {
  it.each(SUBSCRIPTIONS)('%s delivers events to every subscriber', (method, channel) => {
    const a = vi.fn()
    const b = vi.fn()
    api[method](a)
    api[method](b)

    emit(channel, 'payload')

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it.each(SUBSCRIPTIONS)('%s unsubscribe removes only its own listener', (method, channel) => {
    const stays = vi.fn()
    api[method](stays)
    const off = api[method](vi.fn())

    off()
    emit(channel, 'payload')

    expect(stays).toHaveBeenCalledTimes(1)
    expect(listeners.get(channel) ?? []).toHaveLength(1)
  })

  it.each(SUBSCRIPTIONS)('%s unsubscribe is idempotent', (method, channel) => {
    const stays = vi.fn()
    api[method](stays)
    const off = api[method](vi.fn())

    off()
    off()
    emit(channel, 'payload')

    expect(stays).toHaveBeenCalledTimes(1)
  })

  it('passes the event payload through, not the electron event object', () => {
    const cb = vi.fn()
    api.onStatesUpdated(cb)

    emit('axiom:states-updated', [{ id: 'axipulse' }])

    expect(cb).toHaveBeenCalledWith([{ id: 'axipulse' }])
  })
})
