import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, exec: vi.fn() }
})

let originalPlatform: string

beforeEach(() => {
  originalPlatform = process.platform
  vi.useFakeTimers()
})

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('isProcessRunning', () => {
  it('resolves true on Linux when pgrep exits without error', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(null, '', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(true)
  })

  it('resolves false on Linux when pgrep exits with error', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(new Error('no match'), '', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(false)
  })

  it('resolves true on Windows when tasklist output contains the exe', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(null, 'axibridge.exe\r\n', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(true)
  })

  it('resolves false on Windows when tasklist output does not contain the exe', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation((_cmd: any, cb: any) => { cb(null, 'No tasks running\r\n', ''); return {} as any })
    const { isProcessRunning } = await import('../process-check')
    expect(await isProcessRunning('AxiBridge')).toBe(false)
  })

  it('resolves false when exec never calls back within the timeout', async () => {
    vi.useRealTimers()
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    const { exec } = await import('child_process')
    vi.mocked(exec).mockImplementation(() => ({} as any)) // never calls callback
    const { isProcessRunning } = await import('../process-check')
    const startTime = Date.now()
    const result = await isProcessRunning('AxiBridge')
    const elapsed = Date.now() - startTime
    expect(result).toBe(false)
    expect(elapsed).toBeGreaterThanOrEqual(3000)
    vi.useFakeTimers()
  })
})
