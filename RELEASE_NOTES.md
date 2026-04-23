# Release Notes

Version v0.1.2 — April 23, 2026

## Bug fixes

Fixed apps always showing as "running" on Linux even after they were closed. The process check was using `pgrep -f` (full command line match), which matched AxiOM's own shell process since it contained the app name in the command it was running.

Fixed AxiAM constantly showing a pending update on Linux. AxiAM's AppImage filename didn't include a version number, so AxiOM couldn't detect the installed version from the file and kept falling back to stale data.
