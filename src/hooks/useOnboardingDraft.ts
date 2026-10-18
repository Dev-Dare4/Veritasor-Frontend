import { useState, useEffect, useCallback } from 'react'

export type BusinessDetails = {
  legalName: string
  registrationNumber: string
  country: string
  businessType: string
  website: string
}

export type OwnerDetails = {
  fullName: string
  dateOfBirth: string
  nationality: string
  addressLine1: string
  addressLine2: string
  city: string
  postalCode: string
}

export type DocumentUpload = {
  registrationCert: string[]   // file names (actual File objects held in component state)
  govIdFront: string[]
  govIdBack: string[]
  proofOfAddress: string[]
}

export type SelfieCapture = {
  captured: boolean
  fileName: string
}

export type BankDetails = {
  bankName: string
  accountNumber: string
  ibanSwift: string
  currency: string
}

export type OnboardingDraft = {
  step: number
  business: BusinessDetails
  owner: OwnerDetails
  selfie: SelfieCapture
  documents: DocumentUpload
  bank: BankDetails
}

const STORAGE_KEY = 'veritasor_onboarding_draft'

const INITIAL_DRAFT: OnboardingDraft = {
  step: 1,
  business: { legalName: '', registrationNumber: '', country: '', businessType: '', website: '' },
  owner: { fullName: '', dateOfBirth: '', nationality: '', addressLine1: '', addressLine2: '', city: '', postalCode: '' },
  selfie: { captured: false, fileName: '' },
  documents: { registrationCert: [], govIdFront: [], govIdBack: [], proofOfAddress: [] },
  bank: { bankName: '', accountNumber: '', ibanSwift: '', currency: '' },
}

export function useOnboardingDraft() {
  const [draft, setDraftState] = useState<OnboardingDraft>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return { ...INITIAL_DRAFT, ...JSON.parse(raw) }
    } catch {
      // ignore parse errors
    }
    return INITIAL_DRAFT
  })

  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const setDraft = useCallback((updater: Partial<OnboardingDraft> | ((prev: OnboardingDraft) => OnboardingDraft)) => {
    setDraftState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        setSavedAt(new Date())
      } catch {
        // storage full or unavailable
      }
      return next
    })
  }, [])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setDraftState(INITIAL_DRAFT)
    setSavedAt(null)
  }, [])

  // Persist on mount if draft already existed
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSavedAt(new Date())
    } catch {
      // Storage unavailable (private mode / blocked): keep the in-memory draft.
    }
  }, [])

  return { draft, setDraft, clearDraft, savedAt }
}
