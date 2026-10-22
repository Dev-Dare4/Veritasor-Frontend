/**
 * Focused behavior coverage for useOnboardingDraft (issue #640):
 * BusinessDetails, OwnerDetails, DocumentUpload, representative invalid
 * inputs, and the hook's primary state transitions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useOnboardingDraft } from './useOnboardingDraft'
import type {
  BankDetails,
  BusinessDetails,
  DocumentUpload,
  OnboardingDraft,
  OwnerDetails,
} from './useOnboardingDraft'

const STORAGE_KEY = 'veritasor_onboarding_draft'

const BUSINESS: BusinessDetails = {
  legalName: 'Acme Trading Ltd',
  registrationNumber: 'RC-1234567',
  country: 'NG',
  businessType: 'retail',
  website: 'https://acme.example',
}

const OWNER: OwnerDetails = {
  fullName: 'Ada Lovelace',
  dateOfBirth: '1990-01-02',
  nationality: 'NG',
  addressLine1: '1 Analytical Engine Way',
  addressLine2: 'Suite 5',
  city: 'Lagos',
  postalCode: '100001',
}

const DOCUMENTS: DocumentUpload = {
  registrationCert: ['cert.pdf'],
  govIdFront: ['front.jpg'],
  govIdBack: ['back.jpg'],
  proofOfAddress: ['bill.pdf', 'bill-2.pdf'],
}

const BANK: BankDetails = {
  bankName: 'Example Bank',
  accountNumber: '0123456789',
  ibanSwift: 'EXAMPLENG001',
  currency: 'NGN',
}

function readStored(): OnboardingDraft | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw ? (JSON.parse(raw) as OnboardingDraft) : null
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('useOnboardingDraft — initial state', () => {
  it('returns the empty default draft on a fresh install', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.step).toBe(1)
    expect(result.current.draft.business).toEqual({
      legalName: '',
      registrationNumber: '',
      country: '',
      businessType: '',
      website: '',
    })
    expect(result.current.draft.owner.fullName).toBe('')
    expect(result.current.draft.selfie).toEqual({ captured: false, fileName: '' })
    expect(result.current.draft.documents).toEqual({
      registrationCert: [],
      govIdFront: [],
      govIdBack: [],
      proofOfAddress: [],
    })
    expect(result.current.draft.bank).toEqual({
      bankName: '',
      accountNumber: '',
      ibanSwift: '',
      currency: '',
    })
  })

  it('does not report a savedAt timestamp when nothing was persisted', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.savedAt).toBeNull()
  })

  it('restores a persisted draft, merged over the defaults', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ step: 3, business: BUSINESS, owner: OWNER }),
    )

    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.step).toBe(3)
    expect(result.current.draft.business).toEqual(BUSINESS)
    expect(result.current.draft.owner).toEqual(OWNER)
    // Sections absent from the stored draft fall back to their defaults.
    expect(result.current.draft.bank).toEqual({
      bankName: '',
      accountNumber: '',
      ibanSwift: '',
      currency: '',
    })
  })

  it('marks savedAt when a draft already exists in storage', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ step: 2 }))

    const { result } = renderHook(() => useOnboardingDraft())

    await waitFor(() => expect(result.current.savedAt).not.toBeNull())
    expect(result.current.savedAt).toBeInstanceOf(Date)
  })

  it('falls back to the defaults when the stored draft is corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not-valid-json')

    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.step).toBe(1)
    expect(result.current.draft.business.legalName).toBe('')
  })
})

describe('useOnboardingDraft — setDraft partial merge', () => {
  it('merges a partial patch at the top level and keeps untouched sections', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft({ business: BUSINESS })
    })

    expect(result.current.draft.business).toEqual(BUSINESS)
    expect(result.current.draft.step).toBe(1)
    expect(result.current.draft.owner.fullName).toBe('')
  })

  it('persists the merged draft to localStorage and stamps savedAt', async () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft({ documents: DOCUMENTS })
    })

    await waitFor(() => expect(result.current.savedAt).not.toBeNull())
    expect(readStored()?.documents).toEqual(DOCUMENTS)
  })

  it('uses the updater form against the previous draft (wizard pattern)', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, business: BUSINESS, step: 2 }))
    })
    act(() => {
      result.current.setDraft(prev => ({ ...prev, owner: OWNER, step: 3 }))
    })

    expect(result.current.draft.step).toBe(3)
    expect(result.current.draft.business).toEqual(BUSINESS)
    expect(result.current.draft.owner).toEqual(OWNER)
  })
})

describe('useOnboardingDraft — BusinessDetails', () => {
  it('stores every BusinessDetails field', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, business: BUSINESS }))
    })

    expect(result.current.draft.business).toEqual(BUSINESS)
    expect(result.current.draft.business.website).toBe('https://acme.example')
  })

  it('advances the step while preserving the other sections', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, business: BUSINESS, step: 2 }))
    })

    expect(result.current.draft.step).toBe(2)
    expect(result.current.draft.documents).toEqual({
      registrationCert: [],
      govIdFront: [],
      govIdBack: [],
      proofOfAddress: [],
    })
  })
})

describe('useOnboardingDraft — OwnerDetails', () => {
  it('stores every OwnerDetails field', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, owner: OWNER, step: 3 }))
    })

    expect(result.current.draft.owner).toEqual(OWNER)
    expect(result.current.draft.owner.addressLine2).toBe('Suite 5')
  })

  it('accepts an empty optional second address line', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, owner: { ...OWNER, addressLine2: '' } }))
    })

    expect(result.current.draft.owner.addressLine2).toBe('')
  })
})

describe('useOnboardingDraft — DocumentUpload', () => {
  it('stores multiple file names per document field', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, documents: DOCUMENTS, step: 5 }))
    })

    expect(result.current.draft.documents).toEqual(DOCUMENTS)
    expect(result.current.draft.documents.proofOfAddress).toHaveLength(2)
  })

  it('allows clearing a document field back to an empty list', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, documents: DOCUMENTS }))
    })
    act(() => {
      result.current.setDraft(prev => ({
        ...prev,
        documents: { ...prev.documents, proofOfAddress: [] },
      }))
    })

    expect(result.current.draft.documents.proofOfAddress).toEqual([])
    expect(result.current.draft.documents.registrationCert).toEqual(['cert.pdf'])
  })
})

describe('useOnboardingDraft — BankDetails and persistence lifecycle', () => {
  it('stores BankDetails', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, bank: BANK, step: 6 }))
    })

    expect(result.current.draft.bank).toEqual(BANK)
    expect(result.current.draft.step).toBe(6)
  })

  it('round-trips the draft across a remount', () => {
    const first = renderHook(() => useOnboardingDraft())

    act(() => {
      first.result.current.setDraft(prev => ({ ...prev, business: BUSINESS, step: 2 }))
    })
    first.unmount()

    const second = renderHook(() => useOnboardingDraft())
    expect(second.result.current.draft.business).toEqual(BUSINESS)
    expect(second.result.current.draft.step).toBe(2)
  })

  it('clearDraft wipes storage and resets to the defaults', () => {
    const { result } = renderHook(() => useOnboardingDraft())

    act(() => {
      result.current.setDraft(prev => ({ ...prev, business: BUSINESS, step: 4 }))
    })
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    act(() => {
      result.current.clearDraft()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(result.current.draft.step).toBe(1)
    expect(result.current.draft.business.legalName).toBe('')
    expect(result.current.savedAt).toBeNull()
  })
})

describe('useOnboardingDraft — restored draft validation (issue #854)', () => {
  const FULL_DRAFT = {
    version: 1,
    step: 6,
    business: BUSINESS,
    owner: OWNER,
    selfie: { captured: true, fileName: 'selfie.jpg' },
    documents: DOCUMENTS,
    bank: BANK,
  }

  it.each([
    ['an invalid JSON payload', '{not-valid-json', 1],
    ['a null draft', 'null', 1],
    ['an array draft', '[]', 1],
    ['a step below the valid range', JSON.stringify({ ...FULL_DRAFT, step: 0 }), 1],
    ['a step above the valid range', JSON.stringify({ ...FULL_DRAFT, step: 99 }), 6],
    ['a numeric string step', JSON.stringify({ ...FULL_DRAFT, step: '3' }), 3],
    ['a fractional step', JSON.stringify({ ...FULL_DRAFT, step: 4.9 }), 4],
    ['a non-numeric step', JSON.stringify({ ...FULL_DRAFT, step: 'two' }), 1],
  ])('normalises %s', (_name, raw, expectedStep) => {
    localStorage.setItem(STORAGE_KEY, raw)

    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.step).toBe(expectedStep)
    expect(result.current.draft.step).toBeGreaterThanOrEqual(1)
    expect(result.current.draft.step).toBeLessThanOrEqual(6)
  })

  it('restores a step 5 draft with empty business details to step 1', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...FULL_DRAFT, step: 5, business: null }),
    )

    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.step).toBe(1)
    expect(result.current.draft.business).toEqual({
      legalName: '',
      registrationNumber: '',
      country: '',
      businessType: '',
      website: '',
    })
  })

  it.each([
    ['business details are incomplete', { step: 4, business: { ...BUSINESS, legalName: '' } }, 1],
    ['owner details are incomplete', { step: 4, owner: { ...OWNER, city: '' } }, 2],
    ['the selfie is missing', { step: 5, selfie: { captured: false, fileName: '' } }, 3],
    ['documents are missing', { step: 6, documents: { ...DOCUMENTS, govIdBack: [] } }, 4],
    ['bank details are missing', { step: 6, bank: { ...BANK, ibanSwift: '' } }, 5],
  ])('clamps to the first incomplete step when %s', (_name, patch, expectedStep) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...FULL_DRAFT, ...patch }))

    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.step).toBe(expectedStep)
  })

  it('deep-merges each nested section with the defaults and coerces field types', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: 2,
        business: {
          legalName: 'Acme Trading Ltd',
          registrationNumber: 1234567,
          country: 'NG',
          businessType: 'retail',
          website: null,
        },
        owner: { fullName: 'Ada Lovelace', city: 42 },
        selfie: { captured: 'yes', fileName: 7 },
        documents: { registrationCert: 'cert.pdf', govIdFront: [1, 'front.jpg', null] },
      }),
    )

    const { result } = renderHook(() => useOnboardingDraft())

    expect(result.current.draft.business).toEqual({
      legalName: 'Acme Trading Ltd',
      registrationNumber: '',
      country: 'NG',
      businessType: 'retail',
      website: '',
    })
    expect(result.current.draft.owner).toEqual({
      fullName: 'Ada Lovelace',
      dateOfBirth: '',
      nationality: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      postalCode: '',
    })
    expect(result.current.draft.selfie).toEqual({ captured: false, fileName: '' })
    expect(result.current.draft.documents).toEqual({
      registrationCert: [],
      govIdFront: ['front.jpg'],
      govIdBack: [],
      proofOfAddress: [],
    })
    expect(result.current.draft.bank).toEqual({
      bankName: '',
      accountNumber: '',
      ibanSwift: '',
      currency: '',
    })
  })
})

describe('useOnboardingDraft — storage failures', () => {
  it('still updates in-memory state when localStorage.setItem throws', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    const { result } = renderHook(() => useOnboardingDraft())
    setItem.mockClear()

    expect(() => {
      act(() => {
        result.current.setDraft({ business: BUSINESS })
      })
    }).not.toThrow()

    expect(result.current.draft.business).toEqual(BUSINESS)
    // The write failed, so no new savedAt timestamp is reported.
    expect(result.current.savedAt).toBeNull()
  })

  it('does not throw when storage access fails on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(() => renderHook(() => useOnboardingDraft())).not.toThrow()
  })
})
