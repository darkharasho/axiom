# Release Notes

Version v0.2.2 — May 26, 2026

## arcdps plugin updates aren't fooled by same-size DLLs anymore

If you had AxiPulse v0.1.8 installed, AxiOM was telling you it was up to date
even after v0.2.0 shipped. Both releases happened to be exactly the same
number of bytes on disk, and the update check was using file size to decide
whether you were current.

AxiOM now compares the SHA256 hash of the local plugin against the digest
published on GitHub, which is what actually tells you whether the file
changed. Same fix applies to every arcdps plugin AxiOM manages — not just
AxiPulse.

NOTE: hit "Check for updates" after upgrading; plugins that were falsely
marked up to date will now show an Update button.
