# AxiOM UI/UX Audit — Design Spec

**Date:** 2026-04-22  
**Scope:** Pre-release comprehensive audit — visual polish + interaction design  
**Approach:** Experience-led discovery, tier-organized fixes  

---

## Context

AxiOM is a 320×420px Electron tray launcher for the Axi app suite. It has a cohesive dark theme with gold accents, a CSS variable design system, and inline React styles throughout. The audit covers 3 user flows: first-time use (no apps installed), update available, and installing/launching. Eight findings were identified across three tiers.

---

## Tier 1 — Critical (pre-release must-fix)

### Finding 1: Error state has no visual treatment

**File:** `src/components/AppRow.tsx`

When `status === 'error'`, the only feedback is the text "Error" in red in the status line. The action slot is empty — no retry button, no error icon on the row, no way to recover.

**Design:**
- The action slot renders a small retry button (↺, `RefreshCw` icon from lucide-react) when `status === 'error'`
- The row border uses a red tint: `1px solid rgba(224, 82, 82, 0.35)` (matches `#e05252` at ~35% opacity, same pattern as `--gold-border`)
- Clicking retry re-dispatches the last action. Since AppRow doesn't know the last action, the retry button calls a new `onRetry(appId)` prop. AppList implements this as: if `state.installedVersion` is set → `window.axiom.launch(appId)`; otherwise → `window.axiom.install(appId)`. This covers all realistic error paths (install failure = not installed; launch failure = installed but won't open).
- No tooltip needed — the error source is always a network or install failure, which is self-evident in context

**New prop on AppRow:** `onRetry: (appId: AppId) => void`

---

### Finding 2: "?" info button is nearly invisible

**File:** `src/components/AppRow.tsx`

The `HelpCircle` button uses `color: 'var(--text-faint)'` (#3a3b40) on a #0c0d10 panel background. Contrast ratio is under 2:1 — below any usable threshold. This is the only entry point to the AppInfoView.

**Design:**
- Change color from `var(--text-faint)` to `var(--text-dim)` (#646670) — raises contrast to ~4:1, visible without being prominent
- Increase icon size from 14px to 15px
- Add `cursor: pointer` explicitly (inherited from globals but worth being explicit here given how small the button is)
- No hover state needed beyond what globals.css provides — the color lift is sufficient discovery improvement

Applies to both the not-installed row and the AxiTools row (both use the same inline button style).

---

### Finding 5: AppInfoView has no Install CTA

**File:** `src/components/AppInfoView.tsx`

The info screen is the decision page — users navigate here to learn about an app before installing. But there is no Install button; users must navigate back to the list and find it. This breaks the decision flow.

**Design:**
- Add optional props to AppInfoView: `downloadUrl?: string` and `onInstall?: () => void`
- When `downloadUrl` is truthy and `onInstall` is provided, render an Install button in a footer bar at the bottom of the view (above the 14px padding boundary)
- The button uses the upgraded Install style from Finding 7 (slightly filled background, brighter border, `--text-light` text) — consistent with the updated list view style
- Footer layout: full-width Install button, same row height as the settings version row (~36px)
- AppList passes `downloadUrl` and an `onInstall` handler when calling `onOpenInfo`, or AppInfoView receives the full `AppState` — the simpler approach is passing `downloadUrl` and `onInstall` as props so AppInfoView stays presentational

**AppList change:** `onOpenInfo` already has the app state available. When rendering AppInfoView, pass `state.downloadUrl` and `() => handleAction('install', appId)` as props.

---

## Tier 2 — Polish

### Finding 3: Footer buttons are too small

**File:** `src/components/AppList.tsx`

"Check for updates" and "Quit" are 10px font with `padding: 0`. These are among the most-used controls in the app and deserve a taller click target.

**Design:**
- Increase font size from 10px to 11px for both footer buttons
- Add `padding: 4px 0` to each button (taller hit area, no visual layout change)
- No other changes — the muted color and minimal style should stay

---

### Finding 4: No hover or focus states

**Files:** `src/styles/globals.css`, all components

All interactive elements (`Settings` gear, `ChevronLeft` back buttons, action buttons in AppRow, footer buttons) have no visual feedback on hover. `outline: none` removes focus rings entirely.

**Design:**
- Add to `globals.css` — a general icon button hover rule:
  ```css
  button:hover { opacity: 0.8; }
  ```
  This is a single-line change that lifts all buttons subtly on hover. It works with the existing solid-background buttons (Launch, Update) and the transparent ones alike.
- For solid action buttons (Launch, Update, Install, Invite), the opacity fade is sufficient
- For the back button and settings gear specifically, add a `.icon-btn` CSS class in `globals.css` with `border-radius: 4px` and a `:hover` rule: `background: rgba(255,255,255,0.05)` — gives them a "pressable" feel. Apply this class to the ChevronLeft back buttons (AppInfoView, SettingsView) and the Settings gear (AppList).
- Do not restore `outline` for focus — this is a tray app with no keyboard navigation path, so focus rings would add noise without benefit

---

### Finding 6: No view transitions

**Files:** `src/App.tsx`, `src/styles/globals.css`

View switches (AppList ↔ Settings ↔ AppInfo) are instant swaps with no animation.

**Design:**
- Add a CSS fade-in animation in `globals.css`:
  ```css
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .view-enter { animation: fadeIn 150ms ease-out; }
  ```
- Apply `className="view-enter"` to the root `<div>` of each view component (AppList, SettingsView, AppInfoView)
- 150ms duration — fast enough to not feel slow in a tray popup, long enough to feel intentional
- The 4px Y-translate gives a subtle "rising in" feel appropriate for a popup context. No slide — a fixed-size tray window has no room to imply direction.

---

### Finding 7: Install button hierarchy is backwards

**File:** `src/components/AppRow.tsx`

For not-installed apps, Install is the primary CTA — but it uses the weakest button style (ghost: transparent background, `--border` border, `--text-dim` text, normal font weight). This signals "optional" when it should signal "available."

**Design:**
- New Install button style — midpoint between ghost and Launch:
  - Background: `rgba(255, 255, 255, 0.05)` (subtle filled)
  - Border: `1px solid var(--border-muted)` → upgrade to `1px solid #2e2f36` (slightly brighter than current `--border`)
  - Text: `var(--text-dim)` (#646670) → upgrade to `var(--text-light)` (#aeafb8)
  - Font weight: keep at 400 (distinguished from Launch/Update at 700)
- This makes Install look clickable and available without competing with Launch (gold) or Update (gold-bright)

---

## Tier 3 — Code Quality

### Finding 8: Duplicate APP_ICONS and APP_NAMES

**Files:** `src/components/AppRow.tsx`, `src/components/AppInfoView.tsx`

Both files define identical `APP_ICONS` and `APP_NAMES` record objects. `APP_BLURBS` lives only in AppInfoView but logically belongs with this metadata.

**Design:**
- Create `src/lib/appMeta.ts` exporting:
  - `APP_ICONS: Record<AppId, string>`
  - `APP_NAMES: Record<AppId, string>`
  - `APP_BLURBS: Record<AppId, string>`
- Remove the duplicates from AppRow.tsx and AppInfoView.tsx, import from `@/lib/appMeta` (or relative path)
- No behavior change — pure extraction

---

## Implementation Order

1. **Finding 8** — Extract appMeta.ts first (no behavior change, reduces noise in later diffs)
2. **Finding 1** — Error state retry (new prop + row border tint)
3. **Finding 2** — `?` button color/size lift
4. **Finding 5** — AppInfoView Install CTA
5. **Finding 7** — Install button style upgrade
6. **Finding 3** — Footer button size
7. **Finding 4** — Hover states via globals.css
8. **Finding 6** — View fade-in animation

Findings 3, 4, 7 can be done in a single pass since they all touch styles.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/appMeta.ts` | New — shared app metadata |
| `src/components/AppRow.tsx` | Error border + retry button + `?` color + Install style + remove duplicate consts |
| `src/components/AppInfoView.tsx` | Install CTA footer + remove duplicate consts |
| `src/components/AppList.tsx` | Pass downloadUrl/onInstall to AppInfoView + footer button sizing + onRetry handler |
| `src/styles/globals.css` | `button:hover` opacity + `.view-enter` animation |
| `src/App.tsx` | Add `className="view-enter"` to view root divs |

---

## Out of Scope

- Changelog / release notes link on update rows — requires backend work
- Platform-specific Windows hover states — current Linux-only GearLeverPrompt already handles platform branching; Windows UI parity is a separate feature
- Accessibility / keyboard navigation — intentionally out of scope for a tray popup
