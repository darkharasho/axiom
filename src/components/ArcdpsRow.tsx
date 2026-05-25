import { Download, ArrowUp } from 'lucide-react'
import type { ArcdpsPluginState } from '@shared/types'
import { ProgressBar } from './ProgressBar'

interface Props {
  plugin: ArcdpsPluginState
  onInstall: (id: string) => void
}

export function ArcdpsRow({ plugin, onInstall }: Props) {
  const { id, name, description, installed, installedDir, installedTag, latestTag, upToDate, downloadUrl, status, errorMessage, downloadProgress } = plugin

  const isBusy = status === 'downloading' || status === 'installing'
  const isDisabled = isBusy || (installed && upToDate === true) || !downloadUrl

  const statusText = () => {
    if (!installed) return 'Not installed'
    if (upToDate === true) return 'Up to date'
    if (upToDate === false) return 'Update available'
    return 'Unknown'
  }

  const statusColor = () => {
    if (errorMessage) return '#e05252'
    if (!installed) return 'var(--text-faint)'
    if (upToDate === false) return 'var(--gold-bright)'
    if (upToDate === true) return 'var(--text-dim)'
    return 'var(--text-dim)'
  }

  const buttonLabel = () => {
    if (!installed) return 'Install'
    if (upToDate === false) return 'Update'
    if (upToDate === null) return 'Update to latest'
    return 'Up to date'
  }

  const hasUpdate = installed && upToDate === false
  const hasBorder = hasUpdate
    ? 'var(--gold-border-bright)'
    : errorMessage
    ? 'rgba(224, 82, 82, 0.35)'
    : 'var(--border)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 6px',
        borderRadius: 6,
        marginBottom: 3,
        background: 'var(--panel)',
        border: `1px solid ${hasBorder}`,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--panel)')}
    >
      {/* Name + status */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: installed ? 'var(--text)' : 'var(--text-dim)',
        }}>
          {name}
        </div>
        {description && (
          <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1, lineHeight: 1.35 }}>
            {description}
          </div>
        )}
        <div style={{ fontSize: 10, color: statusColor(), marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{statusText()}</span>
          {installed && installedDir != null && (
            <span style={{ color: 'var(--text-faint)' }}>
              in: {installedDir === '' ? '<GW2 root>' : installedDir + '/'}
            </span>
          )}
          {installedTag && (
            <span style={{ color: 'var(--text-faint)' }}>installed: {installedTag}</span>
          )}
          {latestTag && (
            <span style={{ color: 'var(--text-faint)' }}>latest: {latestTag}</span>
          )}
        </div>
        {errorMessage && (
          <div style={{ fontSize: 10, color: '#e05252', marginTop: 2 }}>{errorMessage}</div>
        )}
      </div>

      {/* Action area */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {isBusy && downloadProgress ? (
          <ProgressBar progress={downloadProgress} />
        ) : (
          <button
            onClick={() => onInstall(id)}
            disabled={isDisabled}
            className={hasUpdate ? 'btn-gold' : undefined}
            style={btnStyle(hasUpdate ? 'update' : installed ? 'disabled' : 'install', isDisabled)}
          >
            {!installed && <Download size={11} />}
            {hasUpdate && <ArrowUp size={11} />}
            {buttonLabel()}
          </button>
        )}
      </div>
    </div>
  )
}

function btnStyle(variant: 'install' | 'update' | 'disabled', disabled: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    borderRadius: 4,
    padding: '4px 10px',
    fontSize: 10,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled && variant !== 'disabled' ? 0.5 : 1,
  }
  switch (variant) {
    case 'update':   return { ...base, background: 'var(--gold-bright)', color: 'var(--bg)' }
    case 'install':  return { ...base, background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', fontWeight: 400 }
    case 'disabled': return { ...base, background: 'transparent', color: 'var(--text-faint)', border: '1px solid var(--border)', fontWeight: 400, opacity: 0.5 }
  }
}
