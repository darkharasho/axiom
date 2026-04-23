# Release Notes

Version v0.1.9 — April 23, 2026

## Auto-Start Actually Works on Linux

The "Start AxiOM at login" toggle never did anything on Linux — the underlying Electron API only supports macOS and Windows. AxiOM now writes a proper `~/.config/autostart/axiom.desktop` entry pointing at the current AppImage, and removes it when you turn the toggle off.

The entry also self-repairs: every time AxiOM launches, it rewrites the file to point at the current AppImage path, so updating AxiOM won't leave autostart pointing at an old binary.

NOTE: If you had the toggle enabled before this release, flip it off and back on once to write the new entry.
