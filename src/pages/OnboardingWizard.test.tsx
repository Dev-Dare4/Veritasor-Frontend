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

  it('recovers from a corrupt stored draft and renders a valid step', () => {
    localStorage.setItem(
      'veritasor_onboarding_draft',
      JSON.stringify({ step: 99, business: null }),
    )

    render(
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Business details' })).toBeInTheDocument()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
  })

  it('restores a step 5 draft with empty business details to step 1', () => {
    localStorage.setItem(
      'veritasor_onboarding_draft',
      JSON.stringify({ step: 5, business: null }),
    )

    render(
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Business details' })).toBeInTheDocument()
    expect(screen.getByText('1 / 6')).toBeInTheDocument()
  })

  it('starts over from a restored draft and clears storage', async () => {
    const user = userEvent.setup()
    localStorage.setItem(
      'veritasor_onboarding_draft',
      JSON.stringify({
        step: 3,
        business: {
          legalName: 'Acme Corp',
          registrationNumber: '12345',
          country: 'USA',
          businessType: 'LLC',
          website: '',
        },
        owner: {
          fullName: 'John Doe',
          dateOfBirth: '1990-01-01',
          nationality: 'American',
          addressLine1: '123 Main St',
          addressLine2: '',
          city: 'New York',
          postalCode: '10001',
        },
      }),
    )

    render(
      <MemoryRouter>
        <OnboardingWizard />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Selfie verification' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /start over/i }))

    expect(screen.getByRole('heading', { name: 'Business details' })).toBeInTheDocument()
    expect(localStorage.getItem('veritasor_onboarding_draft')).toBeNull()
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
    await user.type(screen.getByLabelText(/Address line 1/i), '123 Main St')
    await user.type(screen.getByLabelText(/City/i), 'New York')
    await user.type(screen.getByLabelText(/Postal code/i), '10001')
    await user.click(screen.getByRole('button', { name: /continue/i }))

    // --- STEP 3: Selfie ---
    expect(await screen.findByRole('heading', { name: 'Selfie verification' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /upload photo instead/i }))

    const selfieInput = screen.getByLabelText(/upload selfie photo/i)
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
    await user.selectOptions(screen.getByLabelText(/Settlement currency/i), 'USD')
    await user.type(screen.getByLabelText(/IBAN \/ SWIFT/i), 'US123456')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    
    // --- STEP 6: Review & Submit ---
    expect(await screen.findByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()
    
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    const submitBtn = screen.getByRole('button', { name: /submit application/i })
    await user.click(submitBtn)
    
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/onboarding/submit', expect.any(Object))
    
    const callBody = mockFetch.mock.calls[0][1].body as FormData
    expect(callBody).toBeInstanceOf(FormData)
    expect(callBody.get('selfie')).toBe(selfieFile)
    expect(callBody.getAll('registrationCert')).toEqual([fileRegistration])
    expect(callBody.getAll('govIdFront')).toEqual([fileGovFront])
    expect(callBody.getAll('govIdBack')).toEqual([fileGovBack])
    expect(callBody.getAll('proofOfAddress')).toEqual([fileProof])
    
    // Success Screen
    expect(await screen.findByRole('heading', { name: 'Verification in progress' })).toBeInTheDocument()
  })

  describe('submit failures and retry behavior', () => {
    const step6Draft = {
      step: 6,
      business: {
        legalName: 'Test Corp',
        registrationNumber: '12345',
        country: 'USA',
        businessType: 'LLC',
        website: '',
      },
      owner: {
        fullName: 'John Doe',
        dateOfBirth: '1990-01-01',
        nationality: 'American',
        addressLine1: '123 Main St',
        addressLine2: '',
        city: 'New York',
        postalCode: '10001',
      },
      selfie: {
        captured: true,
        fileName: 'selfie.jpg',
      },
      documents: {
        registrationCert: ['reg.pdf'],
        govIdFront: ['id-front.jpg'],
        govIdBack: ['id-back.jpg'],
        proofOfAddress: ['proof.pdf'],
      },
      bank: {
        bankName: 'Test Bank',
        accountNumber: '123456789',
        currency: 'USD',
        ibanSwift: 'US123456',
      },
    }

    it('stays on step 6, keeps draft in storage, and shows retry on 500 error', async () => {
      localStorage.setItem('veritasor_onboarding_draft', JSON.stringify(step6Draft))
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <OnboardingWizard />
        </MemoryRouter>
      )

      expect(await screen.findByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()

      const mockFetch = vi.fn().mockResolvedValue(
        new Response('Server Error', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/plain' },
        })
      )
      vi.stubGlobal('fetch', mockFetch)

      const submitBtn = screen.getByRole('button', { name: /submit application/i })
      await user.click(submitBtn)

      // Alert with role="alert" appears
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/Submission failed with status 500/i)

      // Stays on step 6
      expect(screen.getByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Verification in progress' })).not.toBeInTheDocument()

      // Draft remains in storage
      const savedDraft = JSON.parse(localStorage.getItem('veritasor_onboarding_draft') || '{}')
      expect(savedDraft.business?.legalName).toBe('Test Corp')

      // Retry button is available and works
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const retryBtn = screen.getByRole('button', { name: /retry/i })
      await user.click(retryBtn)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(await screen.findByRole('heading', { name: 'Verification in progress' })).toBeInTheDocument()
      expect(localStorage.getItem('veritasor_onboarding_draft')).toBeNull()
    })

    it('stays on step 6, keeps draft, and shows retry on network error', async () => {
      localStorage.setItem('veritasor_onboarding_draft', JSON.stringify(step6Draft))
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <OnboardingWizard />
        </MemoryRouter>
      )

      expect(await screen.findByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()

      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      vi.stubGlobal('fetch', mockFetch)

      const submitBtn = screen.getByRole('button', { name: /submit application/i })
      await user.click(submitBtn)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/Network error/i)
      expect(screen.getByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()

      const savedDraft = JSON.parse(localStorage.getItem('veritasor_onboarding_draft') || '{}')
      expect(savedDraft.business?.legalName).toBe('Test Corp')
    })

    it('stays on step 6, keeps draft, and shows retry on HTML 200 SPA rewrite response', async () => {
      localStorage.setItem('veritasor_onboarding_draft', JSON.stringify(step6Draft))
      const user = userEvent.setup()

      render(
        <MemoryRouter>
          <OnboardingWizard />
        </MemoryRouter>
      )

      expect(await screen.findByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()

      const mockFetch = vi.fn().mockResolvedValue(
        new Response('<!DOCTYPE html><html><body>Index</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        })
      )
      vi.stubGlobal('fetch', mockFetch)

      const submitBtn = screen.getByRole('button', { name: /submit application/i })
      await user.click(submitBtn)

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(/expected JSON response/i)
      expect(screen.getByRole('heading', { name: 'Review & submit' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()

      const savedDraft = JSON.parse(localStorage.getItem('veritasor_onboarding_draft') || '{}')
      expect(savedDraft.business?.legalName).toBe('Test Corp')
    })
  })
})
