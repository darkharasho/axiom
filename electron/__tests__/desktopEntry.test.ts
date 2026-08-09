import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  findInstalledAppImage,
  parseVersionFromName,
  refreshOrphanedDesktopEntries,
  writeLinuxDesktopEntry,
} from '../desktopEntry'

let tmp: string
const touch = (dir: string, name: string, mtimeMs?: number) => {
  const p = path.join(dir, name)
  fs.writeFileSync(p, 'x')
  if (mtimeMs != null) fs.utimesSync(p, new Date(mtimeMs), new Date(mtimeMs))
  return p
}

const ORIGINAL_HOME = process.env.HOME

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-desktopentry-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
  process.env.HOME = ORIGINAL_HOME
})

const entryPath = (appId: string) =>
  path.join(tmp, '.local', 'share', 'applications', `${appId}.desktop`)

describe('parseVersionFromName', () => {
  it('extracts a dotted version tuple', () => {
    expect(parseVersionFromName('AxiBridge-2.13.5.AppImage')).toEqual([2, 13, 5])
  })
  it('returns null when the filename carries no version', () => {
    expect(parseVersionFromName('axiam.AppImage')).toBeNull()
  })
})

describe('findInstalledAppImage', () => {
  it('picks the newest version when several matching AppImages coexist', () => {
    touch(tmp, 'AxiBridge-2.5.9.AppImage')
    touch(tmp, 'AxiBridge-2.13.5.AppImage')
    touch(tmp, 'AxiBridge-2.5.12.AppImage')
    // Not numeric-string sortable ("2.13.5" < "2.5.9" lexically) — must compare numerically.
    expect(findInstalledAppImage('AxiBridge', [tmp])).toBe(path.join(tmp, 'AxiBridge-2.13.5.AppImage'))
  })

  it('ignores non-matching and non-AppImage files', () => {
    touch(tmp, 'AxiForge-1.0.0.AppImage')
    touch(tmp, 'AxiBridge-1.2.3.txt')
    touch(tmp, 'AxiBridge-2.0.0.AppImage')
    expect(findInstalledAppImage('AxiBridge', [tmp])).toBe(path.join(tmp, 'AxiBridge-2.0.0.AppImage'))
  })

  it('falls back to newest mtime when versions are absent', () => {
    touch(tmp, 'axiam-old.AppImage', 1_000_000)
    touch(tmp, 'axiam-new.AppImage', 9_000_000)
    expect(findInstalledAppImage('axiam', [tmp])).toBe(path.join(tmp, 'axiam-new.AppImage'))
  })

  it('returns null when nothing matches', () => {
    touch(tmp, 'Something.AppImage')
    expect(findInstalledAppImage('AxiBridge', [tmp])).toBeNull()
  })

  it('searches multiple directories and picks the global newest', () => {
    const a = path.join(tmp, 'a'); const b = path.join(tmp, 'b')
    fs.mkdirSync(a); fs.mkdirSync(b)
    touch(a, 'AxiBridge-2.13.4.AppImage')
    touch(b, 'AxiBridge-2.13.5.AppImage')
    expect(findInstalledAppImage('AxiBridge', [a, b])).toBe(path.join(b, 'AxiBridge-2.13.5.AppImage'))
  })
})

describe('writeLinuxDesktopEntry', () => {
  // AxiBridge calls app.setAsDefaultProtocolClient('axibridge'), which xdg
  // resolves through this desktop entry. Omitting the line silently dropped the
  // axibridge:// registration every time either writer refreshed the file.
  it('declares the scheme handler for an app that registers one', () => {
    process.env.HOME = tmp
    writeLinuxDesktopEntry('axibridge', 'AxiBridge', '/apps/AxiBridge-2.18.0.AppImage')
    expect(fs.readFileSync(entryPath('axibridge'), 'utf8'))
      .toContain('MimeType=x-scheme-handler/axibridge;')
  })

  it('emits no MimeType line for an app with no scheme handler', () => {
    process.env.HOME = tmp
    writeLinuxDesktopEntry('axiforge', 'AxiForge', '/apps/AxiForge-1.0.0.AppImage')
    expect(fs.readFileSync(entryPath('axiforge'), 'utf8')).not.toContain('MimeType=')
  })

  it('reports no change when the entry already matches', () => {
    process.env.HOME = tmp
    expect(writeLinuxDesktopEntry('axibridge', 'AxiBridge', '/apps/AxiBridge-2.18.0.AppImage')).toBe(true)
    expect(writeLinuxDesktopEntry('axibridge', 'AxiBridge', '/apps/AxiBridge-2.18.0.AppImage')).toBe(false)
  })
})

describe('refreshOrphanedDesktopEntries', () => {
  const seedAppImage = () => {
    const dir = path.join(tmp, 'AppImages')
    fs.mkdirSync(dir, { recursive: true })
    return touch(dir, 'AxiBridge-2.18.0.AppImage')
  }

  // Regression: the old TryExec-only staleness check treated an entry whose
  // Exec pointed at the right file as healthy, so content drift (a dropped
  // MimeType, a name written by AxiBridge's own writer) was never repaired.
  it('repairs content drift even when TryExec already points at the right file', () => {
    process.env.HOME = tmp
    const installed = seedAppImage()
    fs.mkdirSync(path.dirname(entryPath('axibridge')), { recursive: true })
    fs.writeFileSync(
      entryPath('axibridge'),
      `[Desktop Entry]\nType=Application\nName=axibridge\nIcon=axibridge\nTryExec=${installed}\nExec=env DESKTOPINTEGRATION=1 ${installed} --no-sandbox %U\nTerminal=false\nCategories=Utility;\nStartupWMClass=axibridge\nX-AppImage-Name=axibridge\n`,
    )

    refreshOrphanedDesktopEntries([{ id: 'axibridge', name: 'AxiBridge' }])

    const content = fs.readFileSync(entryPath('axibridge'), 'utf8')
    expect(content).toContain('Name=AxiBridge')
    expect(content).toContain('MimeType=x-scheme-handler/axibridge;')
  })

  it('leaves apps with no entry file alone', () => {
    process.env.HOME = tmp
    seedAppImage()
    refreshOrphanedDesktopEntries([{ id: 'axibridge', name: 'AxiBridge' }])
    expect(fs.existsSync(entryPath('axibridge'))).toBe(false)
  })
})
