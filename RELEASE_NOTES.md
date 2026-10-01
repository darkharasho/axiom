# Release Notes

Version v0.4.0 — October 1, 2026

## Pick how AxiOM looks

Settings has two new rows. **Accent** picks the colour AxiOM's chrome is painted in — buttons, highlights, the active row, focus rings. **Surface** picks between three looks: **Axi**, the flat outlined one with square corners and hard offset blocks, which stays the default so nothing changes unless you go looking; **Flat**, the same shapes with rounded corners and real shadows; and **Glass**, translucent panels with depth and blur behind them.

Both stick between launches and repaint the popover immediately.

## Fixes

- On Flat and Glass the popover's rounded corners are now actually round; the window painted square corners over them.
- The plates in the brand band are painted in the deep-chrome token, so they stay distinct from the band on all three surfaces instead of disappearing into it.
- Raised and recessed areas ask the surface for its own relief and recess colours rather than using the ones that happened to look right on Axi.

Version v0.3.25 — September 29, 2026

## Pre-release versions, if you want them

Two new switches in Settings: **Pre-release app versions** and **Pre-release plugin versions**. Leave them off and nothing changes — you keep getting stable builds only. Turn one on and AxiOM will also offer release candidates.

This matters for plugins like Unofficial Extras, which ships its first build after a game patch as an "rc". AxiOM used to skip those entirely, so if you had installed one by hand the row just said "local build" and never offered you an update. Flip the plugin switch on and it shows the rc as the version it is.

Each switch re-checks immediately, and they are independent — you can take rc plugin builds without taking rc app builds. Turning a switch back off never offers you a downgrade. AxiOM's own updates are always stable builds.
