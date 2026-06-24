# Release Notes

Version v0.2.12 — June 23, 2026

## Fixes
- Fixed arcdps plugins showing as "Disabled" when they were actually active. When arcdps updates an extension (like Unofficial Extras), it leaves the new copy under a name like `Unofficial_Extras.dll_0` and loads it directly. Axiom mistook that for a disabled file. It now reads those as the live, up-to-date install — so a plugin that's current no longer looks turned off.
