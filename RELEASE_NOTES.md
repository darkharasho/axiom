# Release Notes

Version v0.2.10 — June 22, 2026

## Fixes

- Fixed AxiOM not launching on login on Linux after an update. Each update moves the app to a new file, and the autostart entry was left pointing at the old one — so nothing started on boot. It now follows the app to its new location automatically.

NOTE: If you're already stuck on a broken autostart entry, open AxiOM once after updating and it'll repair itself.
