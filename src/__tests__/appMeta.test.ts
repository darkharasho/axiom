import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { APP_ICONS, APP_NAMES } from '../lib/appMeta'

const GLYPH = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="242 242 540 540" width="540" height="540"><g transform="translate(242 242) scale(2.1094)"><path d="M216,56v56c0,96-88,120-88,120S40,208,40,112V56a8,8,0,0,1,8-8H208A8,8,0,0,1,216,56Z"  fill="#ffc53d" opacity="0.45"/><path fill="#e4e3dc" d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z"/></g></svg>'

describe('axiadmin glyph', () => {
  it('is wired into the app icon map', () => {
    expect(APP_ICONS.axiadmin).toBe('./svg/axiadmin-glyph.svg')
    expect(APP_NAMES.axiadmin).toBe('AxiAdmin')
  })

  it('ships the exact glyph in the app and the marketing assets', () => {
    const root = process.cwd()
    expect(readFileSync(path.join(root, 'public/svg/axiadmin-glyph.svg'), 'utf8')).toBe(GLYPH)
    expect(readFileSync(path.join(root, 'marketing/assets/axiadmin-glyph.svg'), 'utf8')).toBe(GLYPH)
  })
})
