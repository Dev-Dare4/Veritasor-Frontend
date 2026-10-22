import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EnvironmentProvider } from '../context/EnvironmentContext'
import AttestationDetail from './AttestationDetail'
import { ToastProvider } from '../components/ToastContext'

function renderDetail(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/attestations" element={<AttestationDetail />} />
          <Route path="/attestations/:id" element={<AttestationDetail />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  )
}

describe('AttestationDetail', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

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

    expect(screen.getByRole('article', { name: /att-001/i })).toBeInDocument()
    expect(screen.getAllByLabelText('Status: verified')).toHaveLength(2)
    expect(screen.getByText('84,320.00')).toBeInDocument()
    expect(screen.getByLabelText('Finalized - Completed')).toBeInDocument()
    expect(screen.getByRole('link', { name: /stellar expert/i })).toHaveAttribute(
      'href',
      expect.stringContaining('a1b2c3d4'),
    )
  })

  it('uses the testnet explorer path on testnet', () => {
    window.localStorage.setItem('environment', 'testnet')
    renderDetail('/attestations/att-001')

    expect(screen.getByRole('link', { name: /stellar expert/i })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/testnet/tx/a1b2c3d4',
    )
  })

  it('uses the public explorer path on mainnet', () => {
    window.localStorage.setItem('environment', 'mainnet')
    renderDetail('/attestations/att-001')

    expect(screen.getByRole('link', { name: /stellar expert/i })).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/tx/a1b2c3d4',
    )
  })

  it('shows the pending state and makes the queued timeline step current', () => {
    renderDetail('/attestations/att-002')

    expect(screen.getAllByLabelText('Status: pending on-chain confirmation')).toHaveLength(2)
    expect(screen.getByText('Queued').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getByLabelText('Verifying - Pending')).toBeInDocument()
  })

  it('shows failure details and marks verification failed in the timeline', () => {
    renderDetail('/attestations/att-003')

    expect(screen.getByRole('heading', { name: 'Attestation Failed' })).toBeInDocument()
    const failureBanner = screen.getByRole('region', { name: 'Attestation Failed' })
    expect(within(failureBanner).getByText(/Stellar network timeout/)).toBeInDocument()
    expect(within(failureBanner).getByText(/Verify network connectivity and retry/)).toBeInDocument()
    expect(screen.getAllByLabelText('Status: validation failed')).toHaveLength(2)
    expect(screen.getByLabelText('Queued - Failed')).toBeInDocument()
    expect(screen.getByText(/^Verification failed: Stellar network timeout/)).toBeInDocument()
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

  // ── Share proof button ────────────────────────────────────────────────────

  it('shows an enabled "Share proof" button for verified attestations', () => {
    renderDetail('/attestations/att-001')

    const shareBtn = screen.getByRole('button', { name: /share proof/i })
    expect(shareBtn).toBeInTheDocument()
    expect(shareBtn).not.toBeDisabled()
  })

  it('shows a disabled "Share proof" button for pending attestations', () => {
    renderDetail('/attestations/att-002')

    const shareBtn = screen.getByRole('button', { name: /share proof/i })
    expect(shareBtn).toBeDisabled()
    // accessible name includes the reason
    expect(shareBtn).toHaveAccessibleName(/not available for pending/i)
  })

  it('shows a disabled "Share proof" button for failed attestations', () => {
    renderDetail('/attestations/att-003')

    const shareBtn = screen.getByRole('button', { name: /share proof/i })
    expect(shareBtn).toBeDisabled()
    expect(shareBtn).toHaveAccessibleName(/not available for failed/i)
  })

  // ── Modal open / close / focus ────────────────────────────────────────────

  it('opens the share modal when the button is clicked on a verified attestation', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /share proof/i }))

    expect(screen.getByRole('dialog', { name: /share attestation proof/i })).toBeInTheDocument()
  })

  it('closes the modal with Escape and returns focus to the Share proof button', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    const shareBtn = screen.getByRole('button', { name: /share proof/i })
    await user.click(shareBtn)

    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(document.activeElement).toBe(shareBtn)
  })

  it('closes the modal with the close button and returns focus to the Share proof button', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    const shareBtn = screen.getByRole('button', { name: /share proof/i })
    await user.click(shareBtn)

    await user.click(screen.getByRole('button', { name: 'Close modal' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(document.activeElement).toBe(shareBtn)
  })

  // ── Password validation ────────────────────────────────────────────────────

  it('prevents link generation with an empty password in password-protected mode', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    await user.click(screen.getByRole('button', { name: /share proof/i }))
    await user.click(screen.getByLabelText('Password Protected'))
    // leave password empty
    await user.click(screen.getByRole('button', { name: 'Generate Link' }))

    expect(screen.queryByLabelText('Generated link')).not.toBeInTheDocument()
  })

  it('prevents link generation with a weak password in password-protected mode', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    await user.click(screen.getByRole('button', { name: /share proof/i }))
    await user.click(screen.getByLabelText('Password Protected'))
    await user.type(screen.getByLabelText('Password'), 'weak')
    await user.click(screen.getByRole('button', { name: 'Generate Link' }))

    expect(screen.queryByLabelText('Generated link')).not.toBeInTheDocument()
  })

  it('generates a deterministic share link for a public attestation', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    await user.click(screen.getByRole('button', { name: /share proof/i }))
    await user.click(screen.getByRole('button', { name: 'Generate Link' }))

    const linkInput = screen.getByLabelText('Generated link') as HTMLInputElement
    expect(linkInput.value).toContain('att-001')
    // must not be random — same ID must always produce same URL
    expect(linkInput.value).toBe(linkInput.value)
    expect(linkInput.value).toMatch(/^https:\/\/veritasor\.app\/proof\/att-001/)
  })

  it('generates a password-protected link when a strong password is provided', async () => {
    const user = userEvent.setup()
    renderDetail('/attestations/att-001')

    await user.click(screen.getByRole('button', { name: /share proof/i }))
    await user.click(screen.getByLabelText('Password Protected'))
    await user.type(screen.getByLabelText('Password'), 'StrongPass123!')
    await user.click(screen.getByRole('button', { name: 'Generate Link' }))

    const linkInput = screen.getByLabelText('Generated link') as HTMLInputElement
    expect(linkInput.value).toContain('protected=1')
  })
})
