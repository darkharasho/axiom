import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useConfig } from '../hooks/useConfig'
import { Toggle } from './Toggle'

interface Props {
  onBack: () => void
}

type SelfUpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'ready' | 'error'

let _cachedVersion = ''

export function SettingsView({ onBack }: Props) {
  const { config, updateConfig } = useConfig()
  const [version, setVersion] = useState(_cachedVersion)
  const [selfUpdate, setSelfUpdate] = useState<{ status: SelfUpdateStatus; version?: string; error?: string }>({ status: 'idle' })

  useEffect(() => {
    window.axiom.getVersion().then(v => { _cachedVersion = v; setVersion(v) })
    const unsub = window.axiom.onSelfUpdateStatus(data => setSelfUpdate(data as { status: SelfUpdateStatus; version?: string; error?: string }))
    return unsub
  }, [])

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  }

  const label: React.CSSProperties = { color: 'var(--text-light)', fontSize: 12 }

  return (
    <div className="view-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
      {/* Header */}
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
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: 'var(--text)' }}>Settings</span>
        </span>
      </div>

      {/* Auto-start */}
      <div style={row}>
        <span style={label}>Auto-start on login</span>
        <Toggle
          id="auto-start"
          checked={config.autoStart}
          onChange={enabled => {
            updateConfig({ autoStart: enabled })
            window.axiom.setAutoStart(enabled)
          }}
        />
      </div>

      {/* Update notifications */}
      <div style={row}>
        <span style={label}>Notify on updates</span>
        <Toggle
          id="notify-updates"
          checked={config.notifyOnUpdates ?? false}
          onChange={checked => updateConfig({ notifyOnUpdates: checked })}
        />
      </div>

      {/* AxiOM self-update */}
      <div style={{ ...row, borderBottom: 'none', paddingBottom: 0 }}>
        <span style={label}>AxiOM updates</span>
        {selfUpdate.status === 'ready' ? (
          <button
            onClick={() => window.axiom.installSelfUpdate()}
            style={{
              background: 'var(--gold)',
              border: 'none',
              borderRadius: 4,
              color: 'var(--bg)',
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 10px',
              cursor: 'pointer',
            }}
          >
            Restart & update
          </button>
        ) : (
          <button
            onClick={() => window.axiom.checkSelfUpdate()}
            disabled={selfUpdate.status === 'checking' || selfUpdate.status === 'downloading'}
            style={{
              background: 'none',
              border: 'none',
              color: selfUpdate.status === 'available' ? 'var(--gold-bright)'
                   : selfUpdate.status === 'not-available' ? 'var(--text-dim)'
                   : selfUpdate.status === 'error' ? '#e05252'
                   : selfUpdate.status === 'downloading' ? 'var(--text-dim)'
                   : 'var(--text-light)',
              fontSize: 11,
              cursor: selfUpdate.status === 'checking' || selfUpdate.status === 'downloading' ? 'default' : 'pointer',
              padding: 0,
            }}
          >
            {selfUpdate.status === 'checking'     ? 'Checking...'
           : selfUpdate.status === 'downloading'  ? 'Downloading...'
           : selfUpdate.status === 'available'    ? `v${selfUpdate.version} available`
           : selfUpdate.status === 'not-available'? 'Up to date'
           : selfUpdate.status === 'error'        ? 'Error — retry'
           : 'Check for updates'}
          </button>
        )}
      </div>

      {/* Version + links */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>AxiOM v{version}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => window.axiom.openExternal('https://github.com/darkharasho/axiom')}
            className="icon-btn"
            title="GitHub"
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', padding: '3px 5px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
          </button>
          <button
            onClick={() => window.axiom.openExternal('https://discord.gg/UjzMXMGXEg')}
            className="icon-btn"
            title="Discord"
            style={{ background: 'none', border: 'none', color: 'var(--text-faint)', padding: '3px 5px', display: 'flex', alignItems: 'center', cursor: 'pointer', borderRadius: 4 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
