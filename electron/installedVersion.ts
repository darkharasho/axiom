import { INSTALLED_VERSION_UNKNOWN } from './shared/types'

/**
 * Reconcile what we detected on disk with what AxiOM previously recorded.
 *
 * - A concrete detected version always wins (and should be persisted by the caller).
 * - When detection can only tell us the app is installed (the version was not in the
 *   filename), prefer the version AxiOM recorded at install time, but if there is none
 *   (a manual install) fall back to the unknown-version sentinel so the app still reads
 *   as installed rather than collapsing to `null` / "not installed".
 */
export function resolveInstalledVersion(detected: string | null, stored: string | null): string | null {
  if (detected === INSTALLED_VERSION_UNKNOWN) return stored ?? INSTALLED_VERSION_UNKNOWN
  return detected
}
