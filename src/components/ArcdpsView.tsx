import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
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
    <div className="view-enter ax-view">
      <div className="ax-head">
        <button className="ax-icon" onClick={onBack} aria-label="Back">
          <ChevronLeft size={16} />
        </button>
        <span className="ax-title">arcdps &amp; Plugins</span>
        <button className="ax-icon" style={{ marginLeft: 'auto' }} onClick={check} disabled={checking}>
          <RefreshCw size={10} className={checking ? 'spin' : ''} />
          {checking ? 'Checking…' : 'Check'}
        </button>
      </div>

      {/* Where the plugins are going, and how we know. Both are metadata, and
          both stay on the faint step of the ramp: the cool meta ink is drawn as
          an outlined chip, and a chip here shouted louder than the path it was
          annotating. */}
      <div className="ax-item__note" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0 6px 8px', marginTop: 0 }}>
        {gw2Path ? (
          <>
            <span style={{ fontFamily: 'var(--axi-mono)', color: 'var(--axi-text-dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{gw2Path}</span>
            <span>{sourceLabel(gw2PathSource)}</span>
          </>
        ) : (
          <span>GW2 path not set</span>
        )}
        <button className="ax-icon" onClick={handleChangePath}>Change…</button>
      </div>

      {overrideError && (
        <div className="axi-notice" style={{ '--axi-panel-pad': '10px', padding: '10px 12px', marginBottom: 8, boxShadow: 'none' } as CSSProperties}>
          <span className="axi-notice__icon" style={{ background: 'var(--axi-danger)' }} aria-hidden>!</span>
          <p>{overrideError}</p>
        </div>
      )}

      <div className="ax-scroll">
        {plugins.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 6, textAlign: 'center', padding: '0 20px',
            font: 'var(--axi-t-small)', color: 'var(--axi-text-faint)',
          }}>
            {gw2Path === null ? (
              <>
                <span>No GW2 path configured.</span>
                <span className="ax-item__note">Set your GW2 installation path above to manage arcdps plugins.</span>
              </>
            ) : (
              <>
                <span>No plugins found.</span>
                <span className="ax-item__note">Check for updates to load available plugins.</span>
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
