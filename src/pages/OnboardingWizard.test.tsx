import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import OnboardingWizard from './OnboardingWizard'

// Mock fetch
global.fetch = vi.fn()

// Mock requestAnimationFrame
vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
  cb(0)
  return 0
})
vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})

describe('OnboardingWizard', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders step 1 and validates required fields', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Business details' })).toBeInTheDocument()

    const continueBtn = screen.getByRole('button', { name: /continue/i })
    await user.click(continueBtn)

    expect(screen.getByText('Legal name is required')).toBeInTheDocument()
    expect(screen.getByText('Registration number is required')).toBeInTheDocument()
    expect(screen.getByText('Country is required')).toBeInTheDocument()
    expect(screen.getByText('Business type is required')).toBeInTheDocument()
  })

  it('can complete the primary state transitions and submit', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    )

    // --- STEP 1: Business Details ---
    await user.type(screen.getByLabelText(/Legal business name/i), 'Test Corp')
    await user.type(screen.getByLabelText(/Registration number/i), '12345')
    await user.type(screen.getByLabelText(/Country of incorporation/i), 'USA')
    await user.click(screen.getByRole('radio', { name: /LLC/i }))
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // --- STEP 2: Owner Details ---
    expect(await screen.findByRole('heading', { name: 'Owner / Director' })).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Full legal name/i), 'John Doe')
    await user.type(screen.getByLabelText(/Date of birth/i), '1990-01-01')
    await user.type(screen.getByLabelText(/Nationality/i), 'American')
    await user.type(screen.getByLabelText(/Street address, line 1/i), '123 Main St')
    await user.type(screen.getByLabelText(/City/i), 'New York')
    await user.type(screen.getByLabelText(/Postal \/ ZIP code/i), '10001')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // --- STEP 3: Selfie ---
    expect(await screen.findByRole('heading', { name: 'Selfie verification' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText('A selfie is required')).toBeInTheDocument()

    const selfieInput = screen.getByLabelText(/Take selfie or choose file/i)
    const selfieFile = new File(['hello'], 'selfie.jpg', { type: 'image/jpeg' })
    await user.upload(selfieInput, selfieFile)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // --- STEP 4: Documents ---
    expect(await screen.findByRole('heading', { name: 'Document upload' })).toBeInTheDocument()
    
    // Switch camera to upload fallback for ID captures
    const uploadInsteadBtns = screen.queryAllByRole('button', { name: /upload a file instead/i })
    for (const btn of uploadInsteadBtns) {
      await user.click(btn)
    }

    // Attempt continue without files
    await user.click(screen.getByRole('button', { name: /continue/i }))
    const errors = screen.getAllByText('This document is required')
    expect(errors.length).toBeGreaterThan(0)

    // Upload files
    const fileRegistration = new File(['data'], 'reg.pdf', { type: 'application/pdf' })
    const fileGovFront = new File(['data'], 'id-front.jpg', { type: 'image/jpeg' })
    const fileGovBack = new File(['data'], 'id-back.jpg', { type: 'image/jpeg' })
    const fileProof = new File(['data'], 'proof.pdf', { type: 'application/pdf' })

    const regInput = container.querySelector('#ob-drop-registrationCert') as HTMLInputElement
    const frontInput = container.querySelector('#idc-file-govIdFront') as HTMLInputElement
    const backInput = container.querySelector('#idc-file-govIdBack') as HTMLInputElement
    const proofInput = container.querySelector('#ob-drop-proofOfAddress') as HTMLInputElement

    if (regInput) {
      Object.defineProperty(regInput, 'files', { value: [fileRegistration] })
      fireEvent.change(regInput)
    }

    if (frontInput) {
      Object.defineProperty(frontInput, 'files', { value: [fileGovFront] })
      fireEvent.change(frontInput)
    }

    if (backInput) {
      Object.defineProperty(backInput, 'files', { value: [fileGovBack] })
      fireEvent.change(backInput)
    }

    if (proofInput) {
      Object.defineProperty(proofInput, 'files', { value: [fileProof] })
      fireEvent.change(proofInput)
    }

    await user.click(screen.getByRole('button', { name: /continue/i }))
    
    // --- STEP 5: Bank Details ---
    await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Bank & payout details' })).toBeInTheDocument()
    })

    await user.type(screen.getByLabelText(/Bank name/i), 'Test Bank')
    await user.type(screen.getByLabelText(/Account number/i), '123456789')
    await user.type(screen.getByLabelText(/Currency/i), 'USD')
    await user.type(screen.getByLabelText(/IBAN \/ SWIFT/i), 'US123456')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    
    // --- STEP 6: Review & Submit ---
    expect(await screen.findByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()
    
    const submitBtn = screen.getByRole('button', { name: /submit application/i })
    await user.click(submitBtn)
    
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(global.fetch).toHaveBeenCalledWith('/api/onboarding/submit', expect.any(Object))
    
    // Success Screen
    expect(await screen.findByRole('heading', { name: 'Verification in progress' })).toBeInTheDocument()
  })
})
