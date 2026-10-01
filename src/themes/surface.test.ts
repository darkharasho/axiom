import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  ACCENT_STORAGE_KEY,
  SURFACE_STORAGE_KEY,
  SURFACES,
  DEFAULT_SURFACE_ID,
  resolveSurfaceId,
  readAccent,
  readSurface,
  applyTheme,
  applySurface
} from './applyTheme'
import { DEFAULT_ACCENT_ID } from './accents'

// jsdom gives a real <html> and a real localStorage, so nothing is stubbed.
beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-axi-accent')
  document.documentElement.removeAttribute('data-axi-theme')
  document.documentElement.classList.remove('theme-transitioning')
})

describe('resolveSurfaceId', () => {
  it('defaults to the language itself', () => {
    expect(DEFAULT_SURFACE_ID).toBe('axi')
    expect(resolveSurfaceId(null)).toBe('axi')
    expect(resolveSurfaceId(undefined)).toBe('axi')
  })

  it('passes through the ids the design language defines', () => {
    expect(SURFACES.map((s) => s.id)).toEqual(['axi', 'flat', 'glass'])
    expect(SURFACES.map((s) => s.label)).toEqual(['Axi', 'Flat', 'Glass'])
    expect(resolveSurfaceId('axi')).toBe('axi')
    expect(resolveSurfaceId('flat')).toBe('flat')
    expect(resolveSurfaceId('glass')).toBe('glass')
  })

  it('falls back to axi for anything else, including inherited property names', () => {
    expect(resolveSurfaceId('frosted')).toBe('axi')
    expect(resolveSurfaceId('')).toBe('axi')
    expect(resolveSurfaceId('constructor')).toBe('axi')
    expect(resolveSurfaceId('__proto__')).toBe('axi')
    expect(resolveSurfaceId('toString')).toBe('axi')
  })
})

describe('readSurface and readAccent', () => {
  it('are the defaults when nothing has been stored', () => {
    expect(readSurface()).toBe('axi')
    expect(readAccent()).toBe(DEFAULT_ACCENT_ID)
  })

  it('read back what was stored', () => {
    localStorage.setItem(SURFACE_STORAGE_KEY, 'glass')
    localStorage.setItem(ACCENT_STORAGE_KEY, 'electric-cyan')
    expect(readSurface()).toBe('glass')
    expect(readAccent()).toBe('electric-cyan')
  })

  it('are the defaults when storage holds a value they do not recognise', () => {
    localStorage.setItem(SURFACE_STORAGE_KEY, 'frosted')
    localStorage.setItem(ACCENT_STORAGE_KEY, 'ultraviolet')
    expect(readSurface()).toBe('axi')
    expect(readAccent()).toBe(DEFAULT_ACCENT_ID)
  })

  // Review Focus 1
  it('are the defaults when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(readSurface()).toBe('axi')
    expect(readAccent()).toBe(DEFAULT_ACCENT_ID)
    vi.restoreAllMocks()
  })
})

describe('applySurface', () => {
  it('puts a theme on <html> and remembers it', () => {
    expect(applySurface('glass')).toBe('glass')
    expect(document.documentElement.getAttribute('data-axi-theme')).toBe('glass')
    expect(localStorage.getItem(SURFACE_STORAGE_KEY)).toBe('glass')
  })

  it('treats flat as a theme like any other', () => {
    expect(applySurface('flat')).toBe('flat')
    expect(document.documentElement.getAttribute('data-axi-theme')).toBe('flat')
  })

  it('removes the attribute for axi rather than naming the language', () => {
    applySurface('glass')
    expect(applySurface('axi')).toBe('axi')
    expect(document.documentElement.hasAttribute('data-axi-theme')).toBe(false)
    expect(localStorage.getItem(SURFACE_STORAGE_KEY)).toBe('axi')
  })

  // Review Focus 1
  it('still applies the surface when storage refuses the write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    expect(applySurface('glass')).toBe('glass')
    expect(document.documentElement.getAttribute('data-axi-theme')).toBe('glass')
    vi.restoreAllMocks()
  })
})

describe('applyTheme', () => {
  it('puts an accent on <html> and remembers it', () => {
    expect(applyTheme('electric-cyan')).toBe('electric-cyan')
    expect(document.documentElement.getAttribute('data-axi-accent')).toBe('electric-cyan')
    expect(localStorage.getItem(ACCENT_STORAGE_KEY)).toBe('electric-cyan')
  })

  it('falls back to the default for an accent it does not know', () => {
    expect(applyTheme('ultraviolet')).toBe(DEFAULT_ACCENT_ID)
    expect(document.documentElement.getAttribute('data-axi-accent')).toBe(DEFAULT_ACCENT_ID)
  })
})

describe('the shared crossfade', () => {
  it('holds the class for the length of the transition', () => {
    vi.useFakeTimers()
    applySurface('glass')
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true)
    vi.advanceTimersByTime(500)
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false)
    vi.useRealTimers()
  })

  // Review Focus 2 — a second change inside the window must restart the timer,
  // not let the first one strip the class mid-fade.
  it('restarts the timer when a second surface is chosen inside the window', () => {
    vi.useFakeTimers()
    applySurface('glass')
    vi.advanceTimersByTime(400)
    applySurface('flat')
    vi.advanceTimersByTime(200)
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true)
    vi.advanceTimersByTime(350)
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false)
    vi.useRealTimers()
  })

  // Review Focus 3 — the accent and the surface share one timer, so changing
  // both is one fade rather than two overlapping ones.
  it('is shared between the accent and the surface', () => {
    vi.useFakeTimers()
    applyTheme('electric-cyan')
    vi.advanceTimersByTime(300)
    applySurface('glass')
    vi.advanceTimersByTime(300)
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(true)
    vi.advanceTimersByTime(250)
    expect(document.documentElement.classList.contains('theme-transitioning')).toBe(false)
    vi.useRealTimers()
  })
})

// Review Focus 4
describe('the crossfade stylesheet', () => {
  it('transitions on the class and turns itself off under reduced motion', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    // Not `new URL('../styles/globals.css', import.meta.url)`: the
    // @vitejs/plugin-react transform statically rewrites that literal pattern
    // into an asset URL (http://localhost:3000/...) even under `vitest run`,
    // which readFileSync then rejects as not a file:// URL. Resolving this
    // test file's own path first and joining from there sidesteps the
    // asset-URL rewrite.
    const here = fileURLToPath(import.meta.url)
    const cssPath = new URL('../styles/globals.css', `file://${here}`)
    const css = readFileSync(cssPath, 'utf8')
    expect(css).toMatch(/\.theme-transitioning \*/)
    const reduced = css.slice(css.indexOf('prefers-reduced-motion: reduce'))
    expect(reduced).toMatch(/\.theme-transitioning \*[\s\S]*transition: none/)
  })
})
