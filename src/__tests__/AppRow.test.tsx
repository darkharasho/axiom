import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AppRow } from '../components/AppRow'
import type { AppState } from '@shared/types'

const baseState: AppState = {
  id: 'axibridge',
  installedVersion: '2.5.11',
  latestVersion: '2.5.11',
  downloadUrl: null,
  status: 'idle',
}

describe('AppRow', () => {
  it('shows Launch button when installed and up to date', () => {
    render(<AppRow state={baseState} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /launch/i })).toBeInTheDocument()
  })

  it('shows Update button when newer version available', () => {
    const state = { ...baseState, latestVersion: '2.6.0', downloadUrl: 'https://example.com/app.AppImage' }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
  })

  it('shows Install button when not installed', () => {
    const state = { ...baseState, installedVersion: null, downloadUrl: 'https://example.com/app.AppImage' }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument()
  })

  it('calls onAction with launch when Launch is clicked', () => {
    const onAction = vi.fn()
    render(<AppRow state={baseState} onAction={onAction} onInfo={vi.fn()} onRetry={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /launch/i }))
    expect(onAction).toHaveBeenCalledWith('launch', 'axibridge')
  })

  it('shows Invite button for axitools', () => {
    const state: AppState = { id: 'axitools', installedVersion: null, latestVersion: null, downloadUrl: null, status: 'idle' }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
  })

  it('shows progress bar when downloading', () => {
    const state = {
      ...baseState,
      status: 'downloading' as const,
      downloadProgress: { percent: 45, bytesReceived: 45000000, totalBytes: 100000000 },
    }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByText(/45\.0.*100\.0/)).toBeInTheDocument()
  })

  it('shows retry button when status is error', () => {
    const state: AppState = { ...baseState, status: 'error' }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={vi.fn()} />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('calls onRetry with appId when retry button clicked', () => {
    const onRetry = vi.fn()
    const state: AppState = { ...baseState, status: 'error' }
    render(<AppRow state={state} onAction={vi.fn()} onInfo={vi.fn()} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledWith('axibridge')
  })
})
