import * as childProcess from 'child_process'

export function isGearLeverInstalled(): boolean {
  try {
    const output = childProcess.execSync('flatpak list --columns=application', {
      encoding: 'utf8',
      timeout: 5000,
    })
    return output.includes('it.mijorus.gearlever')
  } catch {
    return false
  }
}

export function openInGearLever(appImagePath: string): void {
  const child = childProcess.spawn('flatpak', ['run', 'it.mijorus.gearlever', appImagePath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

export function removeFromGearLever(appImagePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn('flatpak', ['run', 'it.mijorus.gearlever', '--remove', appImagePath], {
      detached: false,
      stdio: 'ignore',
    })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Gear Lever remove exited with code ${code}`))
    })
    child.on('error', reject)
  })
}

export function installGearLever(onData: (chunk: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn('flatpak', ['install', '--noninteractive', 'flathub', 'it.mijorus.gearlever'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout?.on('data', (d: Buffer) => onData(d.toString()))
    child.stderr?.on('data', (d: Buffer) => onData(d.toString()))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`flatpak install exited with code ${code}`))
    })
    child.on('error', reject)
  })
}
