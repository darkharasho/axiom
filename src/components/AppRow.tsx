import React, { useState, useRef, useEffect } from 'react'
import { Play, Download, ArrowUp, ExternalLink, Loader2, HelpCircle, RefreshCw, MoreHorizontal, Info, FolderOpen, Trash2, Maximize2 } from 'lucide-react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { APP_ICONS, APP_NAMES } from '../lib/appMeta'
import { ProgressBar } from './ProgressBar'
import { GearLeverPrompt } from './GearLeverPrompt'

type ActionType = 'launch' | 'install' | 'update' | 'uninstall' | 'invite' | 'install-gear-lever' | 'open-gear-lever-flathub' | 'browse-files'

interface Props {
  state: AppState
  onAction: (action: ActionType, appId: AppId) => void
  onInfo: (appId: AppId) => void
  onRetry: (appId: AppId) => void
}

export function AppRow({ state, onAction, onInfo, onRetry }: Props) {
  const { id, installedVersion, latestVersion, downloadUrl, status, downloadProgress, gearLeverMissing, isRunning } = state
  const isBusy = status === 'downloading' || status === 'installing' || status === 'deleting'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])
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
    if (isRunning) return `v${installedVersion} · running`
    return `v${installedVersion} · up to date`
  }

  const statusColor = () => {
    if (status === 'error') return '#e05252'
    if (hasUpdate) return 'var(--gold-bright)'
    if (isRunning) return '#6ab187'
    if (notInstalled && id !== 'axitools') return 'var(--text-faint)'
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
    if (status === 'error') {
      return (
        <button
          onClick={() => onRetry(id)}
          aria-label="Retry"
          title="Retry"
          style={{
            background: 'none',
            border: '1px solid rgba(224, 82, 82, 0.4)',
            borderRadius: 4,
            color: '#e05252',
            cursor: 'pointer',
            padding: '3px 8px',
            fontSize: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RefreshCw size={10} />
          Retry
        </button>
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
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HelpCircle size={15} />
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
        <button className="btn-gold" onClick={() => onAction('update', id)} style={btnStyle('update')}>
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
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <HelpCircle size={15} />
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
      return isRunning ? (
        <button className="btn-gold" onClick={() => onAction('launch', id)} style={btnStyle('focus')}>
          <Maximize2 size={11} />
          Focus
        </button>
      ) : (
        <button className="btn-gold" onClick={() => onAction('launch', id)} style={btnStyle('launch')}>
          <Play size={11} fill="currentColor" />
          Launch
        </button>
      )
    }
    return null
  }

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
        border: `1px solid ${
          status === 'error'   ? 'rgba(224, 82, 82, 0.35)' :
          hasUpdateBorder      ? 'var(--gold-border-bright)' :
          'var(--border)'
        }`,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--panel)')}
    >
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
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
        {installedVersion && id !== 'axitools' && !isBusy && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              className="icon-btn"
              onClick={() => setMenuOpen(o => !o)}
              style={{ background: 'none', border: 'none', color: 'var(--text-faint)', padding: '2px 3px', display: 'flex', alignItems: 'center', borderRadius: 4 }}
              title="More options"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                zIndex: 100,
                background: '#13141a',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '4px 0',
                minWidth: 160,
                boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
              }}>
                <DropdownItem icon={<Info size={12} />} onClick={() => { onInfo(id); setMenuOpen(false) }}>Info</DropdownItem>
                <DropdownItem icon={<FolderOpen size={12} />} onClick={() => { onAction('browse-files', id); setMenuOpen(false) }}>Browse local files</DropdownItem>
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                <DropdownItem icon={<Trash2 size={12} />} danger onClick={() => { onAction('uninstall', id); setMenuOpen(false) }}>Uninstall</DropdownItem>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'opacity 0.15s' }}>
        {renderAction()}
      </div>
    </div>
  )
}

function DropdownItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        background: hovered ? 'rgba(255,255,255,0.05)' : 'none',
        border: 'none',
        color: danger ? (hovered ? '#e05252' : '#b05050') : 'var(--text-light)',
        fontSize: 11,
        padding: '6px 12px',
        cursor: 'pointer',
        textAlign: 'left',
        boxShadow: 'none',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

function btnStyle(variant: 'launch' | 'focus' | 'update' | 'install' | 'invite'): React.CSSProperties {
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
    case 'focus':   return { ...base, background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold-border)' }
    case 'update':  return { ...base, background: 'var(--gold-bright)', color: 'var(--bg)' }
    case 'install': return { ...base, background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-light)', border: '1px solid var(--border)', fontWeight: 400 }
    case 'invite':  return { ...base, background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold-border)' }
  }
}
