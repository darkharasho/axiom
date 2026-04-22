import { Settings, RefreshCw, LogOut } from 'lucide-react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { AppRow } from './AppRow'

interface Props {
  states: AppState[]
  checking: boolean
  onOpenSettings: () => void
  onCheckUpdates: () => void
}

const APP_ORDER: AppId[] = ['axibridge', 'axiforge', 'axipulse', 'axiam', 'axitools']

export function AppList({ states, checking, onOpenSettings, onCheckUpdates }: Props) {
  const stateMap = Object.fromEntries(states.map(s => [s.id, s])) as Record<AppId, AppState>

  const handleAction = (action: string, appId: AppId) => {
    switch (action) {
      case 'launch':
        window.axiom.launch(appId)
        break
      case 'install':
        window.axiom.install(appId as InstallableAppId)
        break
      case 'update':
        window.axiom.launch(appId)
        break
      case 'uninstall':
        window.axiom.uninstall(appId as InstallableAppId)
        break
      case 'invite':
        window.axiom.launch(appId)
        break
      case 'install-gear-lever':
        window.axiom.installGearLever(appId as InstallableAppId)
        break
      case 'open-gear-lever-flathub':
        window.axiom.openGearLeverFlathub()
        break
    }
  }

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
        <img src="./AxiOM-White.svg" alt="AxiOM" style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700, letterSpacing: '0.5px' }}>
          <span style={{ color: 'var(--text)' }}>Axi</span>
          <span style={{ color: 'var(--gold)' }}>OM</span>
        </span>
        <button
          onClick={onOpenSettings}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            padding: '2px 4px',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
          }}
          title="Settings"
        >
          <Settings size={14} />
        </button>
      </div>

      {/* App rows */}
      <div style={{ flex: 1 }}>
        {APP_ORDER.map(id => stateMap[id] && (
          <AppRow key={id} state={stateMap[id]} onAction={handleAction} />
        ))}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 8,
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={onCheckUpdates}
          disabled={checking}
          style={{
            background: 'none',
            color: checking ? 'var(--text-faint)' : 'var(--text-dim)',
            fontSize: 10,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RefreshCw size={10} className={checking ? 'spin' : ''} />
          {checking ? 'Checking...' : 'Check for updates'}
        </button>
        <button
          onClick={() => window.axiom.quit()}
          style={{
            background: 'none',
            color: 'var(--text-faint)',
            fontSize: 10,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <LogOut size={10} />
          Quit
        </button>
      </div>
    </div>
  )
}
