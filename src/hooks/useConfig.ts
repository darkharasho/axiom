import { useState, useEffect, useCallback } from 'react'
import type { Config } from '@shared/types'

const EMPTY_CONFIG: Config = {
  autoStart: false,
  notifyOnUpdates: false,
  apps: {
    axibridge: { installedVersion: null, lastChecked: null },
    axiforge:  { installedVersion: null, lastChecked: null },
    axipulse:  { installedVersion: null, lastChecked: null },
    axiam:     { installedVersion: null, lastChecked: null },
  },
}

export function useConfig() {
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG)

  useEffect(() => {
    window.axiom.getConfig().then(setConfig)
  }, [])

  const updateConfig = useCallback(async (patch: Partial<Config>) => {
    const updated = await window.axiom.setConfig(patch)
    setConfig(updated)
  }, [])

  return { config, updateConfig }
}
