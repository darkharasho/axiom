import { useState } from 'react'
import { AppList } from './components/AppList'
import { SettingsView } from './components/SettingsView'
import { AppInfoView } from './components/AppInfoView'
import { useAppStates } from './hooks/useAppStates'
import type { AppId, InstallableAppId } from '@shared/types'

type View = 'list' | 'settings' | 'info'

export default function App() {
  const [view, setView] = useState<View>('list')
  const [infoAppId, setInfoAppId] = useState<AppId | null>(null)
  const { states, checking, checkUpdates } = useAppStates()

  const infoState = infoAppId ? states.find(s => s.id === infoAppId) : undefined

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg)' }}>
      {view === 'list' && (
        <AppList
          states={states}
          checking={checking}
          onOpenSettings={() => setView('settings')}
          onCheckUpdates={checkUpdates}
          onOpenInfo={id => { setInfoAppId(id); setView('info') }}
        />
      )}
      {view === 'settings' && (
        <SettingsView onBack={() => setView('list')} />
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
