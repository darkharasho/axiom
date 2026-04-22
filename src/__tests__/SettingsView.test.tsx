import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsView } from '../components/SettingsView'

describe('SettingsView', () => {
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

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<SettingsView onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
