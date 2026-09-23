import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { Play, Download, ArrowUp, ExternalLink, Loader2, HelpCircle, RefreshCw, MoreHorizontal, Info, FolderOpen, Trash2, Maximize2 } from 'lucide-react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { INSTALLED_VERSION_UNKNOWN, appHasUpdate } from '@shared/types'
import { APP_ICONS, APP_NAMES } from '../lib/appMeta'
import { ProgressBar } from './ProgressBar'
import { GearLeverPrompt } from './GearLeverPrompt'

// The popover's own gap from its trigger, tighter than the language's 9px
// because the rows it opens between are 8px apart.
const MENU_GAP = 5

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
  const [dropUp, setDropUp] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])
  // The list scrolls inside a box with a hard edge, so a menu opened from one
  // of the last rows would be cut off by it. Measure the room under the
  // trigger before the browser paints and hang the popover above it instead
  // when there isn't enough. Layout effect, not effect: at open time the
  // popover is already in the DOM and this has to settle before it is seen.
  useLayoutEffect(() => {
    if (!menuOpen) { setDropUp(false); return }
    const trigger = menuRef.current
    const pop = popRef.current
    const scroller = trigger?.closest('.ax-scroll')
    if (!trigger || !pop || !scroller) return
    const room = scroller.getBoundingClientRect().bottom - trigger.getBoundingClientRect().bottom - MENU_GAP
    setDropUp(pop.offsetHeight > room)
  }, [menuOpen])

  const isLaunching = status === 'launching'
  // The version is only meaningful for comparison when we actually know it; a
  // manually-installed app reports the unknown-version sentinel instead.
  const versionKnown = !!installedVersion && installedVersion !== INSTALLED_VERSION_UNKNOWN
  const hasUpdate = appHasUpdate(installedVersion, latestVersion)
  const notInstalled = !installedVersion

  const statusText = () => {
    if (status === 'checking') return 'Checking…'
    if (status === 'downloading') return 'Downloading…'
    if (status === 'installing') return 'Installing…'
    if (status === 'deleting') return 'Removing…'
    if (status === 'launching') return 'Launching…'
    if (status === 'error') return 'Error'
    if (id === 'axitools') return 'Discord Bot'
    if (notInstalled) return 'Not installed'
    if (hasUpdate) return `v${latestVersion} available`
    if (isRunning) return versionKnown ? `v${installedVersion} · running` : 'Running'
    return versionKnown ? `v${installedVersion} · up to date` : 'Installed'
  }

  // The status ink, and only where there is a real status to assert. Rule 5:
  // "not installed" and "up to date" are facts about the row, not verdicts, so
  // they stay on the neutral ramp.
  const statusClass = () => {
    if (status === 'error') return 'ax-ink-danger'
    if (hasUpdate) return 'ax-ink-accent'
    if (isRunning) return 'ax-ink-ok'
    return ''
  }

  // The same verdicts statusClass() draws in the note, drawn again as the ink
  // of the icon tile. Only a real status gets an ink: "not installed" and "up
  // to date" are facts about the row, so they keep the neutral tile rather
  // than losing one, which is what keeps the column of shapes unbroken.
  const tileClass = () => {
    if (status === 'error') return 'ax-tile--danger'
    if (hasUpdate) return 'ax-tile--accent'
    if (isRunning) return 'ax-tile--ok'
    return ''
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
          className="axi-btn ax-sm ax-ink-danger"
          style={{ borderColor: 'var(--axi-danger)' }}
          onClick={() => onRetry(id)}
          aria-label="Retry"
          title="Retry"
        >
          <RefreshCw size={10} />
          Retry
        </button>
      )
    }
    if (isLaunching) {
      return <Loader2 size={16} className="spin ax-ink-accent" style={{ flexShrink: 0 }} />
    }
    if (id === 'axitools') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button className="ax-icon" onClick={() => onInfo(id)} title="Learn more" aria-label="Learn more">
            <HelpCircle size={14} />
          </button>
          <button className="axi-btn ax-sm" onClick={() => onAction('invite', id)}>
            <ExternalLink size={10} />
            Invite
          </button>
        </div>
      )
    }
    // The one filled control in the row, because it is the one that is urgent.
    if (hasUpdate) {
      return (
        <button className="axi-btn axi-btn--primary ax-sm" onClick={() => onAction('update', id)}>
          <ArrowUp size={10} />
          Update
        </button>
      )
    }
    if (notInstalled) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <button className="ax-icon" onClick={() => onInfo(id)} title="Learn more" aria-label="Learn more">
            <HelpCircle size={14} />
          </button>
          {downloadUrl && (
            <button className="axi-btn ax-sm" onClick={() => onAction('install', id)}>
              <Download size={10} />
              Install
            </button>
          )}
        </div>
      )
    }
    if (installedVersion) {
      return isRunning ? (
        <button className="axi-btn ax-sm" onClick={() => onAction('launch', id)}>
          <Maximize2 size={10} />
          Focus
        </button>
      ) : (
        <button className="axi-btn ax-sm" onClick={() => onAction('launch', id)}>
          <Play size={10} fill="currentColor" />
          Launch
        </button>
      )
    }
    return null
  }

  const quiet = notInstalled && id !== 'axitools'

  return (
    <div className={`ax-item ax-item--card${quiet ? ' ax-item--off' : ''}${menuOpen ? ' ax-item--menu' : ''}`}>
      <span className={`ax-tile ${tileClass()}`}>
        <img className="ax-item__icon" src={APP_ICONS[id]} alt={APP_NAMES[id]} />
      </span>

      <div className="ax-item__main">
        <div className="ax-item__name">{APP_NAMES[id]}</div>
        <div className={`ax-item__note ${statusClass()}`}>{statusText()}</div>
      </div>

      {installedVersion && id !== 'axitools' && !isBusy && (
        <div className="axi-menu" ref={menuRef} style={{ flexShrink: 0 }}>
          <button
            className="ax-icon"
            onClick={() => setMenuOpen(o => !o)}
            aria-expanded={menuOpen}
            title="More options"
            aria-label="More options"
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen && (
            <div className="axi-menu__pop" ref={popRef} /* Opens leftward: the trigger sits a few px from the window's right edge,
                 and the language's default left: 0 would put 190px of popover outside
                 a window that cannot be resized to reveal it. */
              style={{
                '--axi-menu-width': '190px',
                left: 'auto', right: 0, padding: 5,
                top: dropUp ? 'auto' : `calc(100% + ${MENU_GAP}px)`,
                bottom: dropUp ? `calc(100% + ${MENU_GAP}px)` : 'auto',
              } as React.CSSProperties}>
              <MenuItem icon={<Info size={12} />} onClick={() => { onInfo(id); setMenuOpen(false) }}>Info</MenuItem>
              <MenuItem icon={<FolderOpen size={12} />} onClick={() => { onAction('browse-files', id); setMenuOpen(false) }}>Browse local files</MenuItem>
              <MenuItem icon={<Trash2 size={12} />} danger onClick={() => { onAction('uninstall', id); setMenuOpen(false) }}>Uninstall</MenuItem>
            </div>
          )}
        </div>
      )}

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {renderAction()}
      </div>
    </div>
  )
}

function MenuItem({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button className={`ax-menu-item${danger ? ' ax-menu-item--danger' : ''}`} onClick={onClick}>
      {icon}
      {children}
    </button>
  )
}
