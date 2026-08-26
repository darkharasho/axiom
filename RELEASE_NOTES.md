# Release Notes

Version v0.3.20 — August 26, 2026

## AxiStream is in the list for everyone

AxiStream hit 1.0, so it's out from behind the sign-in gate. It now shows up in your app list whether or not you're signed in to GitHub, and installs and updates like everything else here.

If you haven't seen it: AxiStream gets a Guild Wars 2 player live on YouTube in about three clicks. It drives its own bundled OBS, so there's no scene to build and no stream key to copy.

Version v0.3.19 — August 23, 2026

## One click on Update really is enough now

v0.3.18 fixed half of this. It stopped a background update check from clobbering an install that was still running — but arcdps plugins are small DLLs that finish in well under a second, so the install was usually already done by the time the check caught up, and the check happily wrote its stale pre-install snapshot back on top. The row flipped straight back to **Update available** and you clicked Update again.

Update checks are now ordered against your clicks: anything you did after a check started takes priority, whether or not it has finished. The same gap existed for the Axi app rows and is closed too.

## Fixes

- arcdps plugins no longer revert to **Update available** after a successful one-click update.
- App update checks can no longer overwrite a version you just installed, including in the on-disk version record.
- Opening the arcdps view no longer races with the Update button you press right after.
