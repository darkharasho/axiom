import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SettingsView } from '../components/SettingsView'

describe('SettingsView', () => {
  // The window.axiom mocks are built once in setup.ts, so call history leaks
  // between tests unless cleared. clearAllMocks keeps their mockResolvedValue
  // implementations (unlike resetAllMocks).
  beforeEach(() => { vi.clearAllMocks() })

  it('renders auto-start and notify-on-updates toggles', () => {
    render(<SettingsView onBack={vi.fn()} />)
    expect(screen.getByText(/auto-start/i)).toBeInTheDocument()
    expect(screen.getByText(/notify on updates/i)).toBeInTheDocument()
  })

  it('calls setAutoStart and setConfig when auto-start toggle is clicked', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    const toggle = document.getElementById('auto-start')!
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(window.axiom.setAutoStart).toHaveBeenCalledWith(true)
      expect(window.axiom.setConfig).toHaveBeenCalledWith({ autoStart: true })
    })
  })

  it('persists the plugin prerelease opt-in and re-checks immediately', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    fireEvent.click(document.getElementById('prerelease-plugins')!)
    await waitFor(() => {
      expect(window.axiom.setConfig).toHaveBeenCalledWith({ allowPrereleasePlugins: true })
      // Without the re-check the row keeps showing the old "latest" until the
      // next poll, which reads as the toggle having done nothing.
      expect(window.axiom.checkUpdates).toHaveBeenCalled()
    })
  })

  it('keeps the app and plugin opt-ins independent', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    fireEvent.click(document.getElementById('prerelease-apps')!)
    await waitFor(() => {
      expect(window.axiom.setConfig).toHaveBeenCalledWith({ allowPrereleaseApps: true })
    })
    expect(window.axiom.setConfig).not.toHaveBeenCalledWith(
      expect.objectContaining({ allowPrereleasePlugins: expect.anything() }),
    )
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<SettingsView onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
