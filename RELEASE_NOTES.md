# Release Notes

Version v0.3.7 — July 6, 2026

## Simpler arcdps plugin toggle

The Enable/Disable button is gone. The little power icon on each plugin row is the toggle now — green means it's on, gray means it's off. Click it to flip. A disabled plugin also hides its install/update button, so it won't confusingly show "Reinstall release" while it's switched off.

## Fixes

Fixed a case where re-enabling a plugin could leave a stray disabled copy behind on disk, which then jammed the next disable with an "already exists" error. Toggling now cleans up after itself and always settles to a single file, so it can't get stuck.
