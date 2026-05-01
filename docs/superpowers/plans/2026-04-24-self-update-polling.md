# Self-Update Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poll for Axiom self-updates every hour so long-running tray users are notified of new versions without restarting.

**Architecture:** Add a `SELF_UPDATE_INTERVAL_MS` constant and a `setInterval` inside the existing `app.isPackaged` block in `electron/main.ts`, mirroring the managed-app polling pattern already present. No new IPC, state, or UI — the existing `axiom:self-update-status` events and titlebar indicator handle all downstream UX.

**Tech Stack:** electron-updater (`autoUpdater`), Node.js `setInterval`

---

### Task 1: Add hourly self-update polling

**Files:**
- Modify: `electron/main.ts:18-19` (constants block), `electron/main.ts:119-125` (app.isPackaged block)

- [ ] **Step 1: Add the `SELF_UPDATE_INTERVAL_MS` constant**

In `electron/main.ts`, find the two existing interval constants at lines 18-19:

```ts
const CHECK_INTERVAL_MS = 30 * 60 * 1000  // 30 minutes
const TRAY_RECHECK_MS   =  5 * 60 * 1000  //  5 minutes
```

Add a third constant immediately after them:

```ts
const CHECK_INTERVAL_MS      = 30 * 60 * 1000  // 30 minutes
const TRAY_RECHECK_MS        =  5 * 60 * 1000  //  5 minutes
const SELF_UPDATE_INTERVAL_MS = 60 * 60 * 1000  //  1 hour
```

- [ ] **Step 2: Add the `setInterval` inside the `app.isPackaged` block**

Find the existing block (lines 119-125):

```ts
  if (app.isPackaged) {
    log.transports.console.level = false
    autoUpdater.logger = log
    // Use checkForUpdates (not checkForUpdatesAndNotify) so we don't fire a
    // system notification — the titlebar indicator in AppList handles UX.
    autoUpdater.checkForUpdates()
  }
```

Replace it with:

```ts
  if (app.isPackaged) {
    log.transports.console.level = false
    autoUpdater.logger = log
    // Use checkForUpdates (not checkForUpdatesAndNotify) so we don't fire a
    // system notification — the titlebar indicator in AppList handles UX.
    autoUpdater.checkForUpdates()
    setInterval(() => { autoUpdater.checkForUpdates() }, SELF_UPDATE_INTERVAL_MS)
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add electron/main.ts
git commit -m "feat(self-update): poll for axiom updates every hour"
```
