---
title: Periodic Self-Update Polling
date: 2026-04-24
status: approved
---

## Problem

`autoUpdater.checkForUpdates()` is called once at startup. Users who leave Axiom running in the tray for days never get notified of new versions.

## Solution

Add a 1-hour `setInterval` inside the `app.isPackaged` block in `electron/main.ts` to poll for Axiom self-updates periodically.

## Change

**File:** `electron/main.ts`

Add constant alongside the existing `CHECK_INTERVAL_MS`:
```ts
const SELF_UPDATE_INTERVAL_MS = 60 * 60 * 1000  // 1 hour
```

Add interval after the startup check:
```ts
if (app.isPackaged) {
  autoUpdater.logger = log
  autoUpdater.checkForUpdates()
  setInterval(() => { autoUpdater.checkForUpdates() }, SELF_UPDATE_INTERVAL_MS)
}
```

## Constraints

- Only runs when `app.isPackaged` — dev mode unaffected
- No new IPC, state, or UI — existing `axiom:self-update-status` events and titlebar indicator handle all downstream UX
- `FAKE_UPDATE` dev mode unaffected (interval calls `autoUpdater`, not the IPC handler)
