// Access check: blocks the app when the signed-in GitHub user is on the Axi
// denylist. See README "Access".
import { createAccessGate, createConfig, type AccessGate, type AxiConfig, type Identity } from '@axiapps/axi-config'
import { blockIfTripped, handleBlocked, type ElectronLike, type RelaunchableApp } from '@axiapps/axi-config/electron'

export interface AccessDeps {
  electron: ElectronLike & { app: RelaunchableApp & { getPath(name: 'userData'): string } }
  config?: AxiConfig // tests inject one; production creates it
  onBlocked?: (info: { persisted: boolean }) => void // tests inject a spy
  /** Numeric GitHub user id of the signed-in user, or null/undefined when signed out. */
  getGithubId: () => number | null | undefined
}

export type AccessBoot = { blocked: true } | { blocked: false; gate: AccessGate; config: AxiConfig }

export async function startAccess(deps: AccessDeps): Promise<AccessBoot> {
  const config = deps.config ?? createConfig({ appId: 'axiom', cacheDir: deps.electron.app.getPath('userData') })
  await config.ready()
  if (blockIfTripped(deps.electron, config)) return { blocked: true }
  const gate = createAccessGate({
    config,
    onBlocked: deps.onBlocked ?? ((info) => handleBlocked(deps.electron, config, info)),
  })
  gate.addSource('github-user', (): Identity[] => {
    const id = deps.getGithubId()
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0 ? [{ kind: 'github_user', value: String(id) }] : []
  })
  config.onChange(() => void gate.recheck())
  return { blocked: false, gate, config }
}
