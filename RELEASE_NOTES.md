# Release Notes

Version v0.3.6 — July 6, 2026

## Turn arcdps plugins on and off without deleting them

Every plugin row in the arcdps view now has an Enable/Disable toggle. Disabling renames the DLL on disk so the game skips it — the file stays put, and one click brings it back. Handy for narrowing down which plugin is misbehaving after a patch, or benching something you only use on raid nights.

NOTE: AxiOM won't toggle anything while GW2 is running, since the game holds those files open.

## Fixes

- If you build a plugin from source yourself, AxiOM no longer flags your own build as needing an "update" — clicking that would actually have replaced it with the older official release. It now shows "Local build" instead, with a reinstall button if you genuinely want to go back to the release version.
