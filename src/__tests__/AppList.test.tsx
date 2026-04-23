import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppList } from '../components/AppList'
import type { AppState } from '@shared/types'

const makeState = (id: AppState['id'], overrides: Partial<AppState> = {}): AppState => ({
  id,
  installedVersion: '1.0.0',
  latestVersion: '1.0.0',
  downloadUrl: null,
  status: 'idle',
  ...overrides,
})

const defaultProps = {
  checking: false,
  onOpenSettings: vi.fn(),
  onCheckUpdates: vi.fn(),
  onOpenInfo: vi.fn(),
}

describe('AppList — Update All button', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show Update All when fewer than 2 apps have updates', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0' }),
      makeState('axiforge'),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('shows Update All when 2 or more apps have updates', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    expect(screen.getByRole('button', { name: /update all/i })).toBeInTheDocument()
  })

  it('does not count busy apps (downloading) as eligible', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0', status: 'downloading' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    // Only 1 eligible (axibridge is busy) — button must not appear
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('does not count installing apps as eligible', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0', status: 'installing' }),
      makeState('axiforge', { latestVersion: '2.0.0', status: 'installing' }),
      makeState('axipulse', { latestVersion: '2.0.0' }),
    ]
    render(<AppList states={states} {...defaultProps} />)
    // Only 1 eligible — button must not appear
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('does not count deleting apps as eligible', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0', status: 'deleting' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    expect(screen.queryByRole('button', { name: /update all/i })).not.toBeInTheDocument()
  })

  it('calls window.axiom.install for each eligible app on click', () => {
    const states = [
      makeState('axibridge', { latestVersion: '2.0.0' }),
      makeState('axiforge', { latestVersion: '2.0.0' }),
      makeState('axipulse'),
    ]
    render(<AppList states={states} {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /update all/i }))
    expect(window.axiom.install).toHaveBeenCalledWith('axibridge')
    expect(window.axiom.install).toHaveBeenCalledWith('axiforge')
    expect(window.axiom.install).toHaveBeenCalledTimes(2)
  })
})
