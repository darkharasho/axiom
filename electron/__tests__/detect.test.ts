import { describe, it, expect, vi, beforeEach } from 'vitest'
import os from 'os'

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, execSync: vi.fn() }
})
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, existsSync: vi.fn(), readdirSync: vi.fn() }
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.resetModules()
})

describe('detectInstalledVersion', () => {
  it('returns version from PowerShell on Windows when found', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('2.5.11\r\n' as any)
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBe('2.5.11')
  })

  it('returns null on Windows when PowerShell returns empty', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('\r\n' as any)
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBeNull()
  })

  it('returns null on Windows when PowerShell throws', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation(() => { throw new Error('PS error') })
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBeNull()
  })

  it('returns version from AppImage filename on Linux', async () => {
    const fs = await import('fs')
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.readdirSync).mockReturnValue(['AxiBridge-2.5.11-linux.AppImage'] as any)
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

    const { detectInstalledVersion } = await import('../detect')
    const version = await detectInstalledVersion('AxiBridge')
    expect(version).toBe('2.5.11')
  })
})
