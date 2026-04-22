# AxiOM Toolbox — Design Spec

**Date:** 2026-04-22
**Status:** Approved

---

## Overview

AxiOM is an Electron tray application for Linux and Windows that acts as a central launcher and update manager for the Axi suite of apps. Users can install, update, delete, and launch each Axi app from a single popup without opening a browser or navigating GitHub releases manually. Inspired by JetBrains Toolbox.

---

## Apps Managed

| App | GitHub repo | Platform delivery | Notes |
|-----|-------------|-------------------|-------|
| AxiBridge | `darkharasho/axibridge` | Linux: AppImage, Windows: NSIS installer | |
| AxiForge | `darkharasho/axiforge` | Linux: AppImage, Windows: NSIS installer | |
| AxiPulse | `darkharasho/axipulse` | Linux: AppImage, Windows: NSIS installer | |
| AxiTools | n/a | Discord bot — invite link only | Invite URL configurable in Settings. No install/version tracking |

---

## Tech Stack

- **Electron + React + Vite** — same stack as AxiBridge, AxiForge, AxiPulse
- **TypeScript** throughout
- **Build targets:** `build:linux` (AppImage), `build:win` (NSIS installer)
- **Release process:** same GitHub Actions workflow as the other Axi apps
- **Repo:** `darkharasho/axiom` (new)

---

## Architecture

Three layers:

### Main process (`electron/main.ts`)
- Creates and manages the `Tray` instance (icon: `AxiOM-White.svg` / platform `.ico`)
- Creates a frameless `BrowserWindow` (320px wide, height auto, `alwaysOnTop: true`, `skipTaskbar: true`) that shows/hides on tray click and hides on blur
- Positions window near the tray icon on show
- Handles all IPC calls from the renderer: checking updates, downloading, launching, opening URLs, reading/writing config, toggling auto-start
- Runs GitHub release checks on startup and on-demand
- Executes downloads and installers
- Adds a badge dot to the tray icon when any update is available

### Preload (`electron/preload.ts`)
- Exposes a typed `window.axiom` IPC bridge using `contextBridge`
- API surface: `checkUpdates()`, `download(appId)`, `launch(appId)`, `uninstall(appId)`, `openUrl(url)`, `getConfig()`, `setConfig(patch)`, `setAutoStart(enabled)`, `installGearLever()`, `openGearLeverFlathub()`

### Renderer (`src/`)
- React + Vite
- Two views within the same window: **App List** (default) and **Settings** (slides in)
- Styled with the AxiForge/SAI dark/gold theme and Cinzel font

---

## Data Model

Persisted to `app.getPath('userData')/config.json`:

```json
{
  "autoStart": false,
  "apps": {
    "axibridge": { "installedVersion": "2.5.11", "lastChecked": "2026-04-22T10:00:00Z" },
    "axiforge":  { "installedVersion": null,     "lastChecked": "2026-04-22T10:00:00Z" },
    "axipulse":  { "installedVersion": "0.1.12", "lastChecked": "2026-04-22T10:00:00Z" }
  }
}
```

`installedVersion: null` means not detected/installed. AxiTools is not represented — it has no state.

---

## Version Detection

Run on each app launch and on "Check for updates". Detected version written to `config.json`.

### Windows
1. Query `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall` and `HKCU\...\Uninstall` for a key whose `DisplayName` matches the app (e.g. "AxiBridge"). Read `DisplayVersion`.
2. Fallback: scan known default install paths for the app executable.

### Linux
1. Check Gear Lever's metadata directory (`~/.local/share/gearlever/`) for a managed entry matching the app name. Read the stored version.
2. Fallback: scan `~/Applications/` and `~/.local/bin/` for AppImage files matching the app name and extract version from filename.

---

## GitHub Release Checking

On startup and on "Check for updates" click, fetch concurrently:

```
GET https://api.github.com/repos/darkharasho/<repo>/releases/latest
```

Compare `tag_name` (strip leading `v`) against stored `installedVersion`. Store `lastChecked` timestamp. Send results to renderer via IPC.

---

## Delete / Uninstall Flow

### Windows
Run the uninstaller string from the registry (`UninstallString` key) for the app. Poll registry after it exits; if the key is gone, set `installedVersion: null` in `config.json`.

### Linux
Call `flatpak run it.mijorus.gearlever --remove <appId>` if Gear Lever manages the app, otherwise delete the AppImage file from `~/Applications/`. Update `config.json`.

The app row shows a **Delete** option accessible via a context menu or small icon on hover (to avoid accidental clicks next to Launch).

---

## Install & Update Flow

### Windows
1. Identify the NSIS `.exe` asset from the release by filename pattern
2. Download to a temp directory; stream progress to renderer via IPC
3. Launch installer: `shell.openPath(tempExePath)` — Windows UAC handles elevation
4. Poll registry after installer exits to confirm new version; update `config.json`

### Linux
1. **Gear Lever check:** run `flatpak list | grep gearlever`
   - If missing: show inline prompt in the app row with two buttons:
     - **"Install Gear Lever"** — runs `flatpak install flathub it.mijorus.gearlever` with streamed progress shown in the popup
     - **"Open Flathub"** — opens `https://flathub.org/apps/it.mijorus.gearlever` in system browser
   - Abort install flow until Gear Lever is confirmed present
2. Identify the `.AppImage` asset from the release
3. Download to `~/Applications/` (create directory if needed); stream progress to renderer
4. `chmod +x` the AppImage
5. Hand off to Gear Lever: `flatpak run it.mijorus.gearlever <path>` — Gear Lever handles desktop integration
6. Update `config.json`

### Download progress
Main process streams `{ appId, percent, bytesReceived, totalBytes }` events to renderer during download. The app row's action button is replaced with an inline progress bar for the duration.

---

## Launch Flow

- **Windows:** look up install path from registry (`InstallLocation` + exe name); call `shell.openPath()`
- **Linux:** ask Gear Lever for the managed executable path, or use the AppImage path directly; call `shell.openPath()`
- **AxiTools:** call `shell.openExternal(discordInviteUrl)`

---

## UI Components

### App List view (default)

```
┌─────────────────────────────────────┐
│  [AxiOM logo]  Axi OM          ⚙   │  ← Cinzel font, white/gold
├─────────────────────────────────────┤
│  [icon]  AxiBridge              │ Launch   │  ← gold filled button
│          v2.5.11 · up to date   │          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  [icon]  AxiForge               │ Update ↑ │  ← amber border, bright gold btn
│          v0.7.0 available       │          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  [icon]  AxiPulse               │ Install  │  ← ghost button, icon dimmed
│          not installed          │          │
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│  [icon]  AxiTools               │ Invite ↗ │  ← outline gold, opens browser
│          Discord Bot            │          │
├─────────────────────────────────────┤
│  Check for updates          Quit   │
└─────────────────────────────────────┘
```

**Button states:**
- `Launch` — installed, current — gold filled (`#c89850`)
- `Update` — update available — bright gold (`#e8b050`), amber row border
- `Install` — not detected — ghost/outline
- `Downloading…` + progress bar — replaces button during download
- `Install Gear Lever` + `Open Flathub` — shown when Gear Lever missing (Linux only)
- `Invite ↗` — AxiTools only — outline gold

### Settings view (slides in, back arrow to return)
- Auto-start on login toggle → calls `app.setLoginItemSettings()`
- AxiTools Discord invite URL (editable text field)
- AxiOM version display (read-only)

### Tray icon
- Normal: `AxiOM-White.svg` (converted to `.ico` for Windows, `.png` for Linux)
- Updates available: badge dot overlay

---

## Theme

Matches AxiForge/SAI:

| Token | Value |
|-------|-------|
| Background | `#08090c` |
| Panel/row | `#0c0d10` |
| Border | `#1e1f24` |
| Text | `#e2e3e8` |
| Text dim | `#646670` |
| Gold | `#c89850` |
| Gold bright | `#e8b050` |
| Titlebar font | Cinzel (Google Fonts) |
| Title | "**Axi**" (white) + "**OM**" (gold) |

App icons sourced from each project's SVG: `AxiBridge-white.svg`, `build_logo.svg`, `axipulse-white.svg`, `AxiTools-White.svg`. AxiOM header uses `AxiOM-White.svg` from `public/`.

---

## README

Follows the SAI/TAI marketing template:
- Centered AxiOM logo (`public/AxiOM-White.png`)
- `<h1>` title + bold tagline
- Badge row (latest release, license, downloads) — accent color `#c89850`
- Screenshot of the tray popup
- Punchy pitch paragraph
- Features section (per-app management, auto-update, Gear Lever integration, tray-first UX)
- Quick start / install instructions for Linux and Windows

---

## Out of Scope

- macOS support (Linux + Windows only)
- Per-app settings or configuration passthrough
- AxiOM distributing itself via Flathub (standard AppImage/NSIS release only)
