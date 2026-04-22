import type { InstallableAppId } from '@shared/types'

interface Props {
  appId: InstallableAppId
  onInstall: () => void
  onOpenFlathub: () => void
}

export function GearLeverPrompt({ appId: _appId, onInstall, onOpenFlathub }: Props) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      padding: '6px 0',
    }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
        Gear Lever required to manage AppImages
      </span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={onInstall}
          style={{
            flex: 1,
            background: 'var(--gold)',
            color: 'var(--bg)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          Install Gear Lever
        </button>
        <button
          onClick={onOpenFlathub}
          style={{
            flex: 1,
            background: 'transparent',
            color: 'var(--gold)',
            border: '1px solid var(--gold-border)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
          }}
        >
          Open Flathub ↗
        </button>
      </div>
    </div>
  )
}
