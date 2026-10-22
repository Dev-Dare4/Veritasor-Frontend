import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AttestationDetail from './AttestationDetail'
import { AttestationsProvider } from '../state/attestations'

function renderDetail(path: string) {
  return render(
    <AttestationsProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/attestations" element={<AttestationDetail />} />
          <Route path="/attestations/:id" element={<AttestationDetail />} />
        </Routes>
      </MemoryRouter>
    </AttestationsProvider>,
  )
}

describe('AttestationDetail', () => {
  it('reports when the route does not provide an attestation ID', () => {
    renderDetail('/attestations')

    expect(screen.getByRole('alert')).toHaveTextContent('No attestation ID provided.')
  })

  it('shows a not-found state for an unknown attestation ID', () => {
    renderDetail('/attestations/missing-id')

    expect(screen.getByRole('alert')).toHaveTextContent('Attestation missing-id was not found.')
    expect(screen.getByRole('link', { name: 'Attestations' })).toHaveAttribute('href', '/attestations')
  })

  it('renders the verified certificate and completed lifecycle', () => {
    renderDetail('/attestations/att-001')

    expect(screen.getByRole('article', { name: /att-001/i })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Status: verified')).toHaveLength(2)
    expect(screen.getByText('84,320.00')).toBeInTheDocument()
    expect(screen.getByLabelText('Finalized - Completed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /stellar expert/i })).toHaveAttribute(
      'href',
      expect.stringContaining('a1b2c3d4'),
    )
  })

  it('shows the pending state and makes the queued timeline step current', () => {
    renderDetail('/attestations/att-002')

    expect(screen.getAllByLabelText('Status: pending on-chain confirmation')).toHaveLength(2)
    expect(screen.getByText('Queued').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByLabelText('Verifying - Pending')).toBeInTheDocument()
  })

  it('shows failure details and marks verification failed in the timeline', () => {
    renderDetail('/attestations/att-003')

    expect(screen.getByRole('heading', { name: 'Attestation Failed' })).toBeInTheDocument()
    const failureBanner = screen.getByRole('region', { name: 'Attestation Failed' })
    expect(within(failureBanner).getByText(/Stellar network timeout/)).toBeInTheDocument()
    expect(within(failureBanner).getByText(/Verify network connectivity and retry/)).toBeInTheDocument()
    expect(screen.getAllByLabelText('Status: validation failed')).toHaveLength(2)
    expect(screen.getByLabelText('Queued - Failed')).toBeInTheDocument()
    expect(screen.getByText(/^Verification failed: Stellar network timeout/)).toBeInTheDocument()
  })

  it('prints the certificate and confirms before retrying a failure', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderDetail('/attestations/att-003')
    fireEvent.click(screen.getByRole('button', { name: 'Print certificate' }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry Attestation' }))

    expect(print).toHaveBeenCalledOnce()
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to retry this failed attestation?')
    print.mockRestore()
    confirm.mockRestore()
  })
})
