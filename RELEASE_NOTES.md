# Release Notes

Version v0.3.14 — July 25, 2026

## arcdps update check

The arcdps core row would sometimes show a red "Couldn't check for updates" even when your DLL was actually current. deltaconnected.com now sits behind Cloudflare, which occasionally answers with a challenge or a hiccup, and the check gave up on the first try.

- It now retries briefly before reporting a failure, so a transient hiccup no longer lights up an error.
- If GW2 has the DLL locked when the check runs, you'll see an honest "couldn't read the local DLL" message instead of it blaming the network.
- When a check does fail, the real reason is written to the log so the next report is actually diagnosable.
