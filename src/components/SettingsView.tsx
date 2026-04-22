import React, { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useConfig } from '../hooks/useConfig'

interface Props {
  onBack: () => void
}

export function SettingsView({ onBack }: Props) {
  const { config, updateConfig } = useConfig()
  const [autoStart, setAutoStartLocal] = useState(false)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.axiom.getAutoStart().then(setAutoStartLocal)
    window.axiom.getVersion().then(setVersion)
  }, [])

  const handleAutoStart = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked
    setAutoStartLocal(enabled)
    await window.axiom.setAutoStart(enabled)
  }

  const handleInviteUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig({ axitoolsInviteUrl: e.target.value })
  }

  const row: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  }

  const label: React.CSSProperties = { color: 'var(--text-light)', fontSize: 12 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
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
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700 }}>
          <span style={{ color: 'var(--text)' }}>Settings</span>
        </span>
      </div>

      {/* Auto-start */}
      <div style={row}>
        <label style={label} htmlFor="auto-start">Auto-start on login</label>
        <input
          id="auto-start"
          type="checkbox"
          checked={autoStart}
          onChange={handleAutoStart}
          aria-label="Auto-start on login"
          style={{ accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
        />
      </div>

      {/* Update notifications */}
      <div style={row}>
        <label style={label} htmlFor="notify-updates">Notify on updates</label>
        <input
          id="notify-updates"
          type="checkbox"
          checked={config.notifyOnUpdates ?? false}
          onChange={e => updateConfig({ notifyOnUpdates: e.target.checked })}
          style={{ accentColor: 'var(--gold)', width: 15, height: 15, cursor: 'pointer' }}
        />
      </div>

      {/* AxiTools invite URL */}
      <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
        <span style={label}>AxiTools Discord Invite URL</span>
        <input
          type="text"
          value={config.axitoolsInviteUrl}
          onChange={handleInviteUrl}
          placeholder="https://discord.gg/..."
          style={{
            width: '100%',
            background: '#0a0b0e',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '6px 8px',
            color: 'var(--text)',
            fontSize: 11,
            outline: 'none',
          }}
        />
      </div>

      {/* Version */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>AxiOM v{version}</span>
      </div>
    </div>
  )
}
