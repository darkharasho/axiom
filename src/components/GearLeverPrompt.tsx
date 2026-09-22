import { ExternalLink } from 'lucide-react'
import type { InstallableAppId } from '@shared/types'

interface Props {
  appId: InstallableAppId
  onInstall: () => void
  onOpenFlathub: () => void
}

export function GearLeverPrompt({ appId: _appId, onInstall, onOpenFlathub }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
      <span className="axi-chip axi-chip--meta ax-sm">Gear Lever required</span>
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="axi-btn axi-btn--primary ax-sm" onClick={onInstall}>
          Install it
        </button>
        <button className="axi-btn ax-sm" onClick={onOpenFlathub}>
          <ExternalLink size={10} />
          Flathub
        </button>
      </div>
    </div>
  )
}
