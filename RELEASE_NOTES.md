# Release Notes

Version v0.2.1 — May 25, 2026

## Catches more plugin layouts

A few install layouts slipped past v0.2.0's detection — fixed now:

- **Unofficial Extras** is detected when the file is named `arcdps_unofficial_extras.dll` (the prefixed variant some installers use), in addition to the previously-supported `Unofficial_Extras.dll` and `extras.dll`.
- **Nexus subfolder layout**: if Nexus put an addon in its own folder (`addons/<Addon>/<Addon>.dll`) instead of the top of `addons/`, AxiOM now walks one level deep to find it.
- **`.bak` files** count as a disabled variant. If the live `.dll` is gone and only the backup remains, the row shows the plugin as "Disabled" so you know the file is still on disk. The live `.dll` always wins over a `.bak` when both are present.
