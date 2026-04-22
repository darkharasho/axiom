import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useConfig } from '../hooks/useConfig'
import { Toggle } from './Toggle'

interface Props {
  onBack: () => void
}

let _cachedVersion = ''

export function SettingsView({ onBack }: Props) {
  const { config, updateConfig } = useConfig()
  const [version, setVersion] = useState(_cachedVersion)

  useEffect(() => {
    window.axiom.getVersion().then(v => { _cachedVersion = v; setVersion(v) })
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

      {/* Version */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-faint)', fontSize: 10 }}>AxiOM v{version}</span>
      </div>
    </div>
  )
}
