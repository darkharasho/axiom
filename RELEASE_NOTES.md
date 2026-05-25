# Release Notes

Version v0.2.0 — May 25, 2026

## New: arcdps & Plugins view

There's a new "arcdps" button in the header that opens a dedicated view for managing arcdps and a curated set of arcdps plugins. arcdps and AxiPulse (the arcdps plugin) are always shown; the other plugins only appear when AxiOM finds them on disk, so the list reflects what you actually run.

For each row you get a one-line description of what the plugin does, the version you have installed, the latest version available, and a single button to install or update with one click. Downloads land atomically — your existing DLL is backed up to `.bak` first, so a botched download won't wipe out a working install.

## Update before you launch, not after

The big win: you don't need to be in-game to do this. The in-game updaters (arcdps's own, Nexus's) only run after you've already loaded GW2 — apply an update and you're restarting the client. AxiOM checks and updates from the desktop, so you patch arcdps and every plugin once, then launch into a session that's already current.

## Knows where your plugins actually live

Detection scans every common location: the GW2 root, `bin64/`, and `addons/` (where GW2 Nexus puts everything). arcdps itself is handled in both setups — root `d3d11.dll` for standalone, `addons/ArcDPS.dll` when chainloaded by Nexus. Unofficial Extras gets the same treatment (`addons/Unofficial_Extras.dll` or `bin64/arcdps/extensions/extras.dll`).

If you have GW2 Nexus installed, AxiOM also knows not to mistake Nexus's own `d3d11.dll` loader for arcdps.

## Update checks that don't lie

For arcdps core, AxiOM fetches deltaconnected's published MD5 and compares it to your local DLL. Both hashes are shown in the row so you can verify against the official page yourself.

For GitHub-sourced plugins, it compares your local file size to the latest release asset. That means updates you applied outside AxiOM (manual download, another tool) get picked up on the next check — no more stale "installed: v1.2" when the file on disk has clearly moved on.

## Disabled plugins still show up

If Nexus has switched a plugin off (the `.dll_0` rename trick), or if you've renamed a DLL to `.disabled` / `.old`, AxiOM still finds it and labels the row "Disabled" so you can see it's there without re-enabling.

## Header shows a dot when something's behind

A small gold dot appears on the arcdps button in the header whenever any plugin reports an update available — same idea as the tray badge, so you don't have to open the view to know there's something to do.

## QoL Improvements
- Thin gold-tinted scrollbars app-wide — applies to settings, info pages, and the new arcdps view.
- Native folder picker for choosing your GW2 install when auto-detection misses (or you want to point at a different copy).
- Auto-detect reads AxiAM's saved GW2 path first, then common Steam / Program Files / Lutris locations, and surfaces a clear error if the path you pick doesn't contain a `Gw2-64.exe`.
