# Release Notes

Version v0.3.17 — August 14, 2026

## AxiOM sees new plugin releases right away

AxiOM could keep showing an old version for hours after a new one shipped — Unofficial Extras 2.5 was the case that surfaced this. The cause was on GitHub's side of the conversation: the endpoint AxiOM asked isn't simply "the newest release," it follows the *tag* date and a flag the publisher sets. A release tagged weeks before it's published, which is exactly how Unofficial Extras 2.5.1 shipped, could be left out entirely.

AxiOM now looks at the release list and takes the newest one that was actually published and actually ships a plugin file it can use. As a side effect, a release that doesn't include a file for your platform no longer hides the update entirely — AxiOM falls back to the most recent release that does.

## Fixes

- A hand-installed plugin no longer reports the version it replaced. AxiOM checksums the file on disk, and when that proved the file wasn't the version it had on record, it displayed the recorded version anyway — showing "installed: 2.4.1" next to "Local build (newer than latest release)". It now trusts the checksum over its own notes.
