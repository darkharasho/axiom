# Release Notes

Version v0.3.16 — August 9, 2026

## Launcher entries stay pointed at the right app

AxiOM writes the desktop entries for the apps it installs, and it now keeps them fully correct instead of only checking that the path still exists. If an entry drifts — a wrong name, a missing URL scheme registration — AxiOM repairs it the next time it starts, not just when the AppImage path goes stale.

Entries for apps that register a URL scheme (currently AxiBridge, for `axibridge://` links) now declare it. That line used to get dropped every time the file was rewritten.

## Fixes

- Auto-start on login no longer picks up the wrong app. Launching AxiOM from inside another AppImage let that app's environment leak in, which could point the login entry at whatever you launched from. AxiOM now only trusts the AppImage it's genuinely running from.

NOTE: Both of these are Linux-only and only affect AppImage installs.
