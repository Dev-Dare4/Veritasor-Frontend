import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'
import { ToastProvider } from '../components/ToastContext'
import { AttestationsProvider } from '../state/attestations'

function renderPage() {
  return render(
    <AttestationsProvider>
      <ToastProvider>
        <MemoryRouter><Dashboard /></MemoryRouter>
      </ToastProvider>
    </AttestationsProvider>,
  )
}

describe('Dashboard Page', () => {
  it('renders heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dashboard')
  })

  it('renders quick actions section', () => {
    const { container } = renderPage()
    expect(screen.getByRole('heading', { level: 2, name: /quick actions/i })).toBeInTheDocument()
    expect(container.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
  })

  it('renders trigger button', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /trigger monthly revenue report/i })).toBeInTheDocument()
  })

  it('has muted description text', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('[style*="var(--muted)"]').length).toBeGreaterThan(0)
  })

  // ─── Responsive class structure ──────────────────────────────

  it('renders dashboard-page wrapper', () => {
    const { container } = renderPage()
    expect(container.querySelector('.dashboard-page')).toBeInTheDocument()
  })

  it('renders dashboard-grid container', () => {
    const { container } = renderPage()
    expect(container.querySelector('.dashboard-grid')).toBeInTheDocument()
  })

  it('renders three dashboard-section cards', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.dashboard-section').length).toBe(3)
  })

  it('renders dashboard-metrics-grid', () => {
    const { container } = renderPage()
    expect(container.querySelector('.dashboard-metrics-grid')).toBeInTheDocument()
  })

  it('renders three dashboard-metric-card elements', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.dashboard-metric-card').length).toBe(3)
  })

  it('renders metric labels, values, and sub-labels', () => {
    const { container } = renderPage()
    expect(container.querySelector('.dashboard-metric-label')).toBeInTheDocument()
    expect(container.querySelector('.dashboard-metric-value')).toBeInTheDocument()
    expect(container.querySelector('.dashboard-metric-sub')).toBeInTheDocument()
  })

  it('renders dashboard-actions-list', () => {
    const { container } = renderPage()
    expect(container.querySelector('.dashboard-actions-list')).toBeInTheDocument()
  })

  // ─── Link and button accessibility ──────────────────────────

  it('renders connect source link with accessible label', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /open connect source wizard/i })).toBeInTheDocument()
  })

  it('connect source link has correct href', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /open connect source wizard/i })
    expect(link).toHaveAttribute('href', '/connect-source/provider')
  })

  // ─── Modal interaction ──────────────────────────────────────

  it('opens AttestationConfirmModal when trigger button is clicked', async () => {
    renderPage()
    const trigger = screen.getByRole('button', { name: /trigger monthly revenue report/i })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    trigger.click()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('closes modal via onClose', async () => {
    renderPage()
    screen.getByRole('button', { name: /trigger monthly revenue report/i }).click()
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    const closeBtn = screen.getByRole('button', { name: /close dialog/i })
    closeBtn.click()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

// ---------------------------------------------------------------------------
// Usage meters: USAGE_DATA → UsageMeter wiring and tier boundaries
// ---------------------------------------------------------------------------
//
// The Dashboard is the only consumer of `USAGE_DATA`, and the existing suite
// never asserts a single meter value, so a regression in the rounding or in the
// prop pass-through would go unnoticed.

describe('Dashboard Page – usage meters', () => {
  it('renders one progressbar per usage entry, keyed by label', () => {
    renderPage()

    const meters = screen.getAllByRole('progressbar')
    expect(meters).toHaveLength(2)
    expect(meters.map((m) => m.getAttribute('aria-label'))).toEqual([
      'Attestations',
      'API calls',
    ])
  })

  it('exposes the attestation usage as a critical (90%) meter', () => {
    renderPage()

    const meter = screen.getByRole('progressbar', { name: 'Attestations' })
    expect(meter).toHaveAttribute('aria-valuenow', '90')
    expect(meter).toHaveAttribute('aria-valuemin', '0')
    expect(meter).toHaveAttribute('aria-valuemax', '100')
    expect(meter).toHaveAttribute('aria-valuetext', '9 of 10 attestations used (90%)')
  })

  it('rounds API usage down to the warning boundary (75%), not the normal tier', () => {
    renderPage()

    const meter = screen.getByRole('progressbar', { name: 'API calls' })
    // 7_520 / 10_000 = 75.2 % → Math.round → 75, which is inclusive of "warning".
    expect(meter).toHaveAttribute('aria-valuenow', '75')
    expect(meter).toHaveAttribute('aria-valuetext', '7,520 of 10,000 calls used (75%)')
  })

  it('surfaces the critical advisory for the attestation meter only', () => {
    renderPage()

    const advisories = screen.getAllByRole('status')
    expect(advisories).toHaveLength(2)
    expect(advisories[0]).toHaveTextContent(/used 90 % or more of your monthly limit/i)
    expect(advisories[1]).toHaveTextContent(/used 75 % or more of your monthly limit/i)
  })

  it('renders the usage section under its labelled heading', () => {
    const { container } = renderPage()

    const section = container.querySelector('section[aria-labelledby="usage-heading"]')
    expect(section).not.toBeNull()
    expect(section!.querySelectorAll('[role="progressbar"]')).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Key metrics grid: copy and staggered entrance delays
// ---------------------------------------------------------------------------

describe('Dashboard Page – key metrics', () => {
  it('renders the three metric cards with their copy', () => {
    const { container } = renderPage()

    const grid = container.querySelector('.dashboard-metrics-grid')!
    const text = grid.textContent ?? ''

    expect(text).toContain('Total Revenue')
    expect(text).toContain('$84,320')
    expect(text).toContain('YTD 2026')

    expect(text).toContain('Attestations')
    expect(text).toContain('This month')

    expect(text).toContain('Revenue Sources')
    expect(text).toContain('Connected')

    expect(Array.from(grid.querySelectorAll('.dashboard-metric-value')).map((el) => el.textContent)).toEqual([
      '$84,320',
      '12',
      '3',
    ])
  })

  it('staggers card animations by 60ms in render order', () => {
    const { container } = renderPage()

    const cards = Array.from(container.querySelectorAll<HTMLElement>('.dashboard-metric-card'))
    expect(cards).toHaveLength(3)
    expect(cards.map((card) => card.style.transitionDelay)).toEqual(['0ms', '60ms', '120ms'])
    expect(cards.map((card) => card.style.animationDelay)).toEqual(['0ms', '60ms', '120ms'])
  })

  it('keeps cards in the pre-animation state until they intersect the viewport', () => {
    const { container } = renderPage()

    // The default IntersectionObserver polyfill never reports an intersection.
    expect(container.querySelectorAll('.dashboard-metric-card.chart-entrance-animate')).toHaveLength(0)
    container.querySelectorAll<HTMLElement>('.dashboard-metric-card').forEach((card) => {
      expect(card).toHaveClass('chart-entrance')
      expect(card.style.willChange).toBe('opacity, transform')
    })
  })

  it('applies the animate class once the viewport observer reports an intersection', () => {
    const original = globalThis.IntersectionObserver

    class ImmediateIntersectionObserver {
      root = null
      rootMargin = ''
      thresholds: number[] = []
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }

    ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
      ImmediateIntersectionObserver
    try {
      const { container } = renderPage()

      const animated = container.querySelectorAll<HTMLElement>(
        '.dashboard-metric-card.chart-entrance-animate',
      )
      expect(animated).toHaveLength(3)
      animated.forEach((card) => {
        expect(card.style.willChange).toBe('')
      })
      expect(container.querySelector('.dashboard-section.chart-entrance-animate')).not.toBeNull()
    } finally {
      ;(globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = original
    }
  })
})

// ---------------------------------------------------------------------------
// Modal lifecycle driven by the page's own state machine
// ---------------------------------------------------------------------------
//
// `handleConfirm` / `handleClose` live in Dashboard, but the existing suite only
// checks that the dialog opens and that the modal's own close button dismisses
// it. The confirm path — which must clear the loading flag and close — is
// untested.

describe('Dashboard Page – attestation modal lifecycle', () => {
  async function openModal() {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /trigger monthly revenue report/i }))
    return screen.findByRole('dialog')
  }

  it('passes the demo attestation details into the dialog', async () => {
    const dialog = await openModal()

    expect(dialog).toHaveTextContent('Stripe (live)')
    expect(dialog).toHaveTextContent('May 2026')
    expect(dialog).toHaveTextContent('1,247 transactions')
    expect(dialog).toHaveTextContent('0x4a2f8c3d1e6b9f0a…')
  })

  it('closes the dialog after a successful confirm', async () => {
    await openModal()

    const confirm = screen.getByRole('button', { name: /confirm & attest/i })
    expect(confirm).toBeEnabled()
    expect(confirm).toHaveAttribute('aria-busy', 'false')

    fireEvent.click(confirm)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes the dialog from the Cancel button', async () => {
    await openModal()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes the dialog on Escape', async () => {
    await openModal()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('closes the dialog when the backdrop is clicked', async () => {
    const dialog = await openModal()

    fireEvent.click(dialog.parentElement!)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('does not close when a click lands inside the dialog', async () => {
    const dialog = await openModal()

    fireEvent.click(dialog)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('can be reopened after being dismissed', async () => {
    await openModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /trigger monthly revenue report/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
