import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/axiom-test-userdata', getVersion: () => '0.1.0', isPackaged: false },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  shell: {}, Notification: vi.fn(), dialog: {}, clipboard: {}, net: {},
  safeStorage: { isEncryptionAvailable: () => false },
}))
vi.mock('electron-updater', () => ({ autoUpdater: { on: vi.fn() } }))
vi.mock('electron-log', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { setRemoteAllowlist, checkAppearedAfter } from '../ipc-handlers'
import type { RemoteAllowlist } from '../remoteAllowlist'

function stub(allowed: boolean) {
  const listeners: (() => void)[] = []
  const r: RemoteAllowlist & { fire(): void; allowed: boolean } = {
    allowed,
    setGithubId: async () => {},
    allows(id) { return this.allowed && id === 'axidps' },
    onChange(fn) { listeners.push(fn); return () => {} },
    fire() { listeners.forEach(l => l()) },
  }
  return r
}

function fakeWin() {
  const send = vi.fn()
  return { send, win: { webContents: { send } } as never }
}

const lastIds = (send: ReturnType<typeof vi.fn>) => {
  const calls = send.mock.calls.filter(c => c[0] === 'axiom:states-updated')
  return (calls.at(-1)?.[1] as { id: string }[]).map(s => s.id)
}

describe('remote allowlist wiring', () => {
  it('a remote change re-sends the states with the newly allowed app, and checks it for updates', () => {
    const r = stub(false)
    const { send, win } = fakeWin()
    const check = vi.fn()
    setRemoteAllowlist(r, win, { checkAppeared: check })
    r.fire()
    expect(lastIds(send)).not.toContain('axidps')
    expect(check).not.toHaveBeenCalled()
    r.allowed = true
    r.fire()
    expect(lastIds(send)).toContain('axidps')
    expect(check).toHaveBeenCalledTimes(1)
    expect(check).toHaveBeenCalledWith(['axidps'])
  })

  it('a removed tester loses the app on the next push', () => {
    const r = stub(true)
    const { send, win } = fakeWin()
    setRemoteAllowlist(r, win, { checkAppeared: vi.fn() })
    r.fire()
    expect(lastIds(send)).toContain('axidps')
    r.allowed = false
    r.fire()
    expect(lastIds(send)).not.toContain('axidps')
  })

  it("every change also refreshes the tray dot, so a removed app's update stops showing at once", () => {
    const r = stub(true)
    const { win } = fakeWin()
    const changed = vi.fn()
    setRemoteAllowlist(r, win, { checkAppeared: vi.fn(), onChange: changed })
    r.allowed = false
    r.fire()
    expect(changed).toHaveBeenCalledTimes(1)
  })
})

describe('checkAppearedAfter', () => {
  it('waits for a running check and skips a second one when it already found the app', async () => {
    let release!: () => void
    const running = new Promise<void>(r => { release = r })
    const latest: Record<string, string | null> = { axidps: null }
    const check = vi.fn(async () => {})
    const done = checkAppearedAfter(['axidps'], () => running, id => latest[id] ?? null, check)
    latest.axidps = '1.0.0'
    release()
    await done
    expect(check).not.toHaveBeenCalled()
  })

  it('checks again when the running check passed the app before it appeared', async () => {
    const check = vi.fn(async () => {})
    await checkAppearedAfter(['axidps'], () => Promise.resolve(), () => null, check)
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('checks at once when nothing is running', async () => {
    const check = vi.fn(async () => {})
    await checkAppearedAfter(['axidps'], () => null, () => null, check)
    expect(check).toHaveBeenCalledTimes(1)
  })
})
