import type { CSSProperties } from 'react'
import { Download, ArrowUp, Power } from 'lucide-react'
import type { ArcdpsPluginState } from '@shared/types'
import { arcdpsPluginHasUpdate } from '@shared/types'
import { ProgressBar } from './ProgressBar'

interface Props {
  plugin: ArcdpsPluginState
  onInstall: (id: string) => void
  onSetDisabled: (id: string, disabled: boolean) => void
}

export function ArcdpsRow({ plugin, onInstall, onSetDisabled }: Props) {
  const { id, name, description, installed, disabled, installedTag, latestTag, upToDate, localBuild, downloadUrl, status, errorMessage, downloadProgress } = plugin

  const isBusy = status === 'downloading' || status === 'installing'
  const isDisabled = isBusy || (installed && upToDate === true) || !downloadUrl
  // An update check that failed leaves us with no version info and no URL to act
  // on. Surface that instead of a phantom disabled "Update to latest" button.
  const checkFailed = installed && upToDate === null && !downloadUrl && !!errorMessage

  const statusText = () => {
    if (!installed) return 'Not installed'
    if (disabled) return 'Disabled'
    if (checkFailed) return "Couldn't check for updates"
    if (localBuild) return 'Local build (newer than latest release)'
    if (upToDate === true) return 'Up to date'
    if (upToDate === false) return 'Update available'
    return 'Unknown'
  }

  const statusClass = () => {
    if (errorMessage) return 'ax-ink-danger'
    if (upToDate === false) return 'ax-ink-accent'
    return ''
  }

  const buttonLabel = () => {
    if (!installed) return 'Install'
    if (upToDate === false) return 'Update'
    if (localBuild) return 'Reinstall release'
    if (upToDate === null) return 'Update to latest'
    return 'Up to date'
  }

  const hasUpdate = arcdpsPluginHasUpdate(plugin)

  return (
    <div className={`ax-item${installed ? '' : ' ax-item--off'}`} style={{ alignItems: 'flex-start' }}>
      <div className="ax-item__main">
        <div className="ax-item__name">{name}</div>
        {description && <div className="ax-item__note">{description}</div>}
        <div className={`ax-item__note ${statusClass()}`} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{statusText()}</span>
          {installedTag && <span className="axi-chip axi-chip--meta ax-sm">installed {installedTag}</span>}
          {latestTag && <span className="axi-chip axi-chip--meta ax-sm">latest {latestTag}</span>}
        </div>
        {errorMessage && <div className="ax-item__note ax-ink-danger">{errorMessage}</div>}
      </div>

      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, paddingTop: 2 }}>
        {isBusy && downloadProgress ? (
          <ProgressBar progress={downloadProgress} />
        ) : (
          <>
            {/* On/off for the plugin itself. A pressed pill is the language's
                "this one is on", and it fills in the ok ink rather than the
                accent because what it asserts is "running", not "urgent". */}
            {installed && (
              <button
                className="axi-pill ax-sm"
                style={{ '--axi-pill-fill': 'var(--axi-ok)' } as CSSProperties}
                onClick={() => onSetDisabled(id, !disabled)}
                disabled={isBusy}
                aria-pressed={!disabled}
                title={disabled ? 'Enable this plugin' : 'Disable this plugin'}
                aria-label={disabled ? 'Enable plugin' : 'Disable plugin'}
              >
                <Power size={12} />
              </button>
            )}
            {!disabled && !checkFailed && (
              <button
                className={hasUpdate ? 'axi-btn axi-btn--primary ax-sm' : 'axi-btn ax-sm'}
                onClick={() => onInstall(id)}
                disabled={isDisabled}
              >
                {!installed && <Download size={10} />}
                {hasUpdate && <ArrowUp size={10} />}
                {buttonLabel()}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
