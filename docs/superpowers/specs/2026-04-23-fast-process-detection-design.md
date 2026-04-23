# Fast Process Detection Design

**Date:** 2026-04-23  
**Status:** Approved

## Problem

Process detection is too slow in both directions — after launching an app the UI takes up to 8 seconds to flip to "running", and after closing an app it takes just as long to flip back. The current implementation polls 4 apps **sequentially** every 8 seconds using subprocess calls (`pgrep` on Linux, `tasklist` on Windows), with no timeout protection on those calls.

## Solution

Two complementary improvements:

1. **Parallel polling at a faster baseline cadence** — all apps checked simultaneously every 3s
2. **Hyper mode** — 500ms polling for 10s whenever a state transition is detected or initiated

## Architecture

### Constants

```typescript
const POLL_NORMAL_MS = 3000   // baseline interval
const POLL_HYPER_MS = 500     // interval during hyper mode
const HYPER_DURATION_MS = 10000  // how long hyper mode stays active
const PROCESS_CHECK_TIMEOUT_MS = 3000  // per-call subprocess timeout
```

### `isProcessRunning()` — add timeout

Wrap the existing `exec()` callback in a race against a 3s timeout. If the subprocess hangs, resolve `false` rather than stalling the cycle indefinitely.

### `pollRunningStates()` — parallel execution

Replace the sequential `for...await` loop with `Promise.all()` over all installable, installed apps. This means 4 checks take as long as the slowest one, not the sum of all four.

If any check detects a state flip (running ↔ not running), call `activateHyperMode()` so we continue polling aggressively through the full transition.

### Hyper mode

Two module-level variables track mode:

- `hyperModeUntil: number` — timestamp when hyper mode expires (0 = inactive)

`activateHyperMode()` sets `hyperModeUntil = Date.now() + HYPER_DURATION_MS`.

**Triggers:**
- User clicks **Launch** on any app (inside `axiom:launch` handler)
- User clicks **Quit** on any app — if a per-app quit handler exists, trigger there; otherwise the existing `axiom:quit` is app-wide so hyper mode isn't needed
- Poll detects a state flip externally (app crashed or opened outside axiom)

### Self-scheduling poll loop

Replace `setInterval(pollRunningStates, 8000)` with a `setTimeout`-based loop that picks its own next delay:

```typescript
function scheduleNextPoll() {
  const delay = Date.now() < hyperModeUntil ? POLL_HYPER_MS : POLL_NORMAL_MS
  pollTimer = setTimeout(async () => {
    await pollRunningStates()
    scheduleNextPoll()
  }, delay)
}
```

The timer handle is stored so it can be cleared when the window closes.

## Changes Required

All changes are confined to `electron/ipc-handlers.ts`:

1. Add four constants at the top of the module
2. Add `hyperModeUntil` module-level variable (initialized to 0)
3. Add `activateHyperMode()` helper
4. Add timeout wrapper inside `isProcessRunning()`
5. Rewrite `pollRunningStates()` to use `Promise.all()` and call `activateHyperMode()` on detected flips
6. Replace `setInterval` with `scheduleNextPoll()` self-scheduling loop
7. Call `activateHyperMode()` inside the `axiom:launch` handler (after the `axitools` early return)

## Behavior After Change

| Scenario | Before | After |
|---|---|---|
| User clicks Launch | Up to 8s to show "running" | ~500ms–1s |
| App crashes externally | Up to 8s to show "not running" | Up to 3s (then hyper kicks in) |
| Baseline background poll | 8s sequential | 3s parallel |
| Hung subprocess | Blocks entire cycle indefinitely | Times out after 3s, resolves false |

## Out of Scope

- Event-driven OS process watching (`inotify`, WMI subscriptions) — adds significant platform complexity for marginal gain over this approach
- Per-app quit detection — axiom doesn't currently track which managed app the user quits from within that app
