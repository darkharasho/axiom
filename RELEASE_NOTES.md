# Release Notes

Version v0.1.13 — May 1, 2026

## Linux launcher fixes

- `gtk-launch` should now consistently open apps after an update. Previously a stale `.desktop` entry could point at an AppImage that no longer existed, so launches silently failed.
- On startup, AxiOM sweeps `${appId}.desktop` files and rewrites any whose `TryExec` points at a missing or outdated AppImage.
- Updates always rewrite the desktop entry from scratch instead of trying to regex-patch the existing one, which was fragile when the entry had been created by GearLever or the AppImage's own first-run prompt.
