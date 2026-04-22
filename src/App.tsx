import { useState } from 'react'
import { AppList } from './components/AppList'
import { SettingsView } from './components/SettingsView'
import { useAppStates } from './hooks/useAppStates'

type View = 'list' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('list')
  const { states, checking, checkUpdates } = useAppStates()

  return (
    <div style={{ width: '100%', height: '100%', background: 'var(--bg)' }}>
      {view === 'list' && (
        <AppList
          states={states}
          checking={checking}
          onOpenSettings={() => setView('settings')}
          onCheckUpdates={checkUpdates}
        />
      )}
      {view === 'settings' && (
        <SettingsView onBack={() => setView('list')} />
      )}
    </div>
  )
}
