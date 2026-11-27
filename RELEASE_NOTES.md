# Release Notes

Version v0.7.5 — November 26, 2026

## Changes

- Updates which accounts can see the apps in early testing.

Version v0.7.4 — November 26, 2026

## Fixes

- Apps that start together with Guild Wars 2 no longer show a Launch button; AxiOM sets them up after each install or update instead.

Version v0.7.3 — November 26, 2026

## Fixes

- Launch works again for apps that are not built on Electron, and AxiOM no longer shows such an app as running when only its helper processes are.

Version v0.7.2 — November 26, 2026

## Fixes

- Small fixes to how releases are built and published.

Version v0.7.1 — November 26, 2026

## Signed Windows installer

The Windows installer and app are now code-signed. Windows SmartScreen shows a known publisher instead of the "unknown publisher" warning.

Version v0.7.0 — October 12, 2026

## Update checks no longer run dry

GitHub only allows 60 update checks an hour from one network when you're not signed in, and AxiOM's checks could use that up. When that happened, new versions simply didn't show up. If you're signed in to GitHub, update checks now use your sign-in, which raises the limit to 5,000 an hour.

Your sign-in is only sent to GitHub, and only when listing an app's or plugin's releases. It's never sent with downloads or to any other site. If GitHub rejects it, AxiOM checks without it.

## Fixes

- When GitHub refuses an update check because the limit was reached, the app now says "GitHub limit reached until <time>" instead of quietly showing no update. Any update it had already found stays available.

Version v0.6.1 — October 8, 2026

## AxiGear

The arcdps page now lists **AxiGear**, which checks in-game that your build, gear and consumables match your slot in an AxiForge comp or build. Install and update it from AxiOM like AxiPulse.

Version v0.6.0 — October 6, 2026

## Private apps

AxiOM can now list and install apps that live in private GitHub repos. They only show up for the accounts allowed to see them, and only after that account unlocks them in **Settings** by approving extra GitHub access. Nothing changes for anyone else: the normal sign-in still asks only to read your public profile.

The extra access is only ever sent to those private repos' release downloads, never to anything else.

Version v0.5.1 — October 6, 2026

## Fixes

- If access is revoked and AxiOM can't save that to disk, it now restarts straight into the block screen, so nothing keeps running behind it. Before, the block screen covered an app that was still running.

Version v0.5.0 — October 5, 2026

## Access check

AxiOM now checks a public access list when it starts and every few hours. Access to the Axi apps can be revoked for accounts, guilds or Discord servers that violate the terms of use, and a revoked install shows a block screen instead of the app.

The list is downloaded from `config.axi.link` and holds only one-way hashes. AxiOM checks your GitHub user ID against it on your device, if you signed in, and never sends it anywhere.

If the list can't be reached, AxiOM keeps working as before. The README has a new **Access** section that spells out exactly what is checked and how to appeal.

Version v0.4.1 — October 2, 2026

## Fixes

- The update dot on the **arcdps** button was nearly invisible on the Flat and Glass surfaces — it was painted the same colour as the band sitting behind it. It's now drawn in dark ink, so it reads on all three looks.
- AxiStream's icon in the app list was shipping its full app-icon tile, so it drew a dark square inside the row's own border and looked smaller than everything around it. It's a plain glyph now, matching the rest. Same fix applies to the 64px icon on its detail page.
