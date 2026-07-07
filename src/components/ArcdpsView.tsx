import { useEffect, useRef } from 'react'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { useArcdpsState } from '../hooks/useArcdpsState'
import { ArcdpsRow } from './ArcdpsRow'

interface Props {
  onBack: () => void
}

export function ArcdpsView({ onBack }: Props) {
  const { state, checking, check, install, setDisabled, setGw2Path } = useArcdpsState()
  const { gw2Path, gw2PathSource, overrideError, plugins } = state

  const didInitialCheck = useRef(false)
  useEffect(() => {
    if (didInitialCheck.current) return
    didInitialCheck.current = true
    check()
  }, [check])

  const handleChangePath = async () => {
    const picked = await window.axiom.pickGw2Folder()
    if (picked === null) return
    await setGw2Path(picked)
  }

  const sourceLabel = (source: typeof gw2PathSource) => {
    switch (source) {
      case 'axiam':  return 'detected via AxiAM'
      case 'auto':   return 'auto-detected'
      case 'manual': return 'set manually'
      case 'none':   return 'not set'
    }
  }

  return (
    <div className="view-enter" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
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
        <span style={{ fontFamily: 'var(--font-title)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          arcdps &amp; Plugins
        </span>
        <button
          onClick={check}
          disabled={checking}
          className="btn-ghost"
          style={{
            marginLeft: 'auto',
            background: 'none',
            color: checking ? 'var(--text-faint)' : 'var(--text-dim)',
            fontSize: 11,
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'color 0.1s',
          }}
          onMouseEnter={e => { if (!checking) e.currentTarget.style.color = 'var(--text-light)' }}
          onMouseLeave={e => { if (!checking) e.currentTarget.style.color = 'var(--text-dim)' }}
        >
          <RefreshCw size={10} className={checking ? 'spin' : ''} />
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
      </div>

      {/* GW2 path line */}
      <div style={{
        fontSize: 10,
        color: 'var(--text-faint)',
        marginBottom: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        {gw2Path ? (
          <>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'monospace', fontSize: 10 }}>{gw2Path}</span>
            <span>({sourceLabel(gw2PathSource)})</span>
          </>
        ) : (
          <span>GW2 path not set</span>
        )}
        <button
          onClick={handleChangePath}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--gold)',
            fontSize: 10,
            cursor: 'pointer',
            padding: 0,
            textDecoration: 'underline',
            textUnderlineOffset: 2,
          }}
        >
          Change…
        </button>
      </div>

      {overrideError && (
        <div style={{
          fontSize: 11,
          color: 'var(--danger, #c66)',
          marginBottom: 10,
          padding: '6px 8px',
          background: 'rgba(200, 100, 100, 0.08)',
          border: '1px solid rgba(200, 100, 100, 0.2)',
          borderRadius: 3,
        }}>
          {overrideError}
        </div>
      )}

      {/* Plugin list or empty state */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {plugins.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 8,
            color: 'var(--text-faint)',
            fontSize: 12,
            textAlign: 'center',
            padding: '0 20px',
          }}>
            {gw2Path === null ? (
              <>
                <span>No GW2 path configured.</span>
                <span style={{ fontSize: 11 }}>Set your GW2 installation path above to manage arcdps plugins.</span>
              </>
            ) : (
              <>
                <span>No plugins found.</span>
                <span style={{ fontSize: 11 }}>Click &quot;Check for updates&quot; to load available plugins.</span>
              </>
            )}
          </div>
        ) : (
          plugins.map(plugin => (
            <ArcdpsRow key={plugin.id} plugin={plugin} onInstall={install} onSetDisabled={setDisabled} />
          ))
        )}
      </div>
    </div>
  )
}
