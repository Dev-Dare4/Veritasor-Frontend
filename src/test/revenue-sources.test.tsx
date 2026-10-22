/**
 * Tests for drag-and-drop reorder affordances in RevenueSources.
 */

import { MemoryRouter } from 'react-router-dom'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { describe, expect, it, afterEach, beforeEach } from 'vitest'
import { ToastProvider } from '../components/ToastContext'
import RevenueSources from '../pages/RevenueSources'
import { LocaleProvider } from '../i18n/provider'
import { sourcesStore } from '../store/sourcesStore'

afterEach(() => cleanup())

beforeEach(() => {
  localStorage.clear()
  sourcesStore.reset()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <LocaleProvider>
        <ToastProvider>
          <RevenueSources />
        </ToastProvider>
      </LocaleProvider>
    </MemoryRouter>,
  )
}

function getHandles() { return screen.getAllByTestId('drag-handle') }
function getItems() { return screen.getAllByRole('listitem') }
function getAnnouncement() { return screen.getByTestId('dnd-announcement') }

// ---------------------------------------------------------------------------
// Page structure
// ---------------------------------------------------------------------------

describe('RevenueSources — page structure', () => {
  it('renders the heading and description', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /revenue sources/i })).toBeInTheDocument()
    expect(screen.getByText(/connected integrations/i)).toBeInTheDocument()
  })

  it('renders the sources list', () => {
    renderPage()
    expect(screen.getByRole('list', { name: /connected revenue sources/i })).toBeInTheDocument()
  })

  it('renders all three mock sources', () => {
    renderPage()
    expect(screen.getAllByText('Stripe').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Shopify').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('QuickBooks').length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Drag handles
// ---------------------------------------------------------------------------

describe('RevenueSources — drag handles', () => {
  it('renders one drag handle per source', () => {
    renderPage()
    expect(getHandles()).toHaveLength(3)
  })

  it('handles have accessible aria-label including provider name', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /reorder stripe/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reorder shopify/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reorder quickbooks/i })).toBeInTheDocument()
  })

  it('handle aria-pressed is false when not grabbed', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /reorder stripe/i })).toHaveAttribute('aria-pressed', 'false')
  })
})

// ---------------------------------------------------------------------------
// Row aria attributes
// ---------------------------------------------------------------------------

describe('RevenueSources — row aria attributes', () => {
  it('each row has aria-label with priority position', () => {
    renderPage()
    expect(screen.getByRole('listitem', { name: /stripe, priority 1 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /shopify, priority 2 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /quickbooks, priority 3 of 3/i })).toBeInTheDocument()
  })

  it('rows do not have aria-grabbed when idle', () => {
    renderPage()
    for (const item of getItems()) expect(item).not.toHaveAttribute('aria-grabbed')
  })
})

// ---------------------------------------------------------------------------
// aria-live announcement region
// ---------------------------------------------------------------------------

describe('RevenueSources — aria-live region', () => {
  it('renders the announcement region', () => {
    renderPage()
    const region = getAnnouncement()
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
  })

  it('announcement region is visually hidden', () => {
    renderPage()
    expect(getAnnouncement()).toHaveStyle({ position: 'absolute' })
  })

  it('is empty initially', () => {
    renderPage()
    expect(getAnnouncement().textContent).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Keyboard reorder
// ---------------------------------------------------------------------------

describe('RevenueSources — keyboard grab/release', () => {
  it('clicking handle activates grab and announces it', () => {
    renderPage()
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    fireEvent.click(stripeHandle)
    expect(screen.getByRole('button', { name: /release stripe/i })).toBeInTheDocument()
    expect(stripeHandle).toHaveAttribute('aria-pressed', 'true')
    expect(getAnnouncement().textContent).toMatch(/stripe.*grabbed/i)
    expect(getAnnouncement().textContent).toMatch(/arrow keys/i)
  })

  it('clicking handle again drops it in place', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder stripe/i }))
    fireEvent.click(screen.getByRole('button', { name: /release stripe/i }))
    expect(screen.getByRole('button', { name: /reorder stripe/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/dropped in place/i)
  })
})

describe('RevenueSources — keyboard ArrowDown reorder', () => {
  it('ArrowDown moves the grabbed item down', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder stripe/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release stripe/i }), { key: 'ArrowDown' })
    expect(screen.getByRole('listitem', { name: /stripe, priority 2 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /shopify, priority 1 of 3/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/moved to position 2/i)
  })

  it('ArrowDown is no-op at the last position', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder quickbooks/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release quickbooks/i }), { key: 'ArrowDown' })
    expect(screen.getByRole('listitem', { name: /quickbooks, priority 3 of 3/i })).toBeInTheDocument()
  })
})

describe('RevenueSources — keyboard ArrowUp reorder', () => {
  it('ArrowUp moves the grabbed item up', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder shopify/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release shopify/i }), { key: 'ArrowUp' })
    expect(screen.getByRole('listitem', { name: /shopify, priority 1 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /stripe, priority 2 of 3/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/moved to position 1/i)
  })

  it('ArrowUp is no-op at the first position', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder stripe/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release stripe/i }), { key: 'ArrowUp' })
    expect(screen.getByRole('listitem', { name: /stripe, priority 1 of 3/i })).toBeInTheDocument()
  })
})

describe('RevenueSources — keyboard Enter/Space drop', () => {
  it('Enter drops the item', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder stripe/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release stripe/i }), { key: 'Enter' })
    expect(screen.getByRole('button', { name: /reorder stripe/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/dropped at position/i)
  })

  it('Space drops the item', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder shopify/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release shopify/i }), { key: ' ' })
    expect(screen.getByRole('button', { name: /reorder shopify/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/dropped at position/i)
  })
})

describe('RevenueSources — keyboard Escape cancel', () => {
  it('Escape cancels reorder', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /reorder stripe/i }))
    fireEvent.keyDown(screen.getByRole('button', { name: /release stripe/i }), { key: 'Escape' })
    expect(screen.getByRole('button', { name: /reorder stripe/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/cancel/i)
  })
})

describe('RevenueSources — keyboard non-grab keys are no-ops', () => {
  it('arrow keys do nothing without grab', () => {
    renderPage()
    fireEvent.keyDown(screen.getByRole('button', { name: /reorder stripe/i }), { key: 'ArrowDown' })
    expect(screen.getByRole('listitem', { name: /stripe, priority 1 of 3/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Pointer drag reorder
// ---------------------------------------------------------------------------

describe('RevenueSources — pointer drag reorder', () => {
  it('pointerdown on handle sets grabbed state', () => {
    renderPage()
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    fireEvent.pointerDown(stripeHandle)
    expect(stripeHandle).toHaveAttribute('aria-pressed', 'true')
    expect(getAnnouncement().textContent).toMatch(/grabbed stripe/i)
  })

  it('pointerup without pointerenter resets grabbed state', () => {
    renderPage()
    const list = screen.getByRole('list', { name: /connected revenue sources/i })
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    fireEvent.pointerDown(stripeHandle)
    fireEvent.pointerUp(list)
    expect(stripeHandle).toHaveAttribute('aria-pressed', 'false')
    expect(getAnnouncement().textContent).toMatch(/drop cancelled/i)
  })

  it('pointerdown → pointerenter → pointerup reorders', () => {
    renderPage()
    const list = screen.getByRole('list', { name: /connected revenue sources/i })
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    const shopifyRow = screen.getByRole('listitem', { name: /shopify, priority 2 of 3/i })
    fireEvent.pointerDown(stripeHandle)
    fireEvent.pointerEnter(shopifyRow)
    fireEvent.pointerUp(list)
    expect(screen.getByRole('listitem', { name: /shopify, priority 1 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /stripe, priority 2 of 3/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/moved to position 2/i)
  })

  it('drop-target row gets drop-target visual while dragging', () => {
    renderPage()
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    const shopifyRow = screen.getByRole('listitem', { name: /shopify, priority 2 of 3/i })
    fireEvent.pointerDown(stripeHandle)
    fireEvent.pointerEnter(shopifyRow)
    expect(shopifyRow).toHaveStyle({ border: '2px dashed rgba(94,234,212,0.6)' })
  })

  it('pointerleave on the list cancels the drag', () => {
    renderPage()
    const list = screen.getByRole('list', { name: /connected revenue sources/i })
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    fireEvent.pointerDown(stripeHandle)
    fireEvent.pointerLeave(list)
    expect(screen.getByRole('listitem', { name: /stripe, priority 1 of 3/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

describe('RevenueSources — status badges', () => {
  it('shows Healthy badge for Stripe', () => { renderPage(); expect(screen.getByLabelText('Health status: Healthy')).toBeInTheDocument() })
  it('shows Warning badge for Shopify', () => { renderPage(); expect(screen.getByLabelText('Health status: Warning')).toBeInTheDocument() })
  it('shows Error badge for QuickBooks', () => { renderPage(); expect(screen.getByLabelText('Health status: Error')).toBeInTheDocument() })
})

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

describe('RevenueSources — actions', () => {
  function getSourcesList() { return screen.getByRole('list', { name: /connected revenue sources/i }) }

  it('renders Disconnect buttons for all sources', () => {
    renderPage()
    expect(within(getSourcesList()).getAllByRole('button', { name: /disconnect/i }).length).toBe(3)
  })

  it('renders Reconnect buttons only for non-healthy sources', () => {
    renderPage()
    expect(within(getSourcesList()).getAllByRole('button', { name: /reconnect/i }).length).toBe(2)
  })

  it('reconnect updates status to Healthy', () => {
    renderPage()
    const list = getSourcesList()
    fireEvent.click(within(list).getByRole('button', { name: /reconnect shopify/i }))
    expect(within(list).queryByRole('button', { name: /reconnect shopify/i })).toBeNull()
    expect(within(list).getAllByRole('button', { name: /reconnect/i }).length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Disconnect confirmation dialog
// ---------------------------------------------------------------------------

function confirmDisconnect(provider: string) {
  const dialog = screen.getByRole('dialog')
  const input = within(dialog).getByRole('textbox')
  fireEvent.change(input, { target: { value: provider } })
  fireEvent.click(within(dialog).getByRole('button', { name: new RegExp(`^disconnect ${provider}$`, 'i') }))
}

describe('RevenueSources — disconnect confirmation', () => {
  it('opens confirmation dialog when Disconnect is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /disconnect stripe/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/disconnect stripe\?/i)).toBeInTheDocument()
  })

  it('dialog describes the consequence', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /disconnect stripe/i }))
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument()
  })

  it('Cancel closes the dialog without removing the source', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /disconnect stripe/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByText('Stripe').length).toBeGreaterThanOrEqual(1)
  })

  it('Disconnect confirm removes the source from the list', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /disconnect stripe/i }))
    confirmDisconnect('Stripe')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('Stripe')).toBeNull()
    expect(screen.getAllByText('Shopify').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when all sources are disconnected', () => {
    renderPage()
    for (const provider of ['Stripe', 'Shopify', 'QuickBooks']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`disconnect ${provider}`, 'i') }))
      confirmDisconnect(provider)
    }
    expect(screen.getByRole('region', { name: /no sources connected/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Accessibility attributes
// ---------------------------------------------------------------------------

describe('RevenueSources — accessibility attributes', () => {
  it('dialog has aria-modal and aria-labelledby', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /disconnect stripe/i }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-desc')
  })

  it('last sync uses a <time> element', () => {
    renderPage()
    expect(document.querySelectorAll('time').length).toBeGreaterThanOrEqual(1)
  })

  it('drag handles have touchAction none for touch devices', () => {
    renderPage()
    expect(screen.getByRole('list', { name: /connected revenue sources/i })).toHaveStyle({ touchAction: 'none' })
  })

  it('handles have type="button"', () => {
    renderPage()
    for (const handle of getHandles()) expect(handle).toHaveAttribute('type', 'button')
  })
})

// ---------------------------------------------------------------------------
// Edge case: single item
// ---------------------------------------------------------------------------

describe('RevenueSources — single item edge case', () => {
  it('ArrowUp and ArrowDown are no-ops with a single item remaining', () => {
    renderPage()
    for (const provider of ['Shopify', 'QuickBooks']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`disconnect ${provider}`, 'i') }))
      confirmDisconnect(provider)
    }
    const stripeHandle = screen.getByRole('button', { name: /reorder stripe/i })
    fireEvent.click(stripeHandle)
    fireEvent.keyDown(screen.getByRole('button', { name: /release stripe/i }), { key: 'ArrowDown' })
    expect(screen.getByRole('listitem', { name: /stripe, priority 1 of 1/i })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: /release stripe/i }), { key: 'ArrowUp' })
    expect(screen.getByRole('listitem', { name: /stripe, priority 1 of 1/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Per-row move-up/move-down controls
// ---------------------------------------------------------------------------

describe('RevenueSources — move-up button', () => {
  it('move-up is hidden on first item, visible on others', () => {
    renderPage()
    expect(screen.getByTestId('move-up-0')).toHaveStyle({ visibility: 'hidden' })
    expect(screen.getByTestId('move-up-1')).toHaveStyle({ visibility: 'visible' })
    expect(screen.getByTestId('move-up-2')).toHaveStyle({ visibility: 'visible' })
  })

  it('clicking move-up on Shopify moves it above Stripe', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('move-up-1'))
    expect(screen.getByRole('listitem', { name: /shopify, priority 1 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /stripe, priority 2 of 3/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/moved up/i)
  })
})

describe('RevenueSources — move-down button', () => {
  it('move-down is visible on first items, hidden on last', () => {
    renderPage()
    expect(screen.getByTestId('move-down-0')).toHaveStyle({ visibility: 'visible' })
    expect(screen.getByTestId('move-down-1')).toHaveStyle({ visibility: 'visible' })
    expect(screen.getByTestId('move-down-2')).toHaveStyle({ visibility: 'hidden' })
  })

  it('clicking move-down on Stripe moves it below Shopify', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('move-down-0'))
    expect(screen.getByRole('listitem', { name: /shopify, priority 1 of 3/i })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /stripe, priority 2 of 3/i })).toBeInTheDocument()
    expect(getAnnouncement().textContent).toMatch(/moved down/i)
  })
})

describe('RevenueSources — move buttons respect list boundaries after reorder', () => {
  it('move-up becomes available on former first item after it is moved down', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('move-down-0'))
    expect(screen.getByTestId('move-up-1')).toHaveStyle({ visibility: 'visible' })
    expect(screen.getByTestId('move-up-0')).toHaveStyle({ visibility: 'hidden' })
  })

  it('move-down becomes visible on former last item after it is moved up', () => {
    renderPage()
    fireEvent.click(screen.getByTestId('move-up-2'))
    expect(screen.getByTestId('move-down-1')).toHaveStyle({ visibility: 'visible' })
    expect(screen.getByTestId('move-down-2')).toHaveStyle({ visibility: 'hidden' })
  })
})
