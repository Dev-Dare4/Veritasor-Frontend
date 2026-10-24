import type { OnboardingDraft } from '../hooks/useOnboardingDraft'
import type { FileMap } from '../pages/onboarding/DocumentUploadStep'

export interface SubmitOnboardingPayload {
  draft: OnboardingDraft
  selfieFile: File | null
  documentFiles: FileMap
}

export async function submitOnboardingApplication({
  draft,
  selfieFile,
  documentFiles,
}: SubmitOnboardingPayload): Promise<unknown> {
  const formData = new FormData()

  const draftJson = JSON.stringify({ ...draft, status: 'pending_review' })
  formData.append('draft', draftJson)

  if (selfieFile) {
    formData.append('selfie', selfieFile)
  }

  const docKeys: (keyof FileMap)[] = ['registrationCert', 'govIdFront', 'govIdBack', 'proofOfAddress']
  for (const key of docKeys) {
    const files = documentFiles[key] || []
    for (const file of files) {
      formData.append(key, file)
    }
  }

  let res: Response
  try {
    res = await fetch('/api/onboarding/submit', {
      method: 'POST',
      body: formData,
    })
  } catch {
    throw new Error('Network error: unable to submit onboarding application. Please check your connection and try again.')
  }

  if (!res.ok) {
    throw new Error(`Submission failed with status ${res.status}: ${res.statusText || 'Server error'}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new Error('Invalid response from server: expected JSON response.')
  }

  try {
    return await res.json()
  } catch {
    throw new Error('Invalid response from server: failed to parse JSON response.')
  }
}
