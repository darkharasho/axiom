import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>()
  return { ...actual, execSync: vi.fn(), spawn: vi.fn() }
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.resetModules()
})

describe('isGearLeverInstalled', () => {
  it('returns true when flatpak list output includes gearlever', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('it.mijorus.gearlever\tGear Lever\t2.0.0\n' as any)

    const { isGearLeverInstalled } = await import('../gearlever')
    expect(isGearLeverInstalled()).toBe(true)
  })

  it('returns false when gearlever not in flatpak list', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockReturnValue('org.other.app\tOther\t1.0.0\n' as any)

    const { isGearLeverInstalled } = await import('../gearlever')
    expect(isGearLeverInstalled()).toBe(false)
  })

  it('returns false when execSync throws', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementation(() => { throw new Error('flatpak not found') })

    const { isGearLeverInstalled } = await import('../gearlever')
    expect(isGearLeverInstalled()).toBe(false)
  })
})

describe('openInGearLever', () => {
  it('calls flatpak run with the appimage path', async () => {
    const { spawn } = await import('child_process')
    const mockSpawn = vi.mocked(spawn).mockReturnValue({ unref: vi.fn() } as any)

    const { openInGearLever } = await import('../gearlever')
    openInGearLever('/home/user/Applications/AxiBridge-2.6.0.AppImage')

    expect(mockSpawn).toHaveBeenCalledWith(
      'flatpak',
      ['run', 'it.mijorus.gearlever', '/home/user/Applications/AxiBridge-2.6.0.AppImage'],
      { detached: true, stdio: 'ignore' },
    )
  })
})
