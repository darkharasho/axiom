# Update All Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Update All" button to the AppList footer that appears when 2+ managed apps have pending updates and triggers all installs in parallel.

**Architecture:** Pure UI change in `AppList.tsx`. Derives eligible apps from existing `states` prop, fires `window.axiom.install` for each simultaneously. No new IPC, no new state, no changes to any other file.

**Tech Stack:** React, TypeScript, Vitest + @testing-library/react

---

### Task 1: Write failing tests for the Update All button

**Files:**
- Create: `src/__tests__/AppList.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppList } from '../components/AppList'
import type { AppState } from '@shared/types'

const makeState = (id: AppState['id'], overrides: Partial<AppState> = {}): AppState => ({
  id,
  installedVersion: '1.0.0',
  latestVersion: '1.0.0',
  downloadUrl: null,
  status: 'idle',
  ...overrides,
})

const defaultProps = {
  checking: false,
  onOpenSettings: vi.fn(),
  onCheckUpdates: vi.fn(),
  onOpenInfo: vi.fn(),
}

describe('AppList — Update All button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show Update All when fewer than 2 apps have updates', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0' }),
      makeState('axiforge'),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('shows Update All when 2 or more apps have updates', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    expect(screen.getByRole('button', { name: /update all/i })).toBeInTheDocument()
  })

  it('does not count busy apps (downloading) as eligible', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0', status: 'downloading' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    // Only 1 eligible (axibridge is busy) — button must not appear
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('does not count installing apps as eligible', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0', status: 'installing' }),
      makeState('axiforge', { latestVersion: '2.0.0', status: 'installing' }),
      makeState('axipulse', { latestVersion: '2.0.0' }),
    ]
    render(<AppList states={states} {...defaultProps} />)
    // Only 1 eligible — button must not appear
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('calls window.axiom.install for each eligible app on click', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /update all/i }))
    expect(window.axiom.install).toHaveBeenCalledWith('axibridge')
    expect(window.axiom.install).toHaveBeenCalledWith('axiforge')
    expect(window.axiom.install).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
npm test -- --reporter=verbose src/__tests__/AppList.test.tsx
```

Expected: 5 failures — `AppList` renders but "Update All" button never appears.

---

### Task 2: Implement the Update All button in AppList

**Files:**
- Modify: `src/components/AppList.tsx`

- [ ] **Step 1: Add eligible-apps derivation and handler inside the component**

In `AppList`, after the existing `stateMap` and `handleRetry` declarations, add:

```tsx
const appsWithUpdates = states.filter(s => {
  const hasUpdate = s.installedVersion && s.latestVersion && s.installedVersion !== s.latestVersion
  const isBusy = s.status === 'downloading' || s.status === 'installing' || s.status === 'deleting'
  return hasUpdate && !isBusy
})

const handleUpdateAll = () => {
  appsWithUpdates.forEach(s => window.axiom.install(s.id as InstallableAppId))
}
```

- [ ] **Step 2: Update the footer JSX to include the button**

Replace the existing footer `<div>` (lines 98–143 of `AppList.tsx`) with:

```tsx
{/* Footer */}
<div style={{
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid var(--border)',
}}>
  <button
    onClick={onCheckUpdates}
    disabled={checking}
    className="btn-ghost"
    style={{
      background: 'none',
      color: checking ? 'var(--text-faint)' : 'var(--text-dim)',
      fontSize: 11,
      padding: '4px 0',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      transition: 'color 0.1s',
    }}
    onMouseEnter={e => { if (!checking) e.currentTarget.style.color = 'var(--text-light)' }}
    onMouseLeave={e => { if (!checking) e.currentTarget.style.color = 'var(--text-dim)' }}
  >
    <RefreshCw size={10} className={checking ? 'spin' : ''} />
    {checking ? 'Checking...' : 'Check for updates'}
  </button>

  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    {appsWithUpdates.length >= 2 && (
      <button
        onClick={handleUpdateAll}
        className="btn-ghost"
        style={{
          background: 'none',
          color: 'var(--gold-bright)',
          fontSize: 11,
          padding: '4px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        Update All
      </button>
    )}
    <button
      onClick={() => window.axiom.quit()}
      className="btn-ghost"
      style={{
        background: 'none',
        color: 'var(--text-dim)',
        fontSize: 11,
        padding: '4px 0',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={e => (e.currentTarget.style.color = '#e05252')}
      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
    >
      <LogOut size={10} />
      Quit
    </button>
  </div>
</div>
```

- [ ] **Step 3: Run all tests and confirm they pass**

```bash
npm test
```

Expected: all tests pass, including the 5 new AppList tests.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppList.tsx src/__tests__/AppList.test.tsx
git commit -m "feat: Update All button when 2+ managed apps have pending updates"
```
