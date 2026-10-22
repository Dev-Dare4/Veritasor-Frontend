import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import ReviewSubmitStep from './ReviewSubmitStep'
import type { OnboardingDraft } from '../../hooks/useOnboardingDraft'

const mockDraft: OnboardingDraft = {
  version: 1,
  step: 6,
  business: {
    legalName: 'Acme Corp',
    registrationNumber: '123456789',
    country: 'United States',
    businessType: 'LLC',
    website: 'https://acme.com',
  },
  owner: {
    fullName: 'John Doe',
    dateOfBirth: '1990-01-01',
    nationality: 'American',
    addressLine1: '123 Main St',
    addressLine2: 'Apt 4B',
    city: 'New York',
    postalCode: '10001',
  },
  selfie: {
    captured: true,
    fileName: 'selfie.jpg',
  },
  documents: {
    registrationCert: ['cert.pdf'],
    govIdFront: ['front.jpg'],
    govIdBack: ['back.jpg'],
    proofOfAddress: ['utility.pdf'],
  },
  bank: {
    bankName: 'First Bank',
    accountNumber: '987654321',
    ibanSwift: 'FBUS33',
    currency: 'USD',
  },
}

describe('ReviewSubmitStep', () => {
  it('renders correctly with all information', () => {
    const onBack = vi.fn()
    const onSubmit = vi.fn()
    render(<ReviewSubmitStep draft={mockDraft} onBack={onBack} onSubmit={onSubmit} submitting={false} />)

    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('123456789')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('123 Main St, Apt 4B, New York, 10001')).toBeInTheDocument()
    expect(screen.getByText('Captured')).toBeInTheDocument()
    expect(screen.getByText('cert.pdf')).toBeInTheDocument()
    expect(screen.getByText('First Bank')).toBeInTheDocument()
  })

  it('hides sections with no data', () => {
    const emptyDraft = {
      ...mockDraft,
      business: { legalName: '', registrationNumber: '', country: '', businessType: '', website: '' }
    }
    const onBack = vi.fn()
    const onSubmit = vi.fn()
    render(<ReviewSubmitStep draft={emptyDraft} onBack={onBack} onSubmit={onSubmit} submitting={false} />)

    expect(screen.queryByText('Business details')).not.toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    const onSubmit = vi.fn()
    render(<ReviewSubmitStep draft={mockDraft} onBack={onBack} onSubmit={onSubmit} submitting={false} />)

    fireEvent.click(screen.getByText('← Back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('calls onSubmit when submit button is clicked', () => {
    const onBack = vi.fn()
    const onSubmit = vi.fn()
    render(<ReviewSubmitStep draft={mockDraft} onBack={onBack} onSubmit={onSubmit} submitting={false} />)

    fireEvent.click(screen.getByText('Submit application'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('disables buttons and shows Submitting... when submitting is true', () => {
    const onBack = vi.fn()
    const onSubmit = vi.fn()
    render(<ReviewSubmitStep draft={mockDraft} onBack={onBack} onSubmit={onSubmit} submitting={true} />)

    const backButton = screen.getByText('← Back')
    const submitButton = screen.getByText('Submitting…')

    expect(backButton).toBeDisabled()
    expect(submitButton).toBeDisabled()
  })

  it('displays "Not provided" for missing selfie', () => {
    const noSelfieDraft = {
      ...mockDraft,
      selfie: { captured: false, fileName: '' }
    }
    const onBack = vi.fn()
    const onSubmit = vi.fn()
    render(<ReviewSubmitStep draft={noSelfieDraft} onBack={onBack} onSubmit={onSubmit} submitting={false} />)

    expect(screen.getByText('Not provided')).toBeInTheDocument()
  })
})
