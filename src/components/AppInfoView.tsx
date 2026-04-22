import { ChevronLeft } from 'lucide-react'
import type { AppId } from '@shared/types'

interface Props {
  appId: AppId
  onBack: () => void
}

const APP_ICONS: Record<AppId, string> = {
  axibridge: './svg/AxiBridge-white.svg',
  axiforge:  './svg/axiforge.svg',
  axipulse:  './svg/axipulse-white.svg',
  axiam:     './svg/axiam.svg',
  axitools:  './svg/axitools-white.svg',
}

const APP_NAMES: Record<AppId, string> = {
  axibridge: 'AxiBridge',
  axiforge:  'AxiForge',
  axipulse:  'AxiPulse',
  axiam:     'AxiAM',
  axitools:  'AxiTools',
}

const APP_BLURBS: Record<AppId, string> = {
  axibridge: 'Watches your arcdps log folder and posts per-fight Discord embeds as fights happen, plus an aggregated stats view across all fights — so your squad can review performance without leaving the server.',
  axiforge:  'Build and comp manager for Guild Wars 2 squads. Create, edit, and publish builds and squad compositions to a GitHub Pages site you own and control — your data, your way.',
  axipulse:  'Parses your arcdps logs locally with Elite Insights and shows your personal combat breakdown — damage, timelines, and performance history — focused on how YOU performed, fight by fight.',
  axiam:     'A secure account launcher that stores encrypted GW2 credentials, manages multiple accounts, and launches them through Steam with custom arguments, all behind a master password.',
  axitools:  'A Discord bot for GW2 communities — build sharing, RSS feeds, patch note alerts, and scheduled squad signups, with per-guild isolated storage for complete privacy.',
}

export function AppInfoView({ appId, onBack }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: 'none',
            color: 'var(--text-dim)',
            padding: '2px 4px 2px 0',
            marginRight: 2,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          About
        </span>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '0 12px 24px',
      }}>
        <img
          src={APP_ICONS[appId]}
          alt={APP_NAMES[appId]}
          style={{ width: 64, height: 64, objectFit: 'contain' }}
        />
        <span style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text)',
          fontFamily: 'var(--font-title)',
          letterSpacing: '0.3px',
        }}>
          {APP_NAMES[appId]}
        </span>
        <p style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          textAlign: 'center',
          lineHeight: 1.7,
          margin: 0,
        }}>
          {APP_BLURBS[appId]}
        </p>
      </div>
    </div>
  )
}
