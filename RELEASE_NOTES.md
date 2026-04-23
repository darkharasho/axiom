# Release Notes

Version v0.1.3 — April 23, 2026

## Bug fixes

Fixed a crash in the main process when AxiOM checks for its own updates. The auto-updater was writing logs to stdout, which throws a broken pipe error when AxiOM is running as a tray app with no terminal attached.
