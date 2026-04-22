import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SettingsView } from '../components/SettingsView'

describe('SettingsView', () => {
  it('renders auto-start toggle and invite URL field', () => {
    render(<SettingsView onBack={vi.fn()} />)
    expect(screen.getByText(/auto-start/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/discord\.gg/i)).toBeInTheDocument()
  })

  it('calls setAutoStart when toggle is clicked', async () => {
    render(<SettingsView onBack={vi.fn()} />)
    const toggle = screen.getByRole('checkbox', { name: /auto-start/i })
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(window.axiom.setAutoStart).toHaveBeenCalledWith(true)
    })
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<SettingsView onBack={onBack} />)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()
  })
})
