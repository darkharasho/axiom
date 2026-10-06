// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createConfig, hashIdentity, type AxiConfig } from '@axiapps/axi-config'
import { startAccess, type AccessDeps } from '../access'

const quiet = { warn: () => {} }
const GITHUB_ID = 4242424
const manifest = (denylist: string[]) =>
  new Response(JSON.stringify({ version: 1, flags: {}, minVersion: null, notice: null, denylist }), { status: 200, headers: { etag: '"v1"' } })

let dir: string
let configs: AxiConfig[] = []
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'axiom-access-')) })
afterEach(async () => {
  for (const c of configs) c.close()
  configs = []
  await rm(dir, { recursive: true, force: true })
})

function makeConfig(fetchFn: typeof fetch) {
  const c = createConfig({ appId: 'axiom', cacheDir: dir, url: 'https://cfg.test', fetch: fetchFn, logger: quiet })
  configs.push(c)
  return c
}

class FakeWindow {
  static all: FakeWindow[] = []
  url = ''
  destroyed = false
  constructor(_options: Record<string, unknown>) { FakeWindow.all.push(this) }
  isDestroyed() { return this.destroyed }
  destroy() { this.destroyed = true }
  removeMenu() {}
  async loadURL(url: string) { this.url = url }
  on() { return this }
  webContents = { setWindowOpenHandler: () => {}, on: () => this.webContents }
}

function fakeElectron() {
  return {
    app: { quit: vi.fn(), relaunch: vi.fn(), exit: vi.fn(), on: () => {}, getPath: () => dir },
    BrowserWindow: Object.assign(FakeWindow, { getAllWindows: () => FakeWindow.all.filter((w) => !w.destroyed) }),
    shell: { openExternal: vi.fn(async () => {}) },
  } as unknown as AccessDeps['electron']
}

beforeEach(() => { FakeWindow.all = [] })

describe('startAccess', () => {
  it('calls onBlocked once when the signed-in GitHub id is listed', async () => {
    const hash = await hashIdentity('github_user', String(GITHUB_ID))
    const config = makeConfig((async () => manifest([hash])) as typeof fetch)
    const onBlocked = vi.fn()
    const boot = await startAccess({ electron: fakeElectron(), config, onBlocked, getGithubId: () => GITHUB_ID })
    expect(boot.blocked).toBe(false)
    if (boot.blocked) return
    await config.refresh()
    await boot.gate.recheck()
    await boot.gate.recheck()
    expect(onBlocked).toHaveBeenCalledTimes(1)
    expect(onBlocked).toHaveBeenCalledWith({ persisted: true })
  })

  it('does not block clean identities or a user who has not signed in', async () => {
    const hash = await hashIdentity('github_user', '999')
    const config = makeConfig((async () => manifest([hash])) as typeof fetch)
    const onBlocked = vi.fn()
    let id: number | null = GITHUB_ID
    const boot = await startAccess({ electron: fakeElectron(), config, onBlocked, getGithubId: () => id })
    if (boot.blocked) throw new Error('unexpected block')
    await config.refresh()
    await boot.gate.recheck()
    id = null
    await boot.gate.recheck()
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('boots into the block screen when the sticky trip is set', async () => {
    const hash = await hashIdentity('github_user', String(GITHUB_ID))
    const first = makeConfig((async () => manifest([hash])) as typeof fetch)
    await first.ready()
    await first.refresh()
    expect((await first.check([{ kind: 'github_user', value: String(GITHUB_ID) }])).persisted).toBe(true)

    const second = makeConfig((async () => { throw new Error('offline') }) as typeof fetch)
    const electron = fakeElectron()
    const boot = await startAccess({ electron, config: second, getGithubId: () => null })
    expect(boot).toEqual({ blocked: true })
    expect(FakeWindow.all).toHaveLength(1)
  })

  it('fails open when offline with no cache', async () => {
    const config = makeConfig((async () => { throw new Error('offline') }) as typeof fetch)
    const onBlocked = vi.fn()
    const boot = await startAccess({ electron: fakeElectron(), config, onBlocked, getGithubId: () => GITHUB_ID })
    expect(boot.blocked).toBe(false)
    if (boot.blocked) return
    await boot.gate.recheck()
    expect(onBlocked).not.toHaveBeenCalled()
  })

  it('treats a throwing id getter as no identity', async () => {
    const config = makeConfig((async () => manifest([])) as typeof fetch)
    const onBlocked = vi.fn()
    const boot = await startAccess({ electron: fakeElectron(), config, onBlocked, getGithubId: () => { throw new Error('x') } })
    if (boot.blocked) throw new Error('unexpected block')
    expect(await boot.gate.recheck()).toBe(false)
    expect(onBlocked).not.toHaveBeenCalled()
  })
})
