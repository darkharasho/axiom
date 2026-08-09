import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

const electronApp = vi.hoisted(() => ({
  isPackaged: true,
  getPath: vi.fn(() => '/tmp/axiom-test-exe'),
}))
vi.mock('electron', () => ({ app: electronApp }))

const HOME = '/tmp/axiom-autostart-test'
const AUTOSTART = path.join(HOME, '.config', 'autostart', 'axiom.desktop')
const ORIGINAL_HOME = process.env.HOME

// $APPDIR is only ours when our own executable lives inside it. Under vitest
// process.execPath is the node binary, so point $APPDIR at its directory to
// simulate running from our own mounted AppImage.
const OWN_APPDIR = path.dirname(process.execPath)

beforeEach(() => {
  fs.mkdirSync(HOME, { recursive: true })
  process.env.HOME = HOME
  electronApp.isPackaged = true
  delete process.env.APPIMAGE
  delete process.env.APPDIR
})

afterEach(() => {
  fs.rmSync(HOME, { recursive: true, force: true })
  process.env.HOME = ORIGINAL_HOME
  delete process.env.APPIMAGE
  delete process.env.APPDIR
  vi.resetModules()
})

describe('linux autostart', () => {
  it('writes an entry pointing at the current AppImage path', async () => {
    process.env.APPIMAGE = '/apps/AxiOM-0.2.8.AppImage'
    process.env.APPDIR = OWN_APPDIR
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
    process.env.APPDIR = OWN_APPDIR
    const mod = await import('../autostart')
    mod.setAutoStart(true)

    mod.refreshAutoStartExec('/apps/AxiOM-0.2.9.AppImage')

    const contents = fs.readFileSync(AUTOSTART, 'utf-8')
    expect(contents).toContain('AxiOM-0.2.9.AppImage')
    expect(contents).not.toContain('AxiOM-0.2.8.AppImage')
  })

  it('does not create an entry when autostart is disabled', async () => {
    process.env.APPIMAGE = '/apps/AxiOM-0.2.9.AppImage'
    process.env.APPDIR = OWN_APPDIR
    const mod = await import('../autostart')
    mod.refreshAutoStartExec('/apps/AxiOM-0.2.9.AppImage')
    expect(fs.existsSync(AUTOSTART)).toBe(false)
  })

  // Regression: $APPIMAGE/$APPDIR are inherited by every child of an AppImage,
  // so a dev run launched from a terminal inside another AppImage saw that
  // app's $APPIMAGE and wrote an autostart entry that booted the wrong app.
  it('ignores an $APPIMAGE inherited from a parent AppImage in dev', async () => {
    electronApp.isPackaged = false
    process.env.APPIMAGE = '/home/u/AppImages/sai.appimage'
    process.env.APPDIR = '/tmp/.mount_sai.apUXTvCc'
    const { setAutoStart } = await import('../autostart')
    setAutoStart(true)
    expect(fs.existsSync(AUTOSTART)).toBe(false)
  })

  // A packaged non-AppImage build (deb/rpm) has no $APPIMAGE at all and must
  // still fall back to the real executable path.
  it('falls back to the executable path when packaged outside an AppImage', async () => {
    const { setAutoStart } = await import('../autostart')
    setAutoStart(true)
    expect(fs.readFileSync(AUTOSTART, 'utf-8')).toContain('/tmp/axiom-test-exe')
  })
})
