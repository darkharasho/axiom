# Release Notes

Version v0.1.8 — April 23, 2026

## Windows Launch, Fixed

Clicking Launch on Windows actually launches the app now. The old flow looked up apps in the registry, grabbed the first `.exe` it could find, and handed it to the OS to open — which quietly failed in a bunch of cases and left you staring at a button that did nothing.

The new flow:
- Finds the real executable via `DisplayIcon` (with `InstallLocation` as fallback), including 32-bit installs under `WOW6432Node`.
- Spawns the app directly as a detached process with a clean environment, so it doesn't inherit AxiOM's Electron/dev variables and open to a black screen.
- If the app is already running, focuses its existing window instead of launching a second copy.
- Logs each step to the terminal so launch failures aren't invisible anymore.

## Fixes

- AxiForge's Windows installer is now detected correctly — the asset matcher no longer required "Setup" in the filename.
