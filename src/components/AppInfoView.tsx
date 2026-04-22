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
  axibridge: 'Connect your Axiom workspace to Discord, Slack, and more. Keep your team in sync across every platform.',
  axiforge:  'A powerful desktop toolkit for building and managing Axiom workflows. Forge your automation, your way.',
  axipulse:  'Real-time monitoring and alerting for your Axiom environment. Stay on top of every event as it happens.',
  axiam:     'Account and identity management for the Axiom ecosystem. Control access and permissions from one place.',
  axitools:  'A Discord bot packed with Axiom utilities. Bring your community and your data together.',
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
