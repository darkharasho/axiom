import accentsJson from '@axiapps/axi-design/accents.json'

export type AccentDefinition = { id: string; label: string; hex: string }

/** The palette is the design language's, read from the package rather than
 *  restated here - a copy would drift the first time an accent is added. */
export const ACCENTS: AccentDefinition[] = accentsJson as AccentDefinition[]

/** AxiOM's own gold (#c89850) was hardcoded into globals.css at a specificity
 *  that tied the accent picker's own rule, so the picker changed the
 *  attribute but never the screen. That override is gone; this is the
 *  palette's nearest entry to the old house colour, and the one named
 *  constant that makes the default trivially changeable later. */
export const DEFAULT_ACCENT_ID = 'gold-bronze'

/** Always returns an id that exists in ACCENTS. AxiOM has never persisted an
 *  accent before this, so there is no legacy vocabulary to translate.
 *  Membership is tested against the array rather than an object lookup, so
 *  inherited property names like 'constructor' resolve to the default like
 *  any other unknown string. */
export function resolveAccentId(id?: string | null): string {
  return ACCENTS.some((a) => a.id === id) ? (id as string) : DEFAULT_ACCENT_ID
}
