import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

vi.mock('electron', () => ({
  app: { isPackaged: true, getPath: vi.fn(() => '/tmp/axiom-test-exe') },
}))

const HOME = '/tmp/axiom-autostart-test'
const AUTOSTART = path.join(HOME, '.config', 'autostart', 'axiom.desktop')
const ORIGINAL_HOME = process.env.HOME

beforeEach(() => {
  fs.mkdirSync(HOME, { recursive: true })
  process.env.HOME = HOME
  delete process.env.APPIMAGE
})

afterEach(() => {
  fs.rmSync(HOME, { recursive: true, force: true })
  process.env.HOME = ORIGINAL_HOME
  delete process.env.APPIMAGE
  vi.resetModules()
})

describe('linux autostart', () => {
  it('writes an entry pointing at the current AppImage path', async () => {
    process.env.APPIMAGE = '/apps/AxiOM-0.2.8.AppImage'
    const { setAutoStart, getAutoStart } = await import('../autostart')
    setAutoStart(true)
    expect(getAutoStart()).toBe(true)
    expect(fs.readFileSync(AUTOSTART, 'utf-8')).toContain('AxiOM-0.2.8.AppImage')
  })

  // Regression: a self-update deletes the old versioned AppImage and moves the
  // new one to a different path. The autostart Exec= still points at the deleted
  // file, so the app silently fails to launch on the next boot.
  it('rewrites a stale Exec after the AppImage path changes on self-update', async () => {
    process.env.APPIMAGE = '/apps/AxiOM-0.2.8.AppImage'
    const mod = await import('../autostart')
    mod.setAutoStart(true)

    mod.refreshAutoStartExec('/apps/AxiOM-0.2.9.AppImage')

    const contents = fs.readFileSync(AUTOSTART, 'utf-8')
    expect(contents).toContain('AxiOM-0.2.9.AppImage')
    expect(contents).not.toContain('AxiOM-0.2.8.AppImage')
  })

  it('does not create an entry when autostart is disabled', async () => {
    process.env.APPIMAGE = '/apps/AxiOM-0.2.9.AppImage'
    const mod = await import('../autostart')
    mod.refreshAutoStartExec('/apps/AxiOM-0.2.9.AppImage')
    expect(fs.existsSync(AUTOSTART)).toBe(false)
  })
})
