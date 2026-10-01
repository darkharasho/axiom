import { DEFAULT_ACCENT_ID, resolveAccentId } from './accents'

// Renderer-side rather than in the config store: the config answers
// asynchronously and appearance is renderer-only, so a synchronous read before
// first render is worth more than symmetry with the settings around it.
export const ACCENT_STORAGE_KEY = 'axiom.accent'
export const SURFACE_STORAGE_KEY = 'axiom.surface'

/**
 * The surfaces the design language paints. 'axi' is the language itself, drawn
 * with no `data-axi-theme` at all. 'flat' and 'glass' are repaints of it
 * shipped as `@axiapps/axi-design/themes/<id>.css`.
 */
export type SurfaceId = 'axi' | 'flat' | 'glass'

export const SURFACES: { id: SurfaceId; label: string }[] = [
  { id: 'axi', label: 'Axi' },
  { id: 'flat', label: 'Flat' },
  { id: 'glass', label: 'Glass' }
]

/** AxiOM has always been drawn in the language itself, so that stays the default. */
export const DEFAULT_SURFACE_ID: SurfaceId = 'axi'

let transitionTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Holds the crossfade class on <html> for the length of the transition so the
 * whole window changes together instead of each element snapping on its own
 * next repaint. Shared by the accent and the surface: changing both at once
 * should still be one fade, so the timer is deliberately not per-attribute.
 */
function crossfade(root: Element): void {
  root.classList.add('theme-transitioning')
  if (transitionTimer) clearTimeout(transitionTimer)
  transitionTimer = setTimeout(() => {
    root.classList.remove('theme-transitioning')
    transitionTimer = null
  }, 500)
}

export function readAccent(): string {
  try {
    return resolveAccentId(localStorage.getItem(ACCENT_STORAGE_KEY))
  } catch {
    return DEFAULT_ACCENT_ID
  }
}

/** Puts an accent on <html>, where accents.css's [data-axi-accent] rules hang,
 *  and remembers it. */
export function applyTheme(accentId?: string | null): string {
  const id = resolveAccentId(accentId)
  const root = document.documentElement

  crossfade(root)

  root.setAttribute('data-axi-accent', id)
  try {
    localStorage.setItem(ACCENT_STORAGE_KEY, id)
  } catch {
    // Storage disabled: the accent still applies for the life of the session,
    // only the memory of it is lost.
  }
  return id
}

/** Always returns one of the three ids. Membership is tested against the array
 *  rather than an object, so inherited property names are unknown values like
 *  any other. */
export function resolveSurfaceId(id?: string | null): SurfaceId {
  return SURFACES.some((s) => s.id === id) ? (id as SurfaceId) : DEFAULT_SURFACE_ID
}

export function readSurface(): SurfaceId {
  try {
    return resolveSurfaceId(localStorage.getItem(SURFACE_STORAGE_KEY))
  } catch {
    return DEFAULT_SURFACE_ID
  }
}

/**
 * Puts a surface on <html> and remembers it. 'axi' removes the attribute rather
 * than naming itself: the language is not a theme layered over itself, and
 * axi-design's own rule is that removing `data-axi-theme` leaves you back on it
 * with no other change.
 */
export function applySurface(surfaceId?: string | null): SurfaceId {
  const id = resolveSurfaceId(surfaceId)
  const root = document.documentElement

  crossfade(root)

  if (id === 'axi') root.removeAttribute('data-axi-theme')
  else root.setAttribute('data-axi-theme', id)

  try {
    localStorage.setItem(SURFACE_STORAGE_KEY, id)
  } catch {
    // Same bargain as the accent: applied now, just not remembered.
  }
  return id
}
