import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppInfoView } from '../components/AppInfoView'

describe('AppInfoView', () => {
  it('does not show Install button when no downloadUrl', () => {
    render(<AppInfoView appId="axibridge" onBack={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument()
  })

  it('shows Install button when downloadUrl is provided', () => {
    render(
      <AppInfoView
        appId="axibridge"
        onBack={vi.fn()}
        downloadUrl="https://example.com/axibridge.AppImage"
        onInstall={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
  })

  it('calls onInstall when Install button clicked', () => {
    const onInstall = vi.fn()
    render(
      <AppInfoView
        appId="axibridge"
        onBack={vi.fn()}
        downloadUrl="https://example.com/axibridge.AppImage"
        onInstall={onInstall}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /install/i }))
    expect(onInstall).toHaveBeenCalledOnce()
  })
})
