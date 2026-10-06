# Release Notes

Version v0.5.0 — October 5, 2026

## Access check

AxiOM now checks a public access list when it starts and every few hours. Access to the Axi apps can be revoked for accounts, guilds or Discord servers that violate the terms of use, and a revoked install shows a block screen instead of the app.

The list is downloaded from `config.axi.link` and holds only one-way hashes. AxiOM checks your GitHub user ID against it on your device, if you signed in, and never sends it anywhere.

If the list can't be reached, AxiOM keeps working as before. The README has a new **Access** section that spells out exactly what is checked and how to appeal.

Version v0.4.1 — October 2, 2026

## Fixes

- The update dot on the **arcdps** button was nearly invisible on the Flat and Glass surfaces — it was painted the same colour as the band sitting behind it. It's now drawn in dark ink, so it reads on all three looks.
- AxiStream's icon in the app list was shipping its full app-icon tile, so it drew a dark square inside the row's own border and looked smaller than everything around it. It's a plain glyph now, matching the rest. Same fix applies to the 64px icon on its detail page.
