# UI/UX Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 UI/UX findings from the pre-release audit — covering error state treatment, info button discoverability, AppInfoView Install CTA, button hierarchy, hover states, view transitions, footer sizing, and shared metadata extraction.

**Architecture:** Changes are confined to the React renderer layer (`src/`). No Electron IPC changes required. Tasks are ordered so code quality (Finding 8) comes first to reduce noise in later diffs, then critical fixes (Findings 1, 2, 5), then polish (Findings 7, 3, 4, 6).

**Tech Stack:** React 18, TypeScript, Vite, Vitest + React Testing Library, inline React.CSSProperties styles, CSS variables in `src/styles/globals.css`.

**Spec:** `docs/superpowers/specs/2026-04-22-ui-ux-audit-design.md`

**Run tests:** `npm test` (Vitest, runs all files in `src/__tests__/`)
**Typecheck:** `npm run typecheck`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/appMeta.ts` | **Create** | Single source of truth for APP_ICONS, APP_NAMES, APP_BLURBS |
| `src/components/AppRow.tsx` | **Modify** | Error border + retry button, `?` color lift, Install style upgrade, import appMeta |
| `src/components/AppInfoView.tsx` | **Modify** | Install CTA footer, import appMeta |
| `src/components/AppList.tsx` | **Modify** | Pass downloadUrl/onInstall to AppInfoView, implement onRetry, footer font/padding |
| `src/styles/globals.css` | **Modify** | `button:hover` opacity, `.icon-btn` hover class, `.view-enter` fade animation |
| `src/App.tsx` | **Modify** | Add `className="view-enter"` to root div of each view |
| `src/__tests__/AppRow.test.tsx` | **Modify** | Add tests for error state retry button |
| `src/__tests__/AppInfoView.test.tsx` | **Create** | Tests for Install CTA presence and callback |

---

## Task 1: Extract shared app metadata

**Files:**
- Create: `src/lib/appMeta.ts`
- Modify: `src/components/AppRow.tsx` (remove duplicate constants, import from appMeta)
- Modify: `src/components/AppInfoView.tsx` (remove duplicate constants, import from appMeta)

No behavior change — this is a pure extraction. Tests should still pass unchanged.

- [ ] **Step 1: Create `src/lib/appMeta.ts`**

```typescript
import type { AppId } from '@shared/types'

export const APP_ICONS: Record<AppId, string> = {
  axibridge: './svg/AxiBridge-white.svg',
  axiforge:  './svg/axiforge.svg',
  axipulse:  './svg/axipulse-white.svg',
  axiam:     './svg/axiam.svg',
  axitools:  './svg/axitools-white.svg',
}

export const APP_NAMES: Record<AppId, string> = {
  axibridge: 'AxiBridge',
  axiforge:  'AxiForge',
  axipulse:  'AxiPulse',
  axiam:     'AxiAM',
  axitools:  'AxiTools',
}

export const APP_BLURBS: Record<AppId, string> = {
  axibridge: 'Watches your arcdps log folder and posts per-fight Discord embeds as fights happen, plus an aggregated stats view across all fights — so your squad can review performance without leaving the server.',
  axiforge:  'Build and comp manager for Guild Wars 2 squads. Create, edit, and publish builds and squad compositions to a GitHub Pages site you own and control — your data, your way.',
  axipulse:  'Parses your arcdps logs locally with Elite Insights and shows your personal combat breakdown — damage, timelines, and performance history — focused on how YOU performed, fight by fight.',
  axiam:     'A secure account launcher that stores encrypted GW2 credentials, manages multiple accounts, and launches them through Steam with custom arguments, all behind a master password.',
  axitools:  'A Discord bot for GW2 communities — build sharing, RSS feeds, patch note alerts, and scheduled squad signups, with per-guild isolated storage for complete privacy.',
}
```

- [ ] **Step 2: Update `src/components/AppRow.tsx` — remove duplicate constants, add import**

Replace the two constant blocks at the top of AppRow.tsx:

```typescript
// Remove these two blocks entirely:
// const APP_ICONS: Record<AppId, string> = { ... }
// const APP_NAMES: Record<AppId, string> = { ... }

// Add this import after the existing imports:
import { APP_ICONS, APP_NAMES } from '../lib/appMeta'
```

The import line goes after the existing `import type { AppState, AppId, InstallableAppId }` line.

- [ ] **Step 3: Update `src/components/AppInfoView.tsx` — remove duplicates, add import**

Replace the three constant blocks at the top of AppInfoView.tsx:

```typescript
// Remove these three blocks entirely:
// const APP_ICONS: Record<AppId, string> = { ... }
// const APP_NAMES: Record<AppId, string> = { ... }
// const APP_BLURBS: Record<AppId, string> = { ... }

// Add this import after the existing imports:
import { APP_ICONS, APP_NAMES, APP_BLURBS } from '../lib/appMeta'
```

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test
npm run typecheck
```

Expected: all existing tests pass, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/appMeta.ts src/components/AppRow.tsx src/components/AppInfoView.tsx
git commit -m "refactor: extract APP_ICONS, APP_NAMES, APP_BLURBS to src/lib/appMeta.ts"
```

---

## Task 2: Error state — retry button and red row border

**Files:**
- Modify: `src/components/AppRow.tsx`
- Modify: `src/__tests__/AppRow.test.tsx`

`AppState` already has an `errorMessage?: string` field (from `electron/shared/types.ts`). The `status === 'error'` path currently renders nothing in the action slot. We add a retry button and a red border tint on the row.

- [ ] **Step 1: Write failing tests in `src/__tests__/AppRow.test.tsx`**

Add these two tests inside the existing `describe('AppRow', ...)` block:

```typescript
it('shows retry button when status is error', () => {
  const state: AppState = { ...baseState, status: 'error' }
  render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
})

it('calls onRetry with appId when retry button clicked', () => {
  const onRetry = vi.fn()
  const state: AppState = { ...baseState, status: 'error' }
  render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={onRetry} />)
  fireEvent.click(screen.getByRole('button', { name: /retry/i }))
  expect(onRetry).toHaveBeenCalledWith('axibridge')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 2 new tests FAIL — "onRetry is not a prop" / "retry button not found".

- [ ] **Step 3: Update the `Props` interface in `AppRow.tsx`**

```typescript
interface Props {
  state: AppState
  onAction: (action: ActionType, appId: AppId) => void
  onInfo: (appId: AppId) => void
  onRetry: (appId: AppId) => void
}
```

- [ ] **Step 4: Destructure `onRetry` in the component function signature**

```typescript
export function AppRow({ state, onAction, onInfo, onRetry }: Props) {
```

- [ ] **Step 5: Add the error case to `renderAction()` in `AppRow.tsx`**

Add this block after the `if (gearLeverMissing)` check and before the `if (isLaunching)` check. This preserves the GearLeverPrompt on Linux if Gear Lever install fails (gearLeverMissing can coexist with status=error):

```typescript
if (status === 'error') {
  return (
    <button
      onClick={() => onRetry(id)}
      aria-label="Retry"
      title="Retry"
      style={{
        background: 'none',
        border: '1px solid rgba(224, 82, 82, 0.4)',
        borderRadius: 4,
        color: '#e05252',
        cursor: 'pointer',
        padding: '3px 8px',
        fontSize: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <RefreshCw size={10} />
      Retry
    </button>
  )
}
```

Add `RefreshCw` to the lucide-react import at the top of the file:

```typescript
import { Play, Download, ArrowUp, ExternalLink, Loader2, HelpCircle, RefreshCw } from 'lucide-react'
```

- [ ] **Step 6: Add red border tint to the row when status is error**

In the row's outer `<div>` style (line ~147), update the border logic:

```typescript
border: `1px solid ${
  status === 'error'   ? 'rgba(224, 82, 82, 0.35)' :
  hasUpdateBorder      ? 'var(--gold-border-bright)' :
  'var(--border)'
}`,
```

- [ ] **Step 7: Update `AppList.tsx` — add `onRetry` handler and pass it to AppRow**

In `AppList.tsx`, add the `onRetry` handler inside the component body, after `handleAction`:

```typescript
const handleRetry = (appId: AppId) => {
  const state = stateMap[appId]
  if (state?.installedVersion) {
    window.axiom.launch(appId)
  } else {
    window.axiom.install(appId as InstallableAppId)
  }
}
```

Pass it to each AppRow:

```typescript
<AppRow key={id} state={stateMap[id]} onAction={handleAction} onInfo={onOpenInfo} onRetry={handleRetry} />
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npm test
npm run typecheck
```

Expected: all tests pass including the 2 new ones.

- [ ] **Step 9: Commit**

```bash
git add src/components/AppRow.tsx src/components/AppList.tsx src/__tests__/AppRow.test.tsx
git commit -m "feat: add retry button and error border for error state in AppRow"
```

---

## Task 3: Raise info button visibility

**Files:**
- Modify: `src/components/AppRow.tsx`

Two places in `renderAction()` render the `?` (HelpCircle) button — once for not-installed apps, once for AxiTools. Both use `color: 'var(--text-faint)'` and `size={14}`. We lift them to `--text-dim` and 15px.

- [ ] **Step 1: Find both HelpCircle button instances in `renderAction()` in `AppRow.tsx`**

There are two identical inline button objects — one inside the `if (id === 'axitools')` branch and one inside the `if (notInstalled)` branch. In both, update:

```typescript
// change:
color: 'var(--text-faint)',
// to:
color: 'var(--text-dim)',
```

And change `<HelpCircle size={14} />` to `<HelpCircle size={15} />` in both places.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all existing tests pass (no behavior change, only visual).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppRow.tsx
git commit -m "fix: raise info button contrast from text-faint to text-dim, 14→15px"
```

---

## Task 4: AppInfoView Install CTA

**Files:**
- Modify: `src/components/AppInfoView.tsx`
- Modify: `src/components/AppList.tsx`
- Create: `src/__tests__/AppInfoView.test.tsx`

When opened for a not-installed app that has a `downloadUrl`, the info view should show an Install button at the bottom.

- [ ] **Step 1: Create `src/__tests__/AppInfoView.test.tsx` with failing tests**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppInfoView } from '../components/AppInfoView'

describe('AppInfoView', () => {
  it('does not show Install button when no downloadUrl', () => {
    render(<AppInfoView appId="axibridge" onBack={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()
  })

  it('shows Install button when downloadUrl is provided', () => {
    render(
      <AppInfoView
        appId="axibridge"
        onBack={vi.fn()}
        downloadUrl="https://example.com/axibridge.AppImage"
        onInstall={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
  })

  it('calls onInstall when Install button clicked', () => {
    const onInstall = vi.fn()
    render(
      <AppInfoView
        appId="axibridge"
        onBack={vi.fn()}
        downloadUrl="https://example.com/axibridge.AppImage"
        onInstall={onInstall}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /install/i }))
    expect(onInstall).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: 2 tests FAIL — "Install button not found" / "onInstall not a prop".

- [ ] **Step 3: Update `Props` interface in `AppInfoView.tsx`**

```typescript
interface Props {
  appId: AppId
  onBack: () => void
  downloadUrl?: string
  onInstall?: () => void
}
```

- [ ] **Step 4: Destructure new props in the component function**

```typescript
export function AppInfoView({ appId, onBack, downloadUrl, onInstall }: Props) {
```

- [ ] **Step 5: Add the Install footer to the JSX in `AppInfoView.tsx`**

After the centered content `<div>` (the one with `flex: 1, alignItems: 'center'…`) and before the closing root `<div>`, add:

```typescript
{downloadUrl && onInstall && (
  <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
    <button
      onClick={onInstall}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid #2e2f36',
        borderRadius: 4,
        color: 'var(--text-light)',
        fontSize: 11,
        padding: '7px 0',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <Download size={12} />
      Install
    </button>
  </div>
)}
```

Add `Download` to the lucide-react import at the top of AppInfoView.tsx:

```typescript
import { ChevronLeft, Download } from 'lucide-react'
```

- [ ] **Step 6: Update `AppList.tsx` — pass downloadUrl and onInstall to AppInfoView**

`AppList` currently calls `onOpenInfo(appId)` and the parent (`App.tsx`) decides what to show. Check how AppInfoView is rendered in `App.tsx`:

```bash
grep -n "AppInfoView\|onOpenInfo\|infoAppId" /var/home/mstephens/Documents/GitHub/axiom/src/App.tsx
```

The view router in `App.tsx` renders `<AppInfoView appId={infoAppId} onBack={...} />`. We need to pass `downloadUrl` and `onInstall` from the app state. Update `App.tsx` to:

```typescript
// Find the state for the info app
const infoState = states.find(s => s.id === infoAppId)

// In the JSX where AppInfoView is rendered:
<AppInfoView
  appId={infoAppId}
  onBack={() => setView('list')}
  downloadUrl={infoState?.downloadUrl ?? undefined}
  onInstall={infoState?.downloadUrl ? () => window.axiom.install(infoAppId as InstallableAppId) : undefined}
/>
```

Note: `axitools` has no `downloadUrl` so the Install button will never appear for it — correct behavior.

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test
npm run typecheck
```

Expected: all 3 new tests pass, existing tests unaffected.

- [ ] **Step 8: Commit**

```bash
git add src/components/AppInfoView.tsx src/App.tsx src/__tests__/AppInfoView.test.tsx
git commit -m "feat: add Install CTA to AppInfoView for not-installed apps"
```

---

## Task 5: Upgrade Install button style

**Files:**
- Modify: `src/components/AppRow.tsx`

The `install` variant in `btnStyle()` is currently the weakest style — ghost with muted text. Upgrade to a midpoint between ghost and Launch.

- [ ] **Step 1: Update the `install` case in `btnStyle()` in `AppRow.tsx`**

Find the `switch (variant)` block and replace the `install` case:

```typescript
// Before:
case 'install': return { ...base, background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', fontWeight: 400 }

// After:
case 'install': return { ...base, background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-light)', border: '1px solid #2e2f36', fontWeight: 400 }
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass (style-only change, button is still present and labeled "Install").

- [ ] **Step 3: Commit**

```bash
git add src/components/AppRow.tsx
git commit -m "fix: elevate Install button style — filled bg and brighter text vs ghost"
```

---

## Task 6: Footer button sizing

**Files:**
- Modify: `src/components/AppList.tsx`

Both footer buttons ("Check for updates" and "Quit") have `fontSize: 10` and `padding: 0`. Increase to 11px and add 4px vertical padding.

- [ ] **Step 1: Update both footer buttons in `AppList.tsx`**

Find the "Check for updates" button style and update:

```typescript
// Before:
style={{
  background: 'none',
  color: checking ? 'var(--text-faint)' : 'var(--text-dim)',
  fontSize: 10,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}}

// After:
style={{
  background: 'none',
  color: checking ? 'var(--text-faint)' : 'var(--text-dim)',
  fontSize: 11,
  padding: '4px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}}
```

Find the "Quit" button style and update:

```typescript
// Before:
style={{
  background: 'none',
  color: 'var(--text-faint)',
  fontSize: 10,
  padding: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}}

// After:
style={{
  background: 'none',
  color: 'var(--text-faint)',
  fontSize: 11,
  padding: '4px 0',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/AppList.tsx
git commit -m "fix: increase footer button font size 10→11px and add 4px vertical padding"
```

---

## Task 7: Hover states

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/components/AppList.tsx` (add `.icon-btn` class to Settings gear)
- Modify: `src/components/AppInfoView.tsx` (add `.icon-btn` class to back button)
- Modify: `src/components/SettingsView.tsx` (add `.icon-btn` class to back button)

- [ ] **Step 1: Add hover rules to `src/styles/globals.css`**

Append after the `.spin` rule:

```css
button:hover:not(:disabled) { opacity: 0.8; }

.icon-btn {
  border-radius: 4px;
  transition: background 0.1s;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.05) !important;
  opacity: 1 !important;
}
```

The `opacity: 1 !important` on `.icon-btn:hover` prevents the global `button:hover` opacity fade from competing with the background wash on icon buttons — they get the wash instead.

- [ ] **Step 2: Add `className="icon-btn"` to the Settings gear button in `AppList.tsx`**

Find the Settings button:

```typescript
<button
  onClick={onOpenSettings}
  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, display: 'flex', alignItems: 'center' }}
  title="Settings"
>
```

Add `className="icon-btn"` to it:

```typescript
<button
  onClick={onOpenSettings}
  className="icon-btn"
  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, display: 'flex', alignItems: 'center' }}
  title="Settings"
>
```

- [ ] **Step 3: Add `className="icon-btn"` to the back button in `AppInfoView.tsx`**

Find the ChevronLeft button and add `className="icon-btn"`:

```typescript
<button
  onClick={onBack}
  aria-label="Back"
  className="icon-btn"
  style={{ background: 'none', color: 'var(--text-dim)', padding: '2px 4px 2px 0', marginRight: 2, display: 'flex', alignItems: 'center' }}
>
```

- [ ] **Step 4: Add `className="icon-btn"` to the back button in `SettingsView.tsx`**

Same change in SettingsView:

```typescript
<button
  onClick={onBack}
  aria-label="Back"
  className="icon-btn"
  style={{ background: 'none', color: 'var(--text-dim)', padding: '2px 4px 2px 0', marginRight: 2, display: 'flex', alignItems: 'center' }}
>
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/styles/globals.css src/components/AppList.tsx src/components/AppInfoView.tsx src/components/SettingsView.tsx
git commit -m "feat: add hover states — opacity fade on all buttons, background wash on icon buttons"
```

---

## Task 8: View fade-in animation

**Files:**
- Modify: `src/styles/globals.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the `fadeIn` keyframe and `.view-enter` class to `globals.css`**

Append after the `.icon-btn` rules:

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.view-enter { animation: fadeIn 150ms ease-out; }
```

- [ ] **Step 2: Check current view structure in `App.tsx`**

```bash
grep -n "AppList\|SettingsView\|AppInfoView\|view-enter\|className" /var/home/mstephens/Documents/GitHub/axiom/src/App.tsx
```

Identify the JSX lines that render each of the three views.

- [ ] **Step 3: Add `className="view-enter"` to each view's root element**

Each view component (`AppList`, `SettingsView`, `AppInfoView`) is rendered by `App.tsx`. Wrap each in a keyed fragment or add the class to the component's root. Since all three components own their root `<div>`, the cleanest approach is to add `className="view-enter"` on each component's root `<div>` directly in the component file:

In `src/components/AppList.tsx`, the root div:
```typescript
// Before:
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
// After:
<div className="view-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
```

In `src/components/SettingsView.tsx`, the root div:
```typescript
// Before:
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
// After:
<div className="view-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
```

In `src/components/AppInfoView.tsx`, the root div:
```typescript
// Before:
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
// After:
<div className="view-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
```

This fires the animation whenever the component mounts — which happens on every view switch, since `App.tsx` conditionally renders exactly one view at a time.

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test
npm run typecheck
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css src/components/AppList.tsx src/components/SettingsView.tsx src/components/AppInfoView.tsx
git commit -m "feat: add 150ms fade-in transition on view changes"
```

---

## Final verification

- [ ] **Run full test suite one last time**

```bash
npm test
npm run typecheck
```

Expected: all tests green, no type errors.

- [ ] **Manual smoke test with dev server**

```bash
npm run dev:noinstalls
```

Verify visually:
1. All 5 app rows render correctly — icons, names, status text
2. "Not installed" rows show `?` button in dim color (visible)
3. Install button has elevated style (not pure ghost)
4. Switching to Settings and back shows a subtle fade
5. Opening an app info screen shows the Install button at the bottom
6. Simulating error state (if possible) shows Retry button with red border
7. Hovering any button shows a visual reaction
8. Footer buttons are slightly larger and easier to click
