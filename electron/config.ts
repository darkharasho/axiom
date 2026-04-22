import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { Config, InstallableAppId } from './shared/types'
import { DEFAULT_CONFIG } from './shared/types'

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

export function readConfig(): Config {
  const p = configPath()
  if (!fs.existsSync(p)) return structuredClone(DEFAULT_CONFIG)
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    // Merge with defaults so new fields are always present
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      apps: { ...DEFAULT_CONFIG.apps, ...raw.apps },
    }
  } catch {
    return structuredClone(DEFAULT_CONFIG)
  }
}

export function writeConfig(cfg: Config): void {
  const p = configPath()
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

export function patchConfig(patch: Partial<Config>): void {
  writeConfig({ ...readConfig(), ...patch })
}

export function setInstalledVersion(appId: InstallableAppId, version: string | null): void {
  const cfg = readConfig()
  cfg.apps[appId] = {
    installedVersion: version,
    lastChecked: new Date().toISOString(),
  }
  writeConfig(cfg)
}
