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
  const hasAction = !!(onLaunch || (downloadUrl && onInstall) || onInvite)

  return (
    <div className="view-enter ax-view">
      <div className="ax-head">
        <button className="ax-icon" onClick={onBack} aria-label="Back">
          <ChevronLeft size={16} />
        </button>
        <span className="ax-title">About</span>
      </div>

      <div
        className="ax-scroll"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 14px' }}
      >
        <img src={APP_ICONS[appId]} alt="" aria-hidden style={{ width: 64, height: 64, objectFit: 'contain' }} />
        <h2 style={{ margin: 0, font: 'var(--axi-t-h3)', letterSpacing: 'var(--axi-ls-h3)', color: 'var(--axi-text)' }}>
          {APP_NAMES[appId]}
        </h2>
        <p style={{ margin: 0, font: 'var(--axi-t-small)', color: 'var(--axi-text-dim)', textAlign: 'center' }}>
          {APP_BLURBS[appId]}
        </p>
      </div>

      {hasAction && (
        <div className="ax-foot" style={{ justifyContent: 'stretch' }}>
          {onLaunch && (
            <button className="axi-btn axi-btn--primary ax-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onLaunch}>
              <Play size={11} fill="currentColor" />
              Launch
            </button>
          )}
          {!onLaunch && downloadUrl && onInstall && (
            <button className="axi-btn axi-btn--primary ax-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onInstall}>
              <Download size={11} />
              Install
            </button>
          )}
          {onInvite && (
            <button className="axi-btn ax-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={onInvite}>
              <ExternalLink size={11} />
              Invite to Discord
            </button>
          )}
        </div>
      )}
    </div>
  )
}
