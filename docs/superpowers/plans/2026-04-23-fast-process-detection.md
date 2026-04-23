# Fast Process Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the slow 8s sequential process polling with parallel 3s polling plus 500ms hyper mode on state transitions.

**Architecture:** Extract `isProcessRunning` to a focused, testable module with a subprocess timeout. Rewrite `pollRunningStates` to use `Promise.all`. Add a self-scheduling `setTimeout` loop that picks its interval based on whether hyper mode is active. Hyper mode activates whenever a launch is initiated or a state flip is detected.

**Tech Stack:** TypeScript, Node.js `child_process`, vitest (existing test runner)

---

### Task 1: Extract `isProcessRunning` to `electron/process-check.ts`

**Files:**
- Create: `electron/process-check.ts`
- Create: `electron/__tests__/process-check.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `electron/__tests__/process-check.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, exec: vi.fn() }
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('isProcessRunning', () => {
  it('resolves true on Linux when pgrep exits without error', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(null, '', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(true)
  })

  it('resolves false on Linux when pgrep exits with error', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(new Error('no match'), '', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(false)
  })

  it('resolves true on Windows when tasklist output contains the exe', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(null, 'axibrdige.exe\r\n', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(true)
  })

  it('resolves false on Windows when tasklist output does not contain the exe', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(null, 'No tasks running\r\n', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(false)
  })

  it('resolves false when exec never calls back within the timeout', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation(() => ({} as any)) // never calls callback
    const { isProcessRunning } = await import('../process-check')
    const promise = isProcessRunning('AxiBridge')
    await vi.advanceTimersByTimeAsync(3000)
    expect(await promise).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- electron/__tests__/process-check.test.ts
```

Expected: FAIL — `Cannot find module '../process-check'`

- [ ] **Step 3: Create `electron/process-check.ts`**

```typescript
const PROCESS_CHECK_TIMEOUT_MS = 3000

export async function isProcessRunning(appName: string): Promise<boolean> {
  const { exec } = await import('child_process')
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), PROCESS_CHECK_TIMEOUT_MS)
    const cmd = process.platform === 'win32'
      ? `tasklist /FI "IMAGENAME eq ${appName}.exe" /NH`
      : `pgrep -i "${appName}"`
    exec(cmd, (err, stdout) => {
      clearTimeout(timer)
      if (process.platform === 'win32') {
        resolve(stdout.toLowerCase().includes(appName.toLowerCase() + '.exe'))
      } else {
        resolve(!err)
      }
    })
  })
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- electron/__tests__/process-check.test.ts
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/process-check.ts electron/__tests__/process-check.test.ts
git commit -m "feat: extract isProcessRunning with 3s subprocess timeout"
```

---

### Task 2: Wire `process-check.ts` into `ipc-handlers.ts` + parallelize polling

**Files:**
- Modify: `electron/ipc-handlers.ts`

- [ ] **Step 1: Replace the local `isProcessRunning` function with the imported one**

At the top of `electron/ipc-handlers.ts`, add the import after the existing imports:

```typescript
import { isProcessRunning } from './process-check'
```

Then delete the entire `isProcessRunning` function (lines 20–34):

```typescript
// DELETE this entire block:
async function isProcessRunning(appName: string): Promise<boolean> {
  const { exec } = await import('child_process')
  return new Promise(resolve => {
    const cmd = process.platform === 'win32'
      ? `tasklist /FI "IMAGENAME eq ${appName}.exe" /NH`
      : `pgrep -i "${appName}"`
    exec(cmd, (err, stdout) => {
      if (process.platform === 'win32') {
        resolve(stdout.toLowerCase().includes(appName.toLowerCase() + '.exe'))
      } else {
        resolve(!err)
      }
    })
  })
}
```

- [ ] **Step 2: Rewrite `pollRunningStates` to use `Promise.all`**

Replace the existing `pollRunningStates` function (currently lines 345–355):

```typescript
// OLD — delete this:
async function pollRunningStates() {
  for (const [id, meta] of Object.entries(APP_META)) {
    const appId = id as AppId
    if (!isInstallable(meta)) continue
    if (!appStates[appId].installedVersion) continue
    const running = await isProcessRunning(meta.name)
    if (running !== appStates[appId].isRunning) {
      setState(win, appId, { isRunning: running })
    }
  }
}
```

```typescript
// NEW — replace with:
async function pollRunningStates() {
  const entries = Object.entries(APP_META).filter(([id, meta]) => {
    const appId = id as AppId
    return isInstallable(meta) && appStates[appId].installedVersion
  })
  await Promise.all(entries.map(async ([id, meta]) => {
    const appId = id as AppId
    const running = await isProcessRunning(meta.name)
    if (running !== appStates[appId].isRunning) {
      setState(win, appId, { isRunning: running })
    }
  }))
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build:electron
```

Expected: exits 0, no TypeScript errors

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add electron/ipc-handlers.ts
git commit -m "refactor: parallelize process polling and import from process-check"
```

---

### Task 3: Add hyper mode + self-scheduling poll loop

**Files:**
- Modify: `electron/ipc-handlers.ts`

- [ ] **Step 1: Add constants and hyper mode state inside `registerIpcHandlers`**

Find the section at the bottom of `registerIpcHandlers` where `pollRunningStates` is defined. Just above it, add:

```typescript
const POLL_NORMAL_MS = 3000
const POLL_HYPER_MS = 500
const HYPER_DURATION_MS = 10000

let hyperModeUntil = 0
let pollTimer: ReturnType<typeof setTimeout> | null = null

function activateHyperMode() {
  hyperModeUntil = Date.now() + HYPER_DURATION_MS
}
```

- [ ] **Step 2: Call `activateHyperMode()` from `pollRunningStates` on state flip**

Update the `pollRunningStates` function to call `activateHyperMode()` when a flip is detected:

```typescript
async function pollRunningStates() {
  const entries = Object.entries(APP_META).filter(([id, meta]) => {
    const appId = id as AppId
    return isInstallable(meta) && appStates[appId].installedVersion
  })
  await Promise.all(entries.map(async ([id, meta]) => {
    const appId = id as AppId
    const running = await isProcessRunning(meta.name)
    if (running !== appStates[appId].isRunning) {
      setState(win, appId, { isRunning: running })
      activateHyperMode()
    }
  }))
}
```

- [ ] **Step 3: Replace `setInterval` with self-scheduling `setTimeout` loop**

Find and replace the bottom of `registerIpcHandlers` (the lines that currently read):

```typescript
pollRunningStates()
const runningPoll = setInterval(pollRunningStates, 8000)
win.on('closed', () => clearInterval(runningPoll))
```

Replace with:

```typescript
function scheduleNextPoll() {
  const delay = Date.now() < hyperModeUntil ? POLL_HYPER_MS : POLL_NORMAL_MS
  pollTimer = setTimeout(async () => {
    await pollRunningStates()
    scheduleNextPoll()
  }, delay)
}

pollRunningStates()
scheduleNextPoll()
win.on('closed', () => { if (pollTimer) clearTimeout(pollTimer) })
```

- [ ] **Step 4: Verify the build compiles**

```bash
npm run build:electron
```

Expected: exits 0, no TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add electron/ipc-handlers.ts
git commit -m "feat: add hyper mode polling (500ms) with 3s normal cadence"
```

---

### Task 4: Trigger hyper mode from the launch handler

**Files:**
- Modify: `electron/ipc-handlers.ts`

- [ ] **Step 1: Add `activateHyperMode()` call in the `axiom:launch` handler**

Find the `axiom:launch` handler. It currently starts:

```typescript
ipcMain.handle('axiom:launch', async (_e, appId: AppId) => {
  if (appId === 'axitools') {
    shell.openExternal(AXITOOLS_INVITE_URL)
    return
  }
  const meta = APP_META[appId]
  if (!isInstallable(meta)) return
  setState(win, appId, { status: 'launching' })
```

Add `activateHyperMode()` after the `axitools` early return:

```typescript
ipcMain.handle('axiom:launch', async (_e, appId: AppId) => {
  if (appId === 'axitools') {
    shell.openExternal(AXITOOLS_INVITE_URL)
    return
  }
  activateHyperMode()
  const meta = APP_META[appId]
  if (!isInstallable(meta)) return
  setState(win, appId, { status: 'launching' })
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build:electron
```

Expected: exits 0, no TypeScript errors

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add electron/ipc-handlers.ts
git commit -m "feat: trigger hyper mode polling on app launch"
```

---

## Manual Verification

After all tasks are complete:

1. Run the app in dev mode: `npm run dev`
2. Launch a managed app (e.g. AxiBridge) — the UI should flip to "running" within ~1 second
3. Close the managed app — the UI should flip back to "not running" within ~1–2 seconds
4. Leave the app idle for 30 seconds and confirm it doesn't spike CPU (background poll is 3s, not 500ms)
