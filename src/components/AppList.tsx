import type { ReactNode } from 'react'
import { Settings, RefreshCw, LogOut, ArrowUp } from 'lucide-react'
import type { AppState, AppId, InstallableAppId } from '@shared/types'
import { arcdpsPluginHasUpdate, appHasUpdate } from '@shared/types'
import type { SelfUpdateState } from '../hooks/useSelfUpdate'
import { AppRow } from './AppRow'
import { useArcdpsState } from '../hooks/useArcdpsState'

interface Props {
  states: AppState[]
  checking: boolean
  selfUpdate?: SelfUpdateState
  onOpenSettings: () => void
  onOpenArcdps: () => void
  onCheckUpdates: () => void
  onOpenInfo: (appId: AppId) => void
}

// Display order. MUST list every id in APP_META or the missing app silently
// never renders (presentIds filters by this array). Guarded by AppList.test.
export const APP_ORDER: AppId[] = ['axibridge', 'axiforge', 'axipulse', 'axiam', 'axivale', 'axiroster', 'axistream', 'axitools']

export function AppList({ states, checking, selfUpdate, onOpenSettings, onOpenArcdps, onCheckUpdates, onOpenInfo }: Props) {
  const stateMap = Object.fromEntries(states.map(s => [s.id, s])) as Record<AppId, AppState>
  const { state: arcdpsState } = useArcdpsState()
  // Installed apps float to the top. Within each group the canonical APP_ORDER
  // is preserved. axitools has no installedVersion, so it sorts as not-installed.
  const presentIds = APP_ORDER.filter(id => stateMap[id])
  const installedIds = presentIds.filter(id => stateMap[id].installedVersion)
  const availableIds = presentIds.filter(id => !stateMap[id].installedVersion)
  // Only label the groups when there's actually a mix to disambiguate.
  const showSections = installedIds.length > 0 && availableIds.length > 0
  const arcdpsHasUpdate = arcdpsState.plugins.some(arcdpsPluginHasUpdate)

  const handleAction = (action: string, appId: AppId) => {
    switch (action) {
      case 'launch':
        window.axiom.launch(appId)
        break
      case 'install':
      case 'update':
        window.axiom.install(appId as InstallableAppId)
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
      case 'browse-files':
        window.axiom.browseFiles(appId as Parameters<typeof window.axiom.browseFiles>[0])
        break
    }
  }

  const handleRetry = (appId: AppId) => {
    const state = stateMap[appId]
    if (state?.installedVersion) {
      window.axiom.launch(appId)
    } else {
      window.axiom.install(appId as InstallableAppId)
    }
  }

  const appsWithUpdates = states.filter((s): s is AppState & { id: InstallableAppId } => {
    if (s.id === 'axitools') return false
    const hasUpdate = appHasUpdate(s.installedVersion, s.latestVersion)
    const isBusy = s.status === 'downloading' || s.status === 'installing' || s.status === 'deleting'
    return hasUpdate && !isBusy
  })

  const handleUpdateAll = () => {
    appsWithUpdates.forEach(s => window.axiom.install(s.id))
  }

  return (
    <div className="view-enter ax-view">
      <div className="ax-head">
        {/* The sigil is rule 7's motif doing its job: the glyph is axiom's, the
            diamond behind it is the family's. */}
        <img src="./svg/axiom-glyph.svg" alt="" aria-hidden style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <span className="ax-title">
          Axi<span style={{ color: 'var(--axi-accent)' }}>OM</span>
        </span>

        {import.meta.env.DEV && (
          <span className="axi-chip axi-chip--meta ax-sm" title="Running from the dev server">dev</span>
        )}

        {/* The self-update state. Ready is the only one you can act on, so it is
            the only one that gets a control; the rest annotate. */}
        {selfUpdate?.status === 'ready' && (
          <button
            className="axi-btn axi-btn--primary ax-sm"
            onClick={() => window.axiom.installSelfUpdate()}
            title={`Restart to install AxiOM v${selfUpdate.version}`}
          >
            <ArrowUp size={10} />
            Update
          </button>
        )}
        {(selfUpdate?.status === 'available' || selfUpdate?.status === 'downloading') && (
          <span
            className="axi-chip ax-sm ax-ink-accent"
            title={selfUpdate.status === 'downloading' ? 'Downloading AxiOM update…' : `AxiOM v${selfUpdate.version} available`}
          >
            <RefreshCw size={9} className="spin" />
            {selfUpdate.status === 'downloading' ? 'Updating' : 'Update'}
          </span>
        )}

        <button
          className="ax-icon"
          style={{ marginLeft: 'auto' }}
          onClick={onOpenArcdps}
          title={arcdpsHasUpdate ? 'arcdps plugins — update available' : 'arcdps plugins'}
        >
          arcdps
          {/* A diamond, not a glow dot: the motif already means "state" here,
              and it costs no blur. */}
          {arcdpsHasUpdate && <span className="axi-diamond axi-diamond--accent" aria-hidden style={{ width: 7, height: 7 }} />}
        </button>
        <button className="ax-icon" onClick={onOpenSettings} title="Settings" aria-label="Settings">
          <Settings size={13} />
        </button>
      </div>

      {/* The list is the window's interior — rows in rules, never in outlines. */}
      <div className="ax-scroll">
        {showSections && <SectionLabel>Installed</SectionLabel>}
        {installedIds.map(id => (
          <AppRow key={id} state={stateMap[id]} onAction={handleAction} onInfo={onOpenInfo} onRetry={handleRetry} />
        ))}
        {showSections && <SectionLabel>Available</SectionLabel>}
        {availableIds.map(id => (
          <AppRow key={id} state={stateMap[id]} onAction={handleAction} onInfo={onOpenInfo} onRetry={handleRetry} />
        ))}
      </div>

      <div className="ax-foot">
        <button className="ax-icon" onClick={onCheckUpdates} disabled={checking}>
          <RefreshCw size={10} className={checking ? 'spin' : ''} />
          {checking ? 'Checking…' : 'Check for updates'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {appsWithUpdates.length >= 2 && (
            <button className="axi-btn axi-btn--primary ax-sm" onClick={handleUpdateAll}>
              <ArrowUp size={10} />
              Update All
            </button>
          )}
          <button className="ax-icon ax-icon--danger" onClick={() => window.axiom.quit()}>
            <LogOut size={10} />
            Quit
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="axi-eyebrow"
      style={{ color: 'var(--axi-text-faint)', margin: '10px 6px 4px' }}
    >
      {children}
    </div>
  )
}
