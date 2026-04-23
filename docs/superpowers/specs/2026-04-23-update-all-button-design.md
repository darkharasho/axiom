# Update All Button — Design Spec

**Date:** 2026-04-23  
**Status:** Approved

## Overview

When 2 or more managed apps in the Axi suite have pending updates, an "Update All" button appears in the footer of `AppList`. Clicking it triggers all eligible installs in parallel. AxiOM's own self-update is excluded.

## Eligibility

An app qualifies for "Update All" if:
- `installedVersion` is set (app is installed)
- `latestVersion` differs from `installedVersion` (`hasUpdate === true`)
- `status` is not `'downloading'`, `'installing'`, or `'deleting'` (not already busy)

The button renders only when `eligibleApps.length >= 2`.

## Behavior

**On click:** call `window.axiom.install(appId)` for every eligible app simultaneously — no sequencing, no queue. Each `AppRow` transitions to its normal `downloading → installing → idle` flow independently, showing its own `ProgressBar` as it always does.

**Button lifecycle:** once installs are triggered, each app's `status` moves to `'downloading'`, dropping it from the eligible list. The button disappears naturally as the count falls below 2 — no extra local state needed.

## UI

- **Location:** footer of `AppList`, bottom-right (right of the existing "Check for updates" / "Quit" row)
- **Style:** matches the per-row gold Update button — `var(--gold-bright)` text, small font (11px), ghost/minimal background, consistent with footer button scale
- **Label:** "Update All"

## Scope

- `src/components/AppList.tsx` — only file changed
- No new IPC, no new state, no changes to `AppRow`, `ipc-handlers`, or electron main
