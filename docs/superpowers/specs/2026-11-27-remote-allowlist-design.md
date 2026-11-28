# Remote allowlist for gated apps — design (short)

## Why
Adding a tester to a gated app (e.g. the AxiDPS beta) means editing `APP_META.allowlist` in
`electron/apps.ts` and cutting an AxiOM release. The owner wants to add and remove testers from
AxiAdmin instead, with no release.

## Goals
- Owner adds/removes a tester for a gated app in AxiAdmin by typing a GitHub login.
- AxiOM shows the app to that user within the config refresh window, without a release, and hides
  it again when removed.

## Non-goals / anti-goals
- Never publish tester logins or which accounts test what: the axi-config manifest is public, so
  the flag holds only hashes. A plaintext list would be a failure even if it worked.
- Never reveal a gated app's existence to a user who can't see it (unchanged rule in AxiOM).
- No change to how private-repo apps (`private: true`) get the `repo` scope: the remote list does
  not apply to them (they also need GitHub collaborator access, which a flag can't grant).

## Approaches
1. **Hashed ids in an axi-config flag (chosen).** Flag `axiom` / `allowlist.<appId>` = array of
   `hashIdentity('github_user', <numeric id>)` hex strings, the same hashing the denylist uses.
   Public manifest leaks nothing readable.
2. Plaintext logins in a flag — rejected: publishes testers and gated apps.
3. A new admin-only endpoint AxiOM queries with the user's token — rejected: new Worker auth path
   and per-user requests for something the cached manifest already delivers.

## Design
- **AxiOM**
  - Visibility of a gated, non-private app = login in the code `allowlist` (kept as the offline
    floor) OR the signed-in user's hashed id in `config.flag('allowlist.<appId>', [])`.
  - The hash is computed once per sign-in (async `hashIdentity`), cached in the main process;
    `isAppVisible` stays synchronous and takes the hash and the flag lists.
  - On `config.onChange` and on sign-in/out, AxiOM re-sends the visible app states (existing
    `axiom:states-updated` path), so apps appear/disappear without restart.
  - Malformed flag values (not an array of 64-char lowercase hex) are ignored.
- **AxiAdmin**
  - A "Testers" section in the Flags panel: pick an app, type a login → resolve the numeric id via
    the GitHub API (existing GET-only client), hash it, append to the flag via the existing
    `PUT /v1/admin/flags/axiom/allowlist.<appId>`; remove does the inverse.
  - A local map hash → login (AxiAdmin's userData) so the list shows names; unknown hashes show
    as a short hash. This map never leaves the machine. *(Builder's call: local only.)*

## Left to the builder
- Exact UI layout of the Testers section; IPC channel names; where the map file lives.
- The release: AxiOM needs one release to start reading the flag; after that, none per tester.
