import type { AppStatus, ArcdpsPluginStatus, ArcdpsState } from './shared/types'

// An update check and an install both write the same state objects. A check
// that lands mid-install used to stomp the install's 'downloading' status back
// to 'checking'/'idle', which made the progress bar vanish and the "Update"
// button reappear — so the install looked like it never started and the user
// clicked Update a second time. These guards let a check skip whatever is
// already in flight.

export function isAppBusy(status: AppStatus | undefined): boolean {
  return status === 'downloading' || status === 'installing' || status === 'deleting'
}

export function isArcdpsPluginBusy(status: ArcdpsPluginStatus | undefined): boolean {
  return status === 'downloading' || status === 'installing'
}

// A refresh rebuilds the whole arcdps state from disk, so it can't merge
// per-field like setState does. Carry the in-flight plugins over wholesale —
// the install handler writes their final state when it finishes, and the next
// refresh picks up the fresh tags then.
export function preserveInFlightPlugins(prev: ArcdpsState, next: ArcdpsState): ArcdpsState {
  if (!prev.plugins.some(p => isArcdpsPluginBusy(p.status))) return next
  return {
    ...next,
    plugins: next.plugins.map(p => {
      const before = prev.plugins.find(q => q.id === p.id)
      return before && isArcdpsPluginBusy(before.status) ? before : p
    }),
  }
}
