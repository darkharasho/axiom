# Release Notes

Version v0.3.9 — July 8, 2026

## Fixes

- Fixed AxiOM sometimes repointing an app's desktop shortcut at an older installed version. If you had more than one version of an app's AppImage sitting on disk, the launcher repair could grab whichever it happened to find first instead of the newest one. It now always picks the latest version.

Version v0.3.8 — July 7, 2026

## AxiStream in the app list

AxiStream now shows up alongside the other Axi apps so you can install and update it from here. It's a private tool, so you'll need to be signed in with access to see it.

## Fixes

- The "update available" indicator now shows up on its own again. It was quietly downloading new versions in the background but not always lighting up the titlebar, so you had to open Settings and hit "Check" to make it appear. No more — it surfaces the moment an update is ready.
- When AxiOM can't reach the arcdps server to check its version, the arcdps row now says "Couldn't check for updates" instead of showing a grayed-out "Update to latest" that looked broken. Hit "Check for updates" to retry.
