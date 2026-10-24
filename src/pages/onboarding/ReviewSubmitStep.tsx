import type { OnboardingDraft } from '../../hooks/useOnboardingDraft'

type Props = {
  draft: OnboardingDraft
  onBack: () => void
  onSubmit: () => void
  submitting: boolean
  submitError?: string | null
  onRetry?: () => void
}

type ReviewRow = { label: string; value: string }

function rows(entries: [string, string][]): ReviewRow[] {
  return entries.filter(([, v]) => v).map(([label, value]) => ({ label, value }))
}

export default function ReviewSubmitStep({ draft, onBack, onSubmit, submitting, submitError, onRetry }: Props) {
  const { business, owner, selfie, documents, bank } = draft

  const businessRows = rows([
    ['Legal name', business.legalName],
    ['Registration no.', business.registrationNumber],
    ['Country', business.country],
    ['Business type', business.businessType],
    ['Website', business.website],
  ])

  const ownerRows = rows([
    ['Full name', owner.fullName],
    ['Date of birth', owner.dateOfBirth],
    ['Nationality', owner.nationality],
    ['Address', [owner.addressLine1, owner.addressLine2, owner.city, owner.postalCode].filter(Boolean).join(', ')],
  ])

  const selfieRows = rows([
    ['Selfie verification', selfie.captured ? 'Captured' : 'Not provided'],
  ])

  const docRows = rows([
    ['Registration cert.', documents.registrationCert.join(', ')],
    ['Gov. ID front', documents.govIdFront.join(', ')],
    ['Gov. ID back', documents.govIdBack.join(', ')],
    ['Proof of address', documents.proofOfAddress.join(', ')],
  ])

  const bankRows = rows([
    ['Bank name', bank.bankName],
    ['Account number', bank.accountNumber],
    ['IBAN / SWIFT', bank.ibanSwift],
    ['Currency', bank.currency],
  ])

  return (
    <div className="ob-form">
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.95rem', lineHeight: 1.6 }}>
        Review your information before submitting. Once submitted, your application will be set to <strong style={{ color: 'var(--text)' }}>pending review</strong> and our compliance team will be in touch within 2 business days.
      </p>

      {submitError && (
        <div
          className="wizard-inline-alert"
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginTop: '1rem',
          }}
        >
          <span>{submitError}</span>
          <button
            type="button"
            className="ob-btn ob-btn-secondary"
            onClick={onRetry ?? onSubmit}
            disabled={submitting}
            style={{ minHeight: '2.25rem', padding: '0.375rem 1rem', fontSize: '0.875rem' }}
          >
            Retry
          </button>
        </div>
      )}

      <div className="ob-review-sections">
        <ReviewSection title="Business details" rows={businessRows} />
        <ReviewSection title="Owner / Director" rows={ownerRows} />
        <ReviewSection title="Selfie verification" rows={selfieRows} />
        <ReviewSection title="Documents" rows={docRows} />
        <ReviewSection title="Bank & payout" rows={bankRows} />
      </div>

      <div className="ob-actions">
        <button type="button" className="ob-btn ob-btn-secondary" onClick={onBack} disabled={submitting}>← Back</button>
        <button
          type="button"
          className="ob-btn ob-btn-primary"
          onClick={onSubmit}
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </div>
  )
}

function ReviewSection({ title, rows }: { title: string; rows: ReviewRow[] }) {
  if (rows.length === 0) return null
  return (
    <section className="ob-review-section" aria-label={title}>
      <h3 className="ob-review-section-title">{title}</h3>
      {rows.map(({ label, value }) => (
        <div key={label} className="ob-review-row">
          <span className="ob-review-key">{label}</span>
          <span className="ob-review-val">{value}</span>
        </div>
      ))}
    </section>
  )
}
