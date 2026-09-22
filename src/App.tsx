import { useState } from 'react'
import { AppList } from './components/AppList'
import { SettingsView } from './components/SettingsView'
import { AppInfoView } from './components/AppInfoView'
import { ArcdpsView } from './components/ArcdpsView'
import { useAppStates } from './hooks/useAppStates'
import { useSelfUpdate } from './hooks/useSelfUpdate'
import type { AppId, InstallableAppId } from '@shared/types'

type View = 'list' | 'settings' | 'info' | 'arcdps'

export default function App() {
  const [view, setView] = useState<View>('list')
  const [infoAppId, setInfoAppId] = useState<AppId | null>(null)
  const { states, checking, checkUpdates } = useAppStates()
  const selfUpdate = useSelfUpdate()

  const infoState = infoAppId ? states.find(s => s.id === infoAppId) : undefined

  return (
    // The window is the panel. axi's .axi-window is exactly this shape: the
    // ground, the panel-weight outline, and no offset block - there is nothing
    // behind a frameless tray popover for it to be raised off, and a block
    // would be clipped by the window edge anyway.
    <div className="axi-window">
      {view === 'list' && (
        <AppList
          states={states}
          checking={checking}
          selfUpdate={selfUpdate}
          onOpenSettings={() => setView('settings')}
          onOpenArcdps={() => setView('arcdps')}
          onCheckUpdates={checkUpdates}
          onOpenInfo={id => { setInfoAppId(id); setView('info') }}
        />
      )}
      {view === 'settings' && (
        <SettingsView onBack={() => setView('list')} />
      )}
      {view === 'arcdps' && (
        <ArcdpsView onBack={() => setView('list')} />
      )}
      {view === 'info' && infoAppId && (
        <AppInfoView
          appId={infoAppId}
          onBack={() => setView('list')}
          downloadUrl={infoState?.downloadUrl ?? undefined}
          onLaunch={infoState?.installedVersion && infoAppId !== 'axitools' ? () => window.axiom.launch(infoAppId) : undefined}
          onInstall={!infoState?.installedVersion && infoState?.downloadUrl ? () => window.axiom.install(infoAppId as InstallableAppId) : undefined}
          onInvite={infoAppId === 'axitools' ? () => window.axiom.launch('axitools') : undefined}
        />
      )}
    </div>
  )
}
