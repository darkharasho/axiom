# Release Notes

Version v0.2.4 — June 4, 2026

## Plugin update checks actually work now

Several arcdps plugins were always showing up as "unknown" version with no
update available, even when a newer build was out. The culprit: AxiOM was
looking for a download whose filename didn't match what those projects
actually publish, so it quietly gave up.

Fixed for Unofficial Extras, Squad Roles, Player List, Killproof.me, and Boon
Table — they now report their installed version and flag updates correctly.
Also made GW2 Buddy pick the right file so it can't accidentally grab the
Nexus build.
