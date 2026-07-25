# Release Notes

Version v0.3.15 — July 25, 2026

## arcdps update check, take two

Some setups still saw arcdps stuck on "Couldn't check for updates" even though everything else updated fine. The cause was the check refusing the secure connection to deltaconnected.com on networks that can't reach the certificate's revocation server — a Pi-hole or similar DNS filter in the path is a common trigger.

- The check now connects the same way the browser does, so it succeeds where it used to give up.
- When it genuinely can't connect, the log now records the real underlying reason instead of a generic "fetch failed", so any lingering case is actually traceable.
