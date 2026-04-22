import { ChevronLeft, Download, ExternalLink, Play } from 'lucide-react'
import type { AppId } from '@shared/types'
import { APP_ICONS, APP_NAMES, APP_BLURBS } from '../lib/appMeta'

interface Props {
  appId: AppId
  onBack: () => void
  downloadUrl?: string
  onInstall?: () => void
  onLaunch?: () => void
  onInvite?: () => void
}

export function AppInfoView({ appId, onBack, downloadUrl, onInstall, onLaunch, onInvite }: Props) {
  return (
    <div className="view-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
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
          className="icon-btn"
          style={{
            background: 'none',
            color: 'var(--text-dim)',
            padding: '4px 8px 4px 2px',
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
      {(onLaunch || (downloadUrl && onInstall) || onInvite) && (
        <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {onLaunch && (
            <button
              className="btn-gold"
              onClick={onLaunch}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'var(--gold)',
                border: 'none',
                borderRadius: 4,
                color: 'var(--bg)',
                fontSize: 11,
                fontWeight: 700,
                padding: '7px 0',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <Play size={12} fill="currentColor" />
              Launch
            </button>
          )}
          {!onLaunch && downloadUrl && onInstall && (
            <button
              className="btn-gold"
              onClick={onInstall}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'var(--gold)',
                border: 'none',
                borderRadius: 4,
                color: 'var(--bg)',
                fontSize: 11,
                fontWeight: 700,
                padding: '7px 0',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <Download size={12} />
              Install
            </button>
          )}
          {onInvite && (
            <button
              onClick={onInvite}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                background: 'transparent',
                border: '1px solid var(--gold-border)',
                borderRadius: 4,
                color: 'var(--gold)',
                fontSize: 11,
                fontWeight: 700,
                padding: '7px 0',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <ExternalLink size={12} />
              Invite to Discord
            </button>
          )}
        </div>
      )}
    </div>
  )
}
