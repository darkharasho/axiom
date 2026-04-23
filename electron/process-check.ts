const PROCESS_CHECK_TIMEOUT_MS = 3000

export async function isProcessRunning(appName: string): Promise<boolean> {
  const { exec } = await import('child_process')
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), PROCESS_CHECK_TIMEOUT_MS)
    const cmd = process.platform === 'win32'
      ? `tasklist /FI "IMAGENAME eq ${appName}.exe" /NH`
      : `pgrep -i "${appName}"`
    exec(cmd, (err, stdout) => {
      clearTimeout(timer)
      if (process.platform === 'win32') {
        resolve(stdout.trim().toLowerCase().includes(appName.toLowerCase() + '.exe'))
      } else {
        resolve(!err)
      }
    })
  })
}
