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
  axibridge: 'Watches your arcdps log folder, uploads fight logs, and posts polished combat summaries to Discord — so your WvW squad can review performance and MVPs without leaving the server.',
  axiforge:  'Create, edit, and publish Guild Wars 2 builds with a native desktop editor, then automatically sync your build library to a GitHub Pages site your team can browse anytime.',
  axipulse:  'Parses arcdps logs locally with Elite Insights and shows per-fight combat analysis — damage, timelines, squad positioning, and performance history — on your second monitor while still in squad.',
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
