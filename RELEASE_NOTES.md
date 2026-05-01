# Release Notes

Version v0.1.12 — May 1, 2026

## Lighter memory footprint

AxiOM now runs noticeably leaner in the background. The GPU helper process is gone (the tray popup doesn't need it), V8's heap is capped to a sensible size, and a few unused Chromium services are turned off. You should see the total RAM used by AxiOM drop without anything looking or feeling different.
