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
  version: number
  step: number
  business: BusinessDetails
  owner: OwnerDetails
  selfie: SelfieCapture
  documents: DocumentUpload
  bank: BankDetails
}

const STORAGE_KEY = 'veritasor_onboarding_draft'

export const DRAFT_VERSION = 1
export const TOTAL_STEPS = 6

const INITIAL_DRAFT: OnboardingDraft = {
  version: DRAFT_VERSION,
  step: 1,
  business: { legalName: '', registrationNumber: '', country: '', businessType: '', website: '' },
  owner: { fullName: '', dateOfBirth: '', nationality: '', addressLine1: '', addressLine2: '', city: '', postalCode: '' },
  selfie: { captured: false, fileName: '' },
  documents: { registrationCert: [], govIdFront: [], govIdBack: [], proofOfAddress: [] },
  bank: { bankName: '', accountNumber: '', ibanSwift: '', currency: '' },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function parseBusiness(value: unknown): BusinessDetails {
  const v = isRecord(value) ? value : {}
  return {
    legalName: asString(v.legalName),
    registrationNumber: asString(v.registrationNumber),
    country: asString(v.country),
    businessType: asString(v.businessType),
    website: asString(v.website),
  }
}

function parseOwner(value: unknown): OwnerDetails {
  const v = isRecord(value) ? value : {}
  return {
    fullName: asString(v.fullName),
    dateOfBirth: asString(v.dateOfBirth),
    nationality: asString(v.nationality),
    addressLine1: asString(v.addressLine1),
    addressLine2: asString(v.addressLine2),
    city: asString(v.city),
    postalCode: asString(v.postalCode),
  }
}

function parseSelfie(value: unknown): SelfieCapture {
  const v = isRecord(value) ? value : {}
  return {
    captured: v.captured === true,
    fileName: asString(v.fileName),
  }
}

function parseDocuments(value: unknown): DocumentUpload {
  const v = isRecord(value) ? value : {}
  return {
    registrationCert: asStringArray(v.registrationCert),
    govIdFront: asStringArray(v.govIdFront),
    govIdBack: asStringArray(v.govIdBack),
    proofOfAddress: asStringArray(v.proofOfAddress),
  }
}

function parseBank(value: unknown): BankDetails {
  const v = isRecord(value) ? value : {}
  return {
    bankName: asString(v.bankName),
    accountNumber: asString(v.accountNumber),
    ibanSwift: asString(v.ibanSwift),
    currency: asString(v.currency),
  }
}

function normalizeStep(value: unknown): number {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : Number.NaN

  if (!Number.isFinite(parsed)) return 1

  const integer = Math.trunc(parsed)
  return Math.min(TOTAL_STEPS, Math.max(1, integer))
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

const STEP_PREREQUISITES: ((draft: OnboardingDraft) => boolean)[] = [
  draft => (
    hasText(draft.business.legalName) &&
    hasText(draft.business.registrationNumber) &&
    hasText(draft.business.country) &&
    hasText(draft.business.businessType)
  ),
  draft => (
    hasText(draft.owner.fullName) &&
    hasText(draft.owner.dateOfBirth) &&
    hasText(draft.owner.nationality) &&
    hasText(draft.owner.addressLine1) &&
    hasText(draft.owner.city) &&
    hasText(draft.owner.postalCode)
  ),
  draft => draft.selfie.captured,
  draft => (
    draft.documents.registrationCert.length > 0 &&
    draft.documents.govIdFront.length > 0 &&
    draft.documents.govIdBack.length > 0 &&
    draft.documents.proofOfAddress.length > 0
  ),
  draft => (
    hasText(draft.bank.bankName) &&
    hasText(draft.bank.accountNumber) &&
    hasText(draft.bank.ibanSwift) &&
    hasText(draft.bank.currency)
  ),
]

function firstIncompleteStep(draft: OnboardingDraft): number {
  for (let step = 1; step < TOTAL_STEPS; step++) {
    if (!STEP_PREREQUISITES[step - 1](draft)) return step
  }
  return TOTAL_STEPS
}

/**
 * Resolve the step a draft is allowed to render. A persisted draft may claim
 * any step, so clamp to the first step whose prerequisites are incomplete and
 * to the valid 1..TOTAL_STEPS range.
 */
export function resolveStep(draft: OnboardingDraft): number {
  return Math.min(normalizeStep(draft.step), firstIncompleteStep(draft))
}

/**
 * Validate and normalise an untrusted persisted draft. Never throws: corrupt
 * JSON or unexpected shapes fall back to the empty draft.
 */
export function parseDraft(raw: string | null | undefined): OnboardingDraft {
  if (!raw) return INITIAL_DRAFT

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return INITIAL_DRAFT
  }

  if (!isRecord(data)) return INITIAL_DRAFT

  const parsed: OnboardingDraft = {
    version: DRAFT_VERSION,
    step: normalizeStep(data.step),
    business: parseBusiness(data.business),
    owner: parseOwner(data.owner),
    selfie: parseSelfie(data.selfie),
    documents: parseDocuments(data.documents),
    bank: parseBank(data.bank),
  }

  parsed.step = resolveStep(parsed)
  return parsed
}

export function useOnboardingDraft() {
  const [draft, setDraftState] = useState<OnboardingDraft>(() => {
    try {
      return parseDraft(localStorage.getItem(STORAGE_KEY))
    } catch {
      // ignore storage access errors
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
