import React from 'react'
import { Play, Download, ArrowUp, ExternalLink, Loader2, HelpCircle } from 'lucide-react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { ProgressBar } from './ProgressBar'
import { GearLeverPrompt } from './GearLeverPrompt'

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

type ActionType = 'launch' | 'install' | 'update' | 'uninstall' | 'invite' | 'install-gear-lever' | 'open-gear-lever-flathub'

interface Props {
  state: AppState
  onAction: (action: ActionType, appId: AppId) => void
  onInfo: (appId: AppId) => void
}

export function AppRow({ state, onAction, onInfo }: Props) {
  const { id, installedVersion, latestVersion, downloadUrl, status, downloadProgress, gearLeverMissing } = state
  const isBusy = status === 'downloading' || status === 'installing' || status === 'deleting'
  const isLaunching = status === 'launching'
  const hasUpdate = installedVersion && latestVersion && installedVersion !== latestVersion
  const notInstalled = !installedVersion
  const hasUpdateBorder = !!hasUpdate

  const statusText = () => {
    if (status === 'checking') return 'Checking...'
    if (status === 'downloading') return 'Downloading...'
    if (status === 'installing') return 'Installing...'
    if (status === 'deleting') return 'Removing...'
    if (status === 'launching') return 'Launching...'
    if (status === 'error') return 'Error'
    if (id === 'axitools') return 'Discord Bot'
    if (notInstalled) return 'Not installed'
    if (hasUpdate) return `v${latestVersion} available`
    return `v${installedVersion} · up to date`
  }

  const statusColor = () => {
    if (status === 'error') return '#e05252'
    if (hasUpdate) return 'var(--gold-bright)'
    if (notInstalled) return 'var(--text-faint)'
    return 'var(--text-dim)'
  }

  const renderAction = () => {
    if (isBusy && downloadProgress) {
      return <ProgressBar progress={downloadProgress} />
    }
    if (gearLeverMissing) {
      return (
        <GearLeverPrompt
          appId={id as InstallableAppId}
          onInstall={() => onAction('install-gear-lever', id)}
          onOpenFlathub={() => onAction('open-gear-lever-flathub', id)}
        />
      )
    }
    if (isLaunching) {
      return <Loader2 size={16} className="spin" style={{ color: 'var(--gold)', flexShrink: 0 }} />
    }
    if (id === 'axitools') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onInfo(id)}
            title="Learn more"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HelpCircle size={14} />
          </button>
          <button onClick={() => onAction('invite', id)} style={btnStyle('invite')}>
            <ExternalLink size={11} />
            Invite
          </button>
        </div>
      )
    }
    if (hasUpdate) {
      return (
        <button onClick={() => onAction('update', id)} style={btnStyle('update')}>
          <ArrowUp size={11} />
          Update
        </button>
      )
    }
    if (notInstalled) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onInfo(id)}
            title="Learn more"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-faint)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HelpCircle size={14} />
          </button>
          {downloadUrl && (
            <button onClick={() => onAction('install', id)} style={btnStyle('install')}>
              <Download size={11} />
              Install
            </button>
          )}
        </div>
      )
    }
    if (installedVersion) {
      return (
        <button onClick={() => onAction('launch', id)} style={btnStyle('launch')}>
          <Play size={11} fill="currentColor" />
          Launch
        </button>
      )
    }
    return null
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 6px',
      borderRadius: 6,
      marginBottom: 3,
      background: 'var(--panel)',
      border: `1px solid ${hasUpdateBorder ? 'var(--gold-border-bright)' : 'var(--border)'}`,
    }}>
      <img
        src={APP_ICONS[id]}
        alt={APP_NAMES[id]}
        style={{
          width: 30,
          height: 30,
          objectFit: 'contain',
          flexShrink: 0,
          opacity: notInstalled && id !== 'axitools' ? 0.3 : 1,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: notInstalled && id !== 'axitools' ? 'var(--text-dim)' : 'var(--text)',
        }}>
          {APP_NAMES[id]}
        </div>
        <div style={{ fontSize: 10, color: statusColor(), marginTop: 1 }}>
          {statusText()}
        </div>
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {renderAction()}
      </div>
    </div>
  )
}

function btnStyle(variant: 'launch' | 'update' | 'install' | 'invite'): React.CSSProperties {
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
  }
  switch (variant) {
    case 'launch':  return { ...base, background: 'var(--gold)',        color: 'var(--bg)' }
    case 'update':  return { ...base, background: 'var(--gold-bright)', color: 'var(--bg)' }
    case 'install': return { ...base, background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', fontWeight: 400 }
    case 'invite':  return { ...base, background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold-border)' }
  }
}
