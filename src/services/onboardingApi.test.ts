import { describe, it, expect, vi, beforeEach } from 'vitest'
import { submitOnboardingApplication } from './onboardingApi'
import type { OnboardingDraft } from '../hooks/useOnboardingDraft'
import type { FileMap } from '../pages/onboarding/DocumentUploadStep'

const sampleDraft: OnboardingDraft = {
  step: 6,
  business: {
    legalName: 'Acme Corp',
    registrationNumber: 'RC-12345',
    country: 'USA',
    businessType: 'LLC',
    website: 'https://acme.com',
  },
  owner: {
    fullName: 'Jane Doe',
    dateOfBirth: '1985-05-15',
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
    bankName: 'First Bank',
    accountNumber: '987654321',
    ibanSwift: 'FBUS123',
    currency: 'USD',
  },
}

describe('submitOnboardingApplication', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('submits multipart/form-data with draft, selfie, and document files on success', async () => {
    const selfieFile = new File(['selfie-content'], 'selfie.jpg', { type: 'image/jpeg' })
    const regFile = new File(['reg-content'], 'reg.pdf', { type: 'application/pdf' })
    const frontFile = new File(['front-content'], 'id-front.jpg', { type: 'image/jpeg' })
    const backFile = new File(['back-content'], 'id-back.jpg', { type: 'image/jpeg' })
    const proofFile = new File(['proof-content'], 'proof.pdf', { type: 'application/pdf' })

    const documentFiles: FileMap = {
      registrationCert: [regFile],
      govIdFront: [frontFile],
      govIdBack: [backFile],
      proofOfAddress: [proofFile],
    }

    let sentBody: FormData | null = null
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      sentBody = init?.body as FormData
      return new Response(JSON.stringify({ success: true, id: 'app-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await submitOnboardingApplication({
      draft: sampleDraft,
      selfieFile,
      documentFiles,
    })

    expect(result).toEqual({ success: true, id: 'app-123' })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/onboarding/submit', {
      method: 'POST',
      body: expect.any(FormData),
    })

    expect(sentBody).toBeInstanceOf(FormData)
    const draftString = sentBody!.get('draft')
    expect(typeof draftString).toBe('string')
    const parsedDraft = JSON.parse(draftString as string)
    expect(parsedDraft.status).toBe('pending_review')
    expect(parsedDraft.business.legalName).toBe('Acme Corp')

    expect(sentBody!.get('selfie')).toBe(selfieFile)
    expect(sentBody!.getAll('registrationCert')).toEqual([regFile])
    expect(sentBody!.getAll('govIdFront')).toEqual([frontFile])
    expect(sentBody!.getAll('govIdBack')).toEqual([backFile])
    expect(sentBody!.getAll('proofOfAddress')).toEqual([proofFile])
  })

  it('throws an error on 500 response', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      submitOnboardingApplication({
        draft: sampleDraft,
        selfieFile: null,
        documentFiles: { registrationCert: [], govIdFront: [], govIdBack: [], proofOfAddress: [] },
      })
    ).rejects.toThrow(/Submission failed with status 500/)
  })

  it('throws an error on network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      submitOnboardingApplication({
        draft: sampleDraft,
        selfieFile: null,
        documentFiles: { registrationCert: [], govIdFront: [], govIdBack: [], proofOfAddress: [] },
      })
    ).rejects.toThrow(/Network error/i)
  })

  it('throws an error on HTML 200 response (SPA rewrite)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('<!DOCTYPE html><html><body>Index</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      submitOnboardingApplication({
        draft: sampleDraft,
        selfieFile: null,
        documentFiles: { registrationCert: [], govIdFront: [], govIdBack: [], proofOfAddress: [] },
      })
    ).rejects.toThrow(/expected JSON response/i)
  })
})
