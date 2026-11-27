import { describe, it, expect, vi } from 'vitest'
import { runsWithGame, setUpAfterLinuxInstall } from '../runsWithGame'

describe('runsWithGame', () => {
  it('is true only for AxiDPS', () => {
    expect(runsWithGame('axidps')).toBe(true)
    expect(runsWithGame('axibridge')).toBe(false)
  })
})

describe('setUpAfterLinuxInstall', () => {
  // The new AppImage has a new name: until it runs once, the game folder keeps the old DLL
  // and the start-with-game service points at the AppImage the update deleted.
  it('runs the AppImage once with --install-game', () => {
    const run = vi.fn()
    setUpAfterLinuxInstall('/apps/axidps-0.2.0-rc.7.AppImage', run)
    expect(run).toHaveBeenCalledWith('/apps/axidps-0.2.0-rc.7.AppImage', ['--install-game'])
  })

  it('does nothing without an AppImage', () => {
    const run = vi.fn()
    setUpAfterLinuxInstall(null, run)
    expect(run).not.toHaveBeenCalled()
  })
})
