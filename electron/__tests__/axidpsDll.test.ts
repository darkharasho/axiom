import { describe, it, expect } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isAxidpsDll, axidpsInstalled } from '../axidpsDll'

function tmp(): string { return fs.mkdtempSync(path.join(os.tmpdir(), 'axidps-')) }

describe('isAxidpsDll', () => {
  it('is true when the file carries the version marker', () => {
    const d = tmp()
    const f = path.join(d, 'd3d11.dll')
    fs.writeFileSync(f, Buffer.concat([Buffer.from('MZ junk'), Buffer.from('axidps-dll-version=0.4.0\0'), Buffer.from('tail')]))
    expect(isAxidpsDll(f)).toBe(true)
  })
  it('is false for other files and missing files', () => {
    const d = tmp()
    const f = path.join(d, 'd3d11.dll')
    fs.writeFileSync(f, 'arcdps or nexus loader')
    expect(isAxidpsDll(f)).toBe(false)
    expect(isAxidpsDll(path.join(d, 'nope.dll'))).toBe(false)
  })
})

describe('axidpsInstalled', () => {
  it('checks <gw2>/d3d11.dll', () => {
    const gw2 = tmp()
    expect(axidpsInstalled(gw2)).toBe(false)
    fs.writeFileSync(path.join(gw2, 'd3d11.dll'), 'axidps-dll-version=1.0.0\0')
    expect(axidpsInstalled(gw2)).toBe(true)
  })
})
