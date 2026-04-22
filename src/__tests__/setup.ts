import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock the window.axiom bridge
vi.stubGlobal('axiom', {
  getStates: vi.fn().mockResolvedValue([]),
  getConfig: vi.fn().mockResolvedValue({
    autoStart: false,
    axitoolsInviteUrl: '',
    apps: {
      axibridge: { installedVersion: null, lastChecked: null },
      axiforge: { installedVersion: null, lastChecked: null },
      axipulse: { installedVersion: null, lastChecked: null },
    },
  }),
  setConfig: vi.fn().mockResolvedValue({}),
  getAutoStart: vi.fn().mockResolvedValue(false),
  setAutoStart: vi.fn().mockResolvedValue(undefined),
  checkUpdates: vi.fn().mockResolvedValue(undefined),
  install: vi.fn().mockResolvedValue(undefined),
  launch: vi.fn().mockResolvedValue(undefined),
  uninstall: vi.fn().mockResolvedValue(undefined),
  installGearLever: vi.fn().mockResolvedValue(undefined),
  openGearLeverFlathub: vi.fn().mockResolvedValue(undefined),
  getVersion: vi.fn().mockResolvedValue('0.1.0'),
  onStatesUpdated: vi.fn().mockReturnValue(() => {}),
  onRequestCheckUpdates: vi.fn().mockReturnValue(() => {}),
  onGearLeverProgress: vi.fn().mockReturnValue(() => {}),
  quit: vi.fn(),
})
