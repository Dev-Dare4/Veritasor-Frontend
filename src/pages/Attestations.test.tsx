import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Attestations from './Attestations'
import { ToastProvider } from '../components/ToastContext'
import { AttestationsProvider } from '../state/attestations'

function renderPage() {
  return render(
    <AttestationsProvider>
      <ToastProvider>
        <MemoryRouter>
          <Attestations />
        </MemoryRouter>
      </ToastProvider>
    </AttestationsProvider>,
  )
}

describe('Attestations Page', () => {
  it('renders heading and description', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Attestations')
    expect(screen.getByText(/merkle roots/i)).toBeInTheDocument()
  })

  it('renders list items with links to detail view', () => {
    renderPage()
    const links = screen.getAllByRole('link', { name: /view details/i })
    expect(links.length).toBeGreaterThanOrEqual(2)
    expect(links[0]).toHaveAttribute('href', '/attestations/att-001')
    expect(links[1]).toHaveAttribute('href', '/attestations/att-002')
  })

  it('shows status badges', () => {
    renderPage()
    expect(screen.getAllByText('Verified').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1)
  })

  it('renders a timeline list', () => {
    const { container } = renderPage()
    expect(container.querySelector('ol')).toBeInTheDocument()
    expect(container.querySelectorAll('li').length).toBeGreaterThanOrEqual(2)
  })

  it('has accessible article labels', () => {
    renderPage()
    const articles = screen.getAllByRole('article')
    expect(articles.length).toBeGreaterThanOrEqual(2)
  })

  it('renders a chart with success and failure trends', () => {
    renderPage()
    const chart = screen.getByRole('figure', { name: /attestation history/i })
    expect(chart).toBeInTheDocument()
    expect(screen.getAllByText(/success/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/failure/i).length).toBeGreaterThan(0)
  })

  it('exposes tabular data via the "View as table" toggle', () => {
    renderPage()
    const toggle = screen.getByRole('button', { name: /view as table/i })
    expect(toggle).toBeInTheDocument()
    toggle.click()
    expect(screen.getByRole('table', { name: /attestation history/i })).toBeInTheDocument()
  })

  it('supports keyboard navigation on chart data points', () => {
    renderPage()
    const chart = screen.getByRole('figure', { name: /attestation history/i })
    const focusable = chart.querySelectorAll('button, [tabindex], a')
    expect(focusable.length).toBeGreaterThan(0)
    focusable[0].focus()
    expect(focusable[0]).toHaveFocus()
  })
})
