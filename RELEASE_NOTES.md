# Release Notes

Version v0.3.18 — August 22, 2026

## One click on Update is enough

Clicking **Update** could look like it did nothing, so you'd click it again. The download had in fact started — AxiOM just lost track of it. AxiOM checks for new versions on its own, when you open the tray popup and again every half hour, and those checks were allowed to overwrite whatever an install was in the middle of doing. The progress bar vanished, the Update button came back, and the only sign anything was happening was that the second click eventually finished.

Update checks now leave a download alone while it's running. The arcdps view had its own version of this — a refresh rescans the folder, and mid-download that scan still sees the old file, so it would report the update as still available. It now keeps whatever is in flight and picks up the new version once the install lands.

## Fixes

- Clicking **Update** twice in quick succession no longer starts two downloads of the same file.
- The update badge in the title bar stays live after you visit Settings. Opening Settings and going back used to silently disconnect it, so AxiOM would stop telling you about its own updates until you restarted it.
