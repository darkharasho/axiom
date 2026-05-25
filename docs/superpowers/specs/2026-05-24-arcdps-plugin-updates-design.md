# arcdps + Plugin Update Manager

**Status:** Design approved 2026-05-24
**Owner:** @darkharasho

## Summary

Extend AxiOM to detect, surface, and one-click install updates for arcdps and a curated set of arcdps plugins. arcdps and `arcdps_axipulse` are always shown; other curated plugins appear only when their DLL is detected in the GW2 install. Lives in a new top-level view alongside the existing app list and settings.

## Goals

- Single place to see whether arcdps and any installed plugins are current.
- One-click update that downloads the DLL, backs up the prior version, and drops the new one into the correct folder.
- Reuse existing AxiOM infrastructure (GitHub release lookups, tray badge, installer helpers, process checks) rather than building parallel systems.

## Non-goals

- Discovery/install of plugins the user has never installed (only arcdps + `arcdps_axipulse` get "Install" buttons; the rest are detect-only).
- A user-editable plugin registry (curated only, code-defined).
- Managing arcdps loader variants (we target the standard `d3d11.dll` loader).
- Anything outside the Guild Wars 2 install directory.

## UI

A new top-level view `'arcdps'` added to the existing `view` state in `src/App.tsx` (which today routes between `'list' | 'settings' | 'info'`).

- Entry point: a new button in the `AppList` header, sitting next to Settings.
- View contents:
  - Header with back button, "Check for updates" action, and the resolved GW2 path with a "Change…" link that opens a folder picker.
  - **Always-shown rows:** arcdps (core), `arcdps_axipulse`.
  - **Conditional rows:** every other curated plugin, shown only if its DLL is detected.
  - Each row shows: name, install state, version/update state ("Up to date" / "Update available" / "Not installed"), and a single action button (Install / Update / Up to date / disabled when GW2 is running).
- The existing gold tray badge (currently triggered by app updates) is OR'd with arcdps plugin updates so one indicator covers both.

## Data model

New module `electron/arcdps.ts` defines:

```ts
type ArcSource =
  | { kind: 'deltaconnected' }                   // arcdps core only
  | { kind: 'github'; repo: string }

interface ArcPluginMeta {
  id: string                  // 'arcdps' | 'arcdps_axipulse' | 'boon_table' | ...
  name: string
  source: ArcSource
  dllPattern: RegExp          // matches filenames in installDir
  installDir: 'bin64' | 'bin64/arcdps/extensions'
  assetPattern?: RegExp       // for github sources, picks the .dll asset from release
  alwaysShow: boolean         // true for arcdps and arcdps_axipulse only
}
```

### Initial registry

Always shown:
- `arcdps` — `deltaconnected`, `bin64/d3d11.dll`
- `arcdps_axipulse` — `github: darkharasho/arcdps_axipulse` (verify exact repo name during plan stage)

Detect-only (show only if DLL present):
- `darkharasho/SquadRoles` *(originally listed as xvwyh/SquadRoles — confirm correct upstream)*
- `cheahjs/arcdps-squad-ready-plugin`
- `Calcoph/gw2-player-list`
- `knoxfighter/GW2-ArcDPS-Mechanics-Log`
- `knoxfighter/arcdps-killproof.me-plugin`
- `Zerthox/arcdps-food-reminder`
- `gw2scratch/arcdps-clears`
- `cheahjs/arcdps-chat-log`
- `Zerthox/gw2-buddy`
- `knoxfighter/GW2-ArcDPS-Boon-Table`
- `blish-hud/arcdps-bhud`
- `Krappa322/arcdps_unofficial_extras_releases` (installs to `bin64/arcdps/extensions/`)

Exact `dllPattern` and `assetPattern` regexes per repo are determined during the plan stage by inspecting each repo's latest release asset names.

## Detection and version logic

`electron/arcdps.ts` exposes:

- `getGw2Path()` — resolution order:
  1. AxiAM's persisted GW2 path (read from AxiAM's config; format to be verified during plan stage).
  2. Common defaults: Windows registry (`HKLM\Software\WOW6432Node\ArenaNet\Guild Wars 2`), Steam library scan, standard install paths.
  3. AxiOM's own saved override (set via "Change…" link).
- `detectInstalled(gw2Path)` — scans `bin64/` and `bin64/arcdps/extensions/`, matches each filename against every registry entry's `dllPattern`, returns `{ id, dllPath, mtime, sizeBytes, md5? }[]`. MD5 is computed only for arcdps core (needed for the deltaconnected comparison).
- `checkUpdates(installed)`:
  - **arcdps core:** fetch `https://www.deltaconnected.com/arcdps/x64/d3d11.dll.md5sum`, compare against local MD5.
  - **GitHub plugins:** reuse `electron/github.ts` to fetch latest release, pick the asset matching `assetPattern`, compare against AxiOM's recorded "last installed tag" for that plugin. If no recorded tag (plugin installed outside AxiOM), state is shown as "Unknown — latest is <tag>" with the option to update to latest.
- Cache latest results for 1 hour using the same pattern as existing app checks.

## Install / update flow

`installPlugin(id)` per row:

1. Refuse and prompt to close if `Gw2-64.exe` is running (reuse `electron/process-check.ts`).
2. Resolve target path: `<gw2>/<installDir>/<filename>`.
3. Download asset to a sibling temp file (e.g., `d3d11.dll.new`).
4. If a target file exists, rename it to `<filename>.bak` (single rolling backup; any prior `.bak` is overwritten).
5. Atomic rename of temp → target.
6. Record `{ pluginId, installedTag, installedAt }` in AxiOM config so future "Update available" checks are precise.
7. On any failure after step 4, restore from `.bak` and surface the error in the UI.

## IPC and types

Add to `electron/ipc-handlers.ts` and `electron/preload.ts`:

- `arcdps:getState` → `{ gw2Path: string | null, plugins: PluginState[] }`
- `arcdps:checkUpdates` → triggers a fresh check, returns updated state
- `arcdps:install(id)` → install or update one plugin
- `arcdps:setGw2Path(path)` → persist a manual override

Mirror these in `src/axiom.d.ts`. New React hook `src/hooks/useArcdpsState.ts` parallels the existing `useAppStates`.

## Tests

Unit tests in `electron/__tests__/arcdps.test.ts`:

- DLL pattern matching against representative real-world filenames.
- md5sum comparison logic (mocked fetch).
- GitHub asset selection from a release payload.
- AxiAM config parse: missing file, malformed JSON, valid file.
- Install rollback when the download step fails partway through.

## Open risks

1. **AxiAM config format.** The reuse-AxiAM-path is contingent on AxiAM actually persisting the GW2 install path in a parseable file. To verify during plan stage by reading AxiAM's source. If it doesn't, the resolution order collapses to auto-detect + manual override.
2. **Per-plugin asset patterns.** Each curated repo names its release asset differently. Patterns are derived during plan stage by inspecting each repo's latest release; the design assumes a single `.dll` asset per plugin (no installer/zip handling).
3. **`arcdps_axipulse` repo coordinates.** Spec assumes `darkharasho/arcdps_axipulse`; confirm during plan stage.
4. **SquadRoles upstream.** User listed `xvwyh/SquadRoles`; confirm whether this is the canonical upstream or a fork to track.
5. **First-detection state.** For plugins installed before AxiOM existed, we have no recorded tag, so the first run shows "Unknown — latest is X" rather than a clean "Up to date." Accepted trade-off.
