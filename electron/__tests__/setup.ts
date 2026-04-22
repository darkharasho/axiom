import { vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/tmp/axiom-test-userdata'
      return '/tmp'
    }),
    getVersion: vi.fn(() => '0.1.0'),
    setLoginItemSettings: vi.fn(),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
  },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}))
