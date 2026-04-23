import { useState, useEffect, useCallback } from 'react'
import type { Config } from '@shared/types'

const EMPTY_CONFIG: Config = {
  autoStart: false,
  notifyOnUpdates: false,
  trayBadge: true,
  apps: {
    axibridge: { installedVersion: null, lastChecked: null },
    axiforge:  { installedVersion: null, lastChecked: null },
    axipulse:  { installedVersion: null, lastChecked: null },
    axiam:     { installedVersion: null, lastChecked: null },
  },
}

// Module-level cache so re-mounting SettingsView doesn't flash back to defaults
let _cached: Config = EMPTY_CONFIG

export function useConfig() {
  const [config, setConfig] = useState<Config>(_cached)

  useEffect(() => {
    window.axiom.getConfig().then(cfg => {
      _cached = cfg
      setConfig(cfg)
    })
  }, [])

  const updateConfig = useCallback(async (patch: Partial<Config>) => {
    const updated = await window.axiom.setConfig(patch)
    _cached = updated
    setConfig(updated)
  }, [])

  return { config, updateConfig }
}
