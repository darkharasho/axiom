import type { AppId } from '@shared/types'

export const APP_ICONS: Record<AppId, string> = {
  axibridge: './svg/axibridge-glyph.svg',
  axiforge:  './svg/axiforge-glyph.svg',
  axipulse:  './svg/axipulse-glyph.svg',
  axiam:     './svg/axiam-glyph.svg',
  axivale:   './svg/axivale-glyph.svg',
  axiroster: './svg/axiroster-glyph.svg',
  axitools:  './svg/axitools-glyph.svg',
}

export const APP_NAMES: Record<AppId, string> = {
  axibridge: 'AxiBridge',
  axiforge:  'AxiForge',
  axipulse:  'AxiPulse',
  axiam:     'AxiAM',
  axivale:   'AxiVale',
  axiroster: 'AxiRoster',
  axitools:  'AxiTools',
}

export const APP_BLURBS: Record<AppId, string> = {
  axibridge: 'Watches your arcdps log folder and posts per-fight Discord embeds as fights happen, plus an aggregated stats view across all fights — so your squad can review performance without leaving the server.',
  axiforge:  'Build and comp manager for Guild Wars 2 squads. Create, edit, and publish builds and squad compositions to a GitHub Pages site you own and control — your data, your way.',
  axipulse:  'Parses your arcdps logs locally with Elite Insights and shows your personal combat breakdown — damage, timelines, and performance history — focused on how YOU performed, fight by fight.',
  axiam:     'A secure account launcher that stores encrypted GW2 credentials, manages multiple accounts, and launches them through Steam with custom arguments, all behind a master password.',
  axivale:   'An AI agent for GW2 squads that reads your fight reports and helps run your community — answering questions about performance and handling routine Discord chores — scoped per server and per account, with confirmation before anything destructive.',
  axiroster: 'WvW guild roster manager for Guild Wars 2 leadership. Pull your roster from the GW2 API and Discord, track who is active, and share a live audit log and retention history across your whole officer team — on desktop or in the browser.',
  axitools:  'A Discord bot for GW2 communities — build sharing, RSS feeds, patch note alerts, and scheduled squad signups, with per-guild isolated storage for complete privacy.',
}
