import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/axiom-test-config') },
}))

const TEST_DIR = '/tmp/axiom-test-config'

beforeEach(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true })
  vi.resetModules()
})

describe('config', () => {
  it('returns DEFAULT_CONFIG when no file exists', async () => {
    const { readConfig } = await import('../config')
    const cfg = readConfig()
    expect(cfg.autoStart).toBe(false)
    expect(cfg.apps.axibridge.installedVersion).toBeNull()
  })

  it('writes and reads back a config', async () => {
    const { readConfig, writeConfig } = await import('../config')
    writeConfig({ autoStart: true, notifyOnUpdates: false, trayBadge: true, apps: readConfig().apps })
    const cfg = readConfig()
    expect(cfg.autoStart).toBe(true)
  })

  it('merges partial updates via patchConfig', async () => {
    const { readConfig, patchConfig } = await import('../config')
    patchConfig({ autoStart: true })
    const cfg = readConfig()
    expect(cfg.autoStart).toBe(true)
  })

  it('sets installedVersion for an app', async () => {
    const { setInstalledVersion, readConfig } = await import('../config')
    setInstalledVersion('axibridge', '2.5.11')
    expect(readConfig().apps.axibridge.installedVersion).toBe('2.5.11')
  })
})
