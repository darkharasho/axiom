# Release Notes

Version v0.1.0 — April 22, 2026

## First release

AxiOM is a system tray launcher for the Axi ecosystem. One click shows every app — AxiBridge, AxiForge, AxiPulse, AxiAM, and AxiTools — with their installed version and a single action button that does the right thing: Launch, Update, Install, or Invite.

## App management

Install, update, and launch Axi apps without touching a browser or release page. Downloads happen in the background with a progress bar. On Linux, new installs hand off to Gear Lever for desktop integration; on Windows, the NSIS installer is launched directly.

## Running process detection

Apps that are already running show a **Focus** button instead of Launch, with a green "running" status line. Process state is polled every 8 seconds using `pgrep` on Linux and `tasklist` on Windows.

## Context menu

Installed apps have a three-dot menu with quick access to Info, Browse local files, and Uninstall — without leaving the launcher.

## Settings

Toggle auto-start on login and update notifications. Manually check for AxiOM updates from the settings page. GitHub and Discord links are in the footer.

## Adaptive tray icon

On Windows, AxiOM reads the `SystemUsesLightTheme` registry key and switches between a white and black tray icon to match the taskbar. The icon updates live when you switch themes.
