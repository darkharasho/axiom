<p align="center">
  <img src="public/AxiOM-White.png" alt="AxiOM Logo" width="180" />
</p>

<h1 align="center">AxiOM</h1>

<p align="center">
  <strong>One launcher for every Axi app.</strong>
</p>

<p align="center">
  <a href="https://github.com/darkharasho/axiom/releases/latest"><img src="https://img.shields.io/github/v/release/darkharasho/axiom?style=flat-square&color=c89850" alt="Latest Release" /></a>
  <a href="https://github.com/darkharasho/axiom/blob/main/LICENSE"><img src="https://img.shields.io/github/license/darkharasho/axiom?style=flat-square" alt="License" /></a>
  <a href="https://github.com/darkharasho/axiom/releases"><img src="https://img.shields.io/github/downloads/darkharasho/axiom/total?style=flat-square&color=c89850" alt="Downloads" /></a>
</p>

---

## All your Axi apps, one click away.

AxiOM lives in your system tray. Click the icon, see every app in the Axi suite — installed or not — with their current version and whether an update is waiting. Launch what you need, update what's behind, install what you're missing. No browser, no release pages, no manual downloads.

Open AxiOM. Click Launch. Done.

---

## Supported Apps

<h2><img src="https://raw.githubusercontent.com/darkharasho/axibridge/main/public/img/AxiBridge-white.png" width="22" valign="middle" /> <a href="https://github.com/darkharasho/axibridge">AxiBridge</a><a href="https://github.com/darkharasho/axibridge/releases"><img src="https://img.shields.io/github/downloads/darkharasho/axibridge/total?style=flat-square&color=c89850&label=downloads" align="right" /></a></h2>

Watches your arcdps log folder and posts per-fight Discord embeds as fights happen, plus an aggregated stats view across all fights.

<h2><img src="https://raw.githubusercontent.com/darkharasho/axiforge/main/public/img/AxiForge-White.png" width="22" valign="middle" /> <a href="https://github.com/darkharasho/axiforge">AxiForge</a><a href="https://github.com/darkharasho/axiforge/releases"><img src="https://img.shields.io/github/downloads/darkharasho/axiforge/total?style=flat-square&color=c89850&label=downloads" align="right" /></a></h2>

Build and comp manager for GW2 squads. Create, edit, and publish builds and compositions to a GitHub Pages site you own and control.

<h2><img src="https://raw.githubusercontent.com/darkharasho/axipulse/main/public/img/axipulse-white.png" width="22" valign="middle" /> <a href="https://github.com/darkharasho/axipulse">AxiPulse</a><a href="https://github.com/darkharasho/axipulse/releases"><img src="https://img.shields.io/github/downloads/darkharasho/axipulse/total?style=flat-square&color=c89850&label=downloads" align="right" /></a></h2>

Parses your arcdps logs locally with Elite Insights and shows your personal combat breakdown — damage, timelines, and performance history.

<h2><img src="https://raw.githubusercontent.com/darkharasho/axiam/main/public/img/AxiAM.png" width="22" valign="middle" /> <a href="https://github.com/darkharasho/axiam">AxiAM</a><a href="https://github.com/darkharasho/axiam/releases"><img src="https://img.shields.io/github/downloads/darkharasho/axiam/total?style=flat-square&color=c89850&label=downloads" align="right" /></a></h2>

Secure account launcher. Stores encrypted GW2 credentials, manages multiple accounts, and launches them through Steam with custom arguments.

<h2><img src="https://raw.githubusercontent.com/darkharasho/axitools/main/media/AxiTools-White.png" width="22" valign="middle" /> <a href="https://github.com/darkharasho/axitools">AxiTools</a><a href="https://github.com/darkharasho/axitools"><img src="https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/darkharasho/cfef38dcbbbce38895e4a8bf3abdfa7e/raw/axitools-guild-count.json" align="right" /></a></h2>

Discord bot for GW2 communities — build sharing, RSS feeds, patch note alerts, and scheduled squad signups with per-guild isolated storage.

---

## Features

### Unified app management
AxiBridge, AxiForge, AxiPulse, and AxiTools in one place. Each app shows its installed version, the latest available release, and a single action button that does the right thing — Launch, Update, Install, or Invite.

### Automatic update detection
On startup, AxiOM checks GitHub releases for each app and compares against what's installed. A gold badge appears on the tray icon whenever updates are waiting. Click "Check for updates" anytime to refresh.

### Native install and update flows
On Windows, AxiOM downloads the NSIS installer and launches it — UAC, install path, and shortcuts handled exactly as you'd expect. On Linux, AppImages are downloaded to `~/Applications/` and handed off to Gear Lever for full desktop integration.

### Gear Lever integration (Linux)
AxiOM detects whether Gear Lever is installed. If it isn't, it offers to install it via Flatpak or open the Flathub page — right inside the popup, no terminal required.

### Tray-first, always there
Close the window, AxiOM keeps running. The tray icon is always one click from your app launcher. Set it to start on login and forget it's there until you need it.

### Consistent Axi design
Dark background, gold accents, Cinzel titles. AxiOM matches the look and feel of the apps it manages.

---

## Installation

### Linux

Download the latest `.AppImage` from [Releases](https://github.com/darkharasho/axiom/releases/latest), make it executable, and run it:

```bash
chmod +x AxiOM-*.AppImage
./AxiOM-*.AppImage
```

Or use Gear Lever to integrate it into your desktop.

### Windows

Download the latest `.exe` installer from [Releases](https://github.com/darkharasho/axiom/releases/latest) and run it.

---

## Development

```bash
git clone https://github.com/darkharasho/axiom
cd axiom
npm install
npm run dev
```

```bash
npm test          # Run unit tests
npm run typecheck # TypeScript check
npm run build     # Production build + package
```

---

## License

MIT
