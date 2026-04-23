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

---

Version v0.1.7 — April 23, 2026

## Fixes

- Fixed a phantom "update available" bug on Linux. After updating an app through AxiOM and quitting, reopening AxiOM would sometimes show the same update pending again even though the app was already up to date. AxiOM now records the installed version itself instead of relying on the target app to write it on its next launch.

---

Version v0.1.6 — April 23, 2026

## Update All

When 2 or more of your managed apps have updates pending, an "Update All" button now appears at the top of the list. One click, done.

## Running Status Detects Much Faster

The app used to check whether your tools were running every 8 seconds, sequentially. It now checks all apps in parallel every 3 seconds — and bumps to every 500ms for 10 seconds after you launch something. You'll see the status flip almost immediately instead of waiting around.

## Fixes

- The tray red dot now clears as soon as an update finishes installing. Previously it would stick around until the next time you opened AxiOM.
- Right-click menu on the tray icon now positions correctly.
- Minor button hierarchy polish in the app list.

---

Version v0.1.5 — April 22, 2026

## Right-click context menu

Right-clicking the tray icon now shows a small context menu with **Open AxiOM** and **Quit**. This works on all platforms — previously right-clicking did nothing on Linux because the AppIndicator protocol doesn't fire click events, only context menus.

## Update badge on the tray icon

When any of your Axi apps has an update available, the tray icon now shows a small red badge in the corner (like Discord does). You can turn this off in Settings under **Badge tray icon on updates** — it's on by default.
