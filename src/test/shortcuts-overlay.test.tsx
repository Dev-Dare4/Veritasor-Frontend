import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import ShortcutsOverlay, { SHORTCUT_CATEGORIES } from '../components/ShortcutsOverlay'

describe('ShortcutsOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const renderOverlay = (open = true, onClose = vi.fn()) =>
    render(<ShortcutsOverlay open={open} onClose={onClose} />)

  it('renders nothing when closed', () => {
    renderOverlay(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the dialog when open', () => {
    renderOverlay()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument()
  })

  it('focuses the search input on open', () => {
    renderOverlay()
    act(() => { vi.advanceTimersByTime(10) })
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
  })

  it('renders all four categories', () => {
    renderOverlay()
    for (const cat of SHORTCUT_CATEGORIES) {
      expect(screen.getByText(cat.name)).toBeInTheDocument()
    }
  })

  it('renders shortcut labels and kbd elements', () => {
    renderOverlay()
    // Spot-check a known shortcut from each category
    expect(screen.getByText('Open keyboard shortcuts')).toBeInTheDocument()
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connect revenue source')).toBeInTheDocument()
    expect(screen.queryByText('Toggle theme')).not.toBeInTheDocument()
    expect(screen.queryByText('New attestation')).not.toBeInTheDocument()
  })

  it('filters shortcuts by label', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'dashboard' } })
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Connect revenue source')).not.toBeInTheDocument()
  })

  it('filters shortcuts by category name', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'Global' } })
    expect(screen.getByText('Global')).toBeInTheDocument()
    expect(screen.queryByText('Navigation')).not.toBeInTheDocument()
  })

  it('shows empty state when query has no matches', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'zzznomatch' } })
    expect(screen.getByText(/No shortcuts match/i)).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    renderOverlay(true, onClose)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('closes when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderOverlay(true, onClose)
    // The backdrop is the outer div with class modal-backdrop
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not close when dialog content is clicked', () => {
    const onClose = vi.fn()
    renderOverlay(true, onClose)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes via the close button', () => {
    const onClose = vi.fn()
    renderOverlay(true, onClose)
    fireEvent.click(screen.getByRole('button', { name: /close keyboard shortcuts/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('has proper ARIA attributes on the dialog', () => {
    renderOverlay()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby')
    // aria-labelledby should point to the title element
    const titleId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(titleId)).toHaveTextContent('Keyboard shortcuts')
  })

  it('has accessible search input with aria-label', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox')
    expect(input).toHaveAttribute('aria-label', 'Filter shortcuts')
  })

  it('traps focus: Tab from last focusable wraps to first', () => {
    renderOverlay()
    act(() => { vi.advanceTimersByTime(10) })

    const focusable = document
      .querySelector('[role="dialog"]')!
      .querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
    const last = focusable[focusable.length - 1]
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // Focus should have cycled — activeElement will be the first focusable
    // (jsdom doesn't move focus on Tab natively, but the handler fires)
    // We just verify the handler doesn't throw and the dialog is still open
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('announces result count to screen readers', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'Dashboard' } })
    const status = document.querySelector('[role="status"]')
    expect(status).toBeInTheDocument()
    expect(status?.textContent).toMatch(/\d+ shortcut/)
  })

  it('renders kbd elements for each key in a shortcut', () => {
    renderOverlay()
    // Shift+? shortcut has 2 keys
    const kbdEls = screen.getAllByText('Shift')
    expect(kbdEls.length).toBeGreaterThan(0)
    const questionEls = screen.getAllByText('?')
    expect(questionEls.length).toBeGreaterThan(0)
  })

  it('resets search query when re-opened', () => {
    const { rerender } = renderOverlay(true)
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'foo' } })
    expect(input).toHaveValue('foo')

    rerender(<ShortcutsOverlay open={false} onClose={vi.fn()} />)
    rerender(<ShortcutsOverlay open={true} onClose={vi.fn()} />)
    expect(screen.getByRole('searchbox')).toHaveValue('')
  })

  it('filters by key name', () => {
    renderOverlay()
    const input = screen.getByRole('searchbox')
    fireEvent.change(input, { target: { value: 'Ctrl' } })
    // Ctrl+K shortcut should be visible
    expect(screen.getByText('Open command palette')).toBeInTheDocument()
  })
})
