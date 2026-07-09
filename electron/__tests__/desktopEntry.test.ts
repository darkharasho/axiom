import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { findInstalledAppImage, parseVersionFromName } from '../desktopEntry'

let tmp: string
const touch = (dir: string, name: string, mtimeMs?: number) => {
  const p = path.join(dir, name)
  fs.writeFileSync(p, 'x')
  if (mtimeMs != null) fs.utimesSync(p, new Date(mtimeMs), new Date(mtimeMs))
  return p
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axiom-desktopentry-'))
})
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

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
