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

  it('offers "Unlock private apps" to an allowlisted login', async () => {
    vi.mocked(window.axiom.githubGetStatus).mockResolvedValueOnce({ signedIn: true, login: 'darkharasho', unlocked: true, canUnlockPrivate: true })
    render(<SettingsView onBack={vi.fn()} />)
    expect(await screen.findByRole('button', { name: /unlock private apps/i })).toBeInTheDocument()
  })

  it('never offers the unlock to a login that is not allowlisted', async () => {
    vi.mocked(window.axiom.githubGetStatus).mockResolvedValueOnce({ signedIn: true, login: 'randomuser', unlocked: false, canUnlockPrivate: false })
    render(<SettingsView onBack={vi.fn()} />)
    expect(await screen.findByText('randomuser')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unlock private apps/i })).not.toBeInTheDocument()
  })

  it('runs the unlock device flow and shows its code', async () => {
    vi.mocked(window.axiom.githubGetStatus).mockResolvedValueOnce({ signedIn: true, login: 'darkharasho', unlocked: true, canUnlockPrivate: true })
    vi.mocked(window.axiom.githubAuthBegin).mockResolvedValueOnce({
      userCode: 'ABCD-1234', verificationUri: 'https://github.com/login/device', deviceCode: 'DEV', interval: 5, expiresIn: 900,
    })
    vi.mocked(window.axiom.githubAuthComplete).mockReturnValueOnce(new Promise<never>(() => {})) // still waiting on GitHub
    render(<SettingsView onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /unlock private apps/i }))
    await waitFor(() => expect(window.axiom.githubAuthBegin).toHaveBeenCalledWith('unlock'))
    expect(await screen.findByText('ABCD-1234')).toBeInTheDocument()
  })

  it('starts a normal sign-in in sign-in mode', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /^sign in$/i }))
    await waitFor(() => expect(window.axiom.githubAuthBegin).toHaveBeenCalledWith('sign-in'))
  })
})
