# Release Notes

Version v0.3.0 — June 29, 2026

## New app: AxiRoster
- **AxiRoster** now appears in the launcher. It's a WvW guild roster manager for Guild Wars 2 leadership — pull your roster from the GW2 API and Discord, track who's active, and share a live audit log and retention history across your officer team. Install, launch, and keep it updated from AxiOM like every other Axi app.

Version v0.2.12 — June 23, 2026

## Fixes
- Fixed arcdps plugins showing as "Disabled" when they were actually active. When arcdps updates an extension (like Unofficial Extras), it leaves the new copy under a name like `Unofficial_Extras.dll_0` and loads it directly. Axiom mistook that for a disabled file. It now reads those as the live, up-to-date install — so a plugin that's current no longer looks turned off.
