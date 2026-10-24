import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../components/ToastContext'
import ToastContainer from '../components/ToastContainer'
import { AttestationsProvider } from './attestations'
import Dashboard from '../pages/Dashboard'
import Attestations from '../pages/Attestations'
import AttestationDetail from '../pages/AttestationDetail'

describe('Dashboard attestation flow', () => {
  it('creates a run visible in the attestations list and detail page', async () => {
    render(
      <AttestationsProvider>
        <ToastProvider>
          <ToastContainer />
          <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attestations" element={<Attestations />} />
              <Route path="/attestations/:id" element={<AttestationDetail />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </AttestationsProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Trigger monthly revenue report' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm & Attest' }))
    expect(await screen.findByText('Attestation submitted successfully.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'View attestation history' }))
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /view details/i })).toHaveLength(4)
    })

    const newDetailLink = screen.getAllByRole('link', { name: /view details/i })[0]
    const newAttestationId = newDetailLink.getAttribute('href')?.split('/').pop()
    expect(newAttestationId).toMatch(/^att-/)
    fireEvent.click(newDetailLink)

    expect(await screen.findByRole('article', { name: new RegExp(newAttestationId!) })).toBeInTheDocument()
  })
})
