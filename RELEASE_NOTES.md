# Release Notes

Version v0.3.5 — July 2, 2026

## arcdps updates get spotted right away

The update dot was easy to miss on patch day. arcdps was the last thing checked when AxiOM started, behind a full sweep of every app's GitHub releases — so for the first several seconds after opening the window, the dot simply wasn't there yet. It's now the first check, so a stale arcdps lights the dot almost immediately.

AxiOM also rechecks as soon as your machine wakes from sleep. Before, the 30-minute timer just didn't run while suspended — if arcdps shipped an update while your PC was asleep (which is exactly when it happens: right after a GW2 patch), nothing flagged it until the next scheduled check.

## Fixes

- Update checks now write their results to the log, including when a check fails to reach deltaconnected. If an update ever slips through again, `main.log` will show why instead of nothing.
