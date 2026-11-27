import { execFile } from 'child_process'
import { RUNS_WITH_GAME, type AppId } from './shared/types'

export function runsWithGame(appId: AppId): boolean {
  return RUNS_WITH_GAME.includes(appId)
}

type Run = (file: string, args: string[]) => void

const runLogged: Run = (file, args) => {
  execFile(file, args, { timeout: 120_000 }, (err, stdout, stderr) => {
    const out = `${stdout}${stderr}`.trim()
    if (err) console.error(`[setup] ${file} ${args.join(' ')} failed:`, err.message, out)
    else console.log(`[setup] ${file} ${args.join(' ')}:`, out || 'done')
  })
}

/**
 * After a Linux install or update, run the new AppImage once with `--install-game`: it puts its
 * DLL in the game folder and points the start-with-game service at itself. An update renames the
 * AppImage, so without this the service keeps pointing at the deleted one. Not awaited: it may
 * ask for the game folder. Windows needs nothing, the app's own installer runs the same step.
 */
export function setUpAfterLinuxInstall(appImagePath: string | null, run: Run = runLogged): void {
  if (!appImagePath) return
  run(appImagePath, ['--install-game'])
}
