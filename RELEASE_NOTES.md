# Release Notes

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
