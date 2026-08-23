import type { AppStatus, ArcdpsPluginStatus, ArcdpsState } from './shared/types'

// Update checks and user-initiated installs write the same main-process state.
// A check is not atomic: it reads the config and scans the install folders up
// front, then spends seconds on GitHub before writing the result back. An
// install that starts *and finishes* inside that window leaves nothing busy to
// notice, so the check's pre-install snapshot lands on top of the finished
// install — the row flips back to "Update available" and the user clicks Update
// a second time.
//
// A busy-status check alone can't see that, because by write-back time the
// status is idle again. What matters is ordering: was this app/plugin written
// after the check took its snapshot? WriteLog answers that.

export function isAppBusy(status: AppStatus | undefined): boolean {
  return status === 'downloading' || status === 'installing' || status === 'deleting'
}

export function isArcdpsPluginBusy(status: ArcdpsPluginStatus | undefined): boolean {
  return status === 'downloading' || status === 'installing'
}

/**
 * Records which ids have been written, in order, so a long-running read can tell
 * whether its snapshot went stale before it got to write back.
 *
 * Take a token with `begin()` before reading; call `touchedSince(token)(id)`
 * before writing. Counter-based rather than clock-based so two writes in the
 * same millisecond still order correctly.
 */
export class WriteLog {
  private seq = 0
  private lastWrite = new Map<string, number>()

  begin(): number {
    return this.seq
  }

  record(id: string): void {
    this.lastWrite.set(id, ++this.seq)
  }

  touchedSince(token: number): (id: string) => boolean {
    return id => (this.lastWrite.get(id) ?? 0) > token
  }
}

/**
 * Fold a freshly-scanned arcdps state into the current one. Top-level fields
 * (gw2Path and friends) always come from the fresh scan; a plugin keeps its
 * current entry if it is still busy, or if `touched` says it was written after
 * the scan began. A plugin that has vanished from disk is dropped either way.
 */
export function mergeRefreshedPlugins(
  prev: ArcdpsState,
  next: ArcdpsState,
  touched: (id: string) => boolean,
): ArcdpsState {
  const keep = (p: ArcdpsState['plugins'][number]) => isArcdpsPluginBusy(p.status) || touched(p.id)
  if (!prev.plugins.some(keep)) return next
  return {
    ...next,
    plugins: next.plugins.map(p => {
      const before = prev.plugins.find(q => q.id === p.id)
      return before && keep(before) ? before : p
    }),
  }
}
