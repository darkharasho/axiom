# Release Notes

Version v0.3.25 — September 29, 2026

## Pre-release versions, if you want them

Two new switches in Settings: **Pre-release app versions** and **Pre-release plugin versions**. Leave them off and nothing changes — you keep getting stable builds only. Turn one on and AxiOM will also offer release candidates.

This matters for plugins like Unofficial Extras, which ships its first build after a game patch as an "rc". AxiOM used to skip those entirely, so if you had installed one by hand the row just said "local build" and never offered you an update. Flip the plugin switch on and it shows the rc as the version it is.

Each switch re-checks immediately, and they are independent — you can take rc plugin builds without taking rc app builds. Turning a switch back off never offers you a downgrade. AxiOM's own updates are always stable builds.
