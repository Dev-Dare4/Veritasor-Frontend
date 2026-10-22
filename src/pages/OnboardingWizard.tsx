import { useEffect, useLayoutEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useOnboardingDraft } from '../hooks/useOnboardingDraft'
import BusinessDetailsStep from './onboarding/BusinessDetailsStep'
import OwnerDetailsStep from './onboarding/OwnerDetailsStep'
import SelfieCaptureStep from './onboarding/SelfieCaptureStep'
import DocumentUploadStep from './onboarding/DocumentUploadStep'
import type { FileMap } from './onboarding/DocumentUploadStep'
import BankDetailsStep from './onboarding/BankDetailsStep'
import ReviewSubmitStep from './onboarding/ReviewSubmitStep'
import type { OnboardingDraft, BusinessDetails, OwnerDetails, SelfieCapture, DocumentUpload, BankDetails } from '../hooks/useOnboardingDraft'
import { submitOnboardingApplication } from '../services/onboardingApi'
import Breadcrumb from '../components/Breadcrumb'

const TOTAL_STEPS = 6

const STEP_META = [
  { eyebrow: 'Step 1 of 6', title: 'Business details', description: 'Tell us about your registered business.' },
  { eyebrow: 'Step 2 of 6', title: 'Owner / Director', description: 'Provide details for the primary business owner or director.' },
  { eyebrow: 'Step 3 of 6', title: 'Selfie verification', description: 'Take a selfie to verify your identity. Position your face within the oval guide in good lighting.' },
  { eyebrow: 'Step 4 of 6', title: 'Document upload', description: 'Upload the required KYB/KYC documents. Accepted: PDF, JPG, PNG · max 10 MB each.' },
  { eyebrow: 'Step 5 of 6', title: 'Bank & payout details', description: 'Where should FluxaPay send your settlements?' },
  { eyebrow: 'Step 6 of 6', title: 'Review & submit', description: 'Check everything looks right before we send your application for review.' },
]

export default function OnboardingWizard() {
  const { draft, setDraft, clearDraft, savedAt } = useOnboardingDraft()
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [documentFiles, setDocumentFiles] = useState<FileMap>({
    registrationCert: [],
    govIdFront: [],
    govIdBack: [],
    proofOfAddress: [],
  })
  const [stepAnnouncement, setStepAnnouncement] = useState('')
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const pendingUpdatersRef = useRef<Array<(prev: OnboardingDraft) => OnboardingDraft>>([])

  const step = draft.step

  const flushDraftUpdates = () => {
    if (rafIdRef.current != null) {
      window.cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    if (pendingUpdatersRef.current.length > 0) {
      const updaters = pendingUpdatersRef.current
      pendingUpdatersRef.current = []
      setDraft(prev => updaters.reduce((acc, fn) => fn(acc), prev))
    }
  }

  function scheduleDraftUpdate(updater: (prev: OnboardingDraft) => OnboardingDraft) {
    pendingUpdatersRef.current.push(updater)
    if (rafIdRef.current != null) return
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null
      flushDraftUpdates()
    })
  }

  useEffect(() => {
    const handleFlush = () => {
      flushDraftUpdates()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushDraftUpdates()
      }
    }

    window.addEventListener('pagehide', handleFlush)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handleFlush)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flushDraftUpdates()
    }
  }, [])

  useEffect(() => {
    const meta = STEP_META[step - 1]
    setStepAnnouncement(`Step ${step} of ${TOTAL_STEPS}: ${meta?.title ?? ''}`)
    // Move focus to the step title so screen readers announce the context.
    titleRef.current?.focus()
  }, [step])

  useLayoutEffect(() => {
    const el = cardRef.current?.querySelector('.ob-actions')
    setActionsEl(el instanceof HTMLElement ? el : null)
  }, [step])

  function handleAutoPersist(e: React.SyntheticEvent) {
    const target = e.target as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) | null
    if (!target || typeof target.id !== 'string') return

    const id = target.id

    const setNested = <K extends keyof OnboardingDraft, F extends string>(
      key: K,
      field: F,
      value: string,
    ) => {
      scheduleDraftUpdate(prev => {
        const current = (prev[key] as any)?.[field]
        if (current === value) return prev
        return { ...prev, [key]: { ...(prev as any)[key], [field]: value } }
      })
    }

    if (id === 'ob-legal-name') return setNested('business', 'legalName', target.value)
    if (id === 'ob-reg-number') return setNested('business', 'registrationNumber', target.value)
    if (id === 'ob-country') return setNested('business', 'country', target.value)
    if (id === 'ob-biz-type' || id.startsWith('ob-biz-type-')) return setNested('business', 'businessType', target.value)
    if (id === 'ob-website') return setNested('business', 'website', target.value)

    if (id === 'ob-full-name') return setNested('owner', 'fullName', target.value)
    if (id === 'ob-dob') return setNested('owner', 'dateOfBirth', target.value)
    if (id === 'ob-nationality') return setNested('owner', 'nationality', target.value)
    if (id === 'ob-addr1') return setNested('owner', 'addressLine1', target.value)
    if (id === 'ob-addr2') return setNested('owner', 'addressLine2', target.value)
    if (id === 'ob-city') return setNested('owner', 'city', target.value)
    if (id === 'ob-postal') return setNested('owner', 'postalCode', target.value)

    if (id === 'ob-selfie-input') {
      const uploadedFile = (target as HTMLInputElement).files?.[0]
      if (uploadedFile) {
        scheduleDraftUpdate(prev => ({
          ...prev,
          selfie: { captured: true, fileName: uploadedFile.name },
        }))
      }
      return
    }

    if (id === 'ob-bank-name') return setNested('bank', 'bankName', target.value)
    if (id === 'ob-account-number') return setNested('bank', 'accountNumber', target.value)
    if (id === 'ob-currency') return setNested('bank', 'currency', target.value)
    if (id === 'ob-iban-swift') return setNested('bank', 'ibanSwift', target.value)

    if (id.startsWith('ob-drop-') && target instanceof HTMLInputElement && target.type === 'file') {
      const docKey = id.replace('ob-drop-', '') as keyof OnboardingDraft['documents']
      const names = Array.from(target.files ?? []).map(f => f.name).filter(Boolean)
      if (names.length === 0) return
      scheduleDraftUpdate(prev => {
        const current = prev.documents?.[docKey] ?? []
        const merged = [...current, ...names].filter((v, i, arr) => arr.indexOf(v) === i)
        return { ...prev, documents: { ...prev.documents, [docKey]: merged } }
      })
    }
  }

  function goTo(s: number) {
    setDraft({ step: s })
  }

  // Step handlers
  function handleBusiness(data: BusinessDetails) {
    setDraft(prev => ({ ...prev, business: data, step: 2 }))
  }

  function handleOwner(data: OwnerDetails) {
    setDraft(prev => ({ ...prev, owner: data, step: 3 }))
  }

  function handleSelfie(data: SelfieCapture, file: File | null) {
    if (file) {
      setSelfieFile(file)
    }
    setDraft(prev => ({ ...prev, selfie: data, step: 4 }))
  }

  function handleDocuments(data: DocumentUpload, files: FileMap) {
    // File objects can't be serialised to localStorage; we store names in draft and keep File objects in memory
    setDocumentFiles(files)
    setDraft(prev => ({ ...prev, documents: data, step: 5 }))
  }

  function handleBank(data: BankDetails) {
    setDraft(prev => ({ ...prev, bank: data, step: 6 }))
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitOnboardingApplication({
        draft,
        selfieFile,
        documentFiles,
      })
      clearDraft()
      setSubmitted(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return <KycPendingScreen />
  }

  const meta = STEP_META[step - 1]

  return (
    <main className="ob-page">
      <div className="ob-shell">
        <style>
          {`
            @keyframes obStepIn {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .ob-step-transition {
              animation: obStepIn 220ms ease-out;
              will-change: opacity, transform;
            }
            @media (prefers-reduced-motion: reduce) {
              .ob-step-transition { animation: none !important; }
            }
          `}
        </style>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {stepAnnouncement}
        </p>
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Onboarding' },
            { label: meta.title },
          ]}
        />

        {/* Top bar */}
        <div className="ob-topbar">
          <Link to="/" className="ob-brand">Veritasor</Link>
          {savedAt && (
            <span className="ob-draft-badge" aria-live="polite">
              <span className="ob-draft-dot" aria-hidden="true" />
              Draft saved
            </span>
          )}
        </div>

        {/* Progress */}
        <nav aria-label="Onboarding progress">
          <div className="ob-progress">
            <div className="ob-progress-header">
              <span className="ob-progress-label">KYB / KYC Onboarding</span>
              <span className="ob-progress-count">{step} / {TOTAL_STEPS}</span>
            </div>
            <div className="ob-progress-steps" role="list">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const s = i + 1
                const isDone = s < step
                const isActive = s === step
                return (
                  <div
                    key={s}
                    role="listitem"
                    aria-label={`Step ${s}${isDone ? ' (completed)' : isActive ? ' (current)' : ''}`}
                    aria-current={isActive ? 'step' : undefined}
                    className={`ob-progress-step${isDone ? ' ob-progress-step-done' : isActive ? ' ob-progress-step-active' : ''}`}
                  />
                )
              })}
            </div>
          </div>
        </nav>

        {/* Card */}
        <div
          ref={cardRef}
          className="ob-card"
          onChangeCapture={handleAutoPersist}
          onInputCapture={handleAutoPersist}
        >
          <div className="ob-card-header">
            <p className="ob-card-eyebrow">{meta.eyebrow}</p>
            <h1 ref={titleRef} className="ob-card-title" tabIndex={-1}>{meta.title}</h1>
            <p className="ob-card-description">{meta.description}</p>
          </div>

          <div key={step} className="ob-step-transition">
            {step === 1 && (
              <BusinessDetailsStep
                data={draft.business}
                onNext={handleBusiness}
              />
            )}
            {step === 2 && (
              <OwnerDetailsStep
                data={draft.owner}
                onBack={() => goTo(1)}
                onNext={handleOwner}
              />
            )}
            {step === 3 && (
              <SelfieCaptureStep
                data={draft.selfie}
                onBack={() => goTo(2)}
                onNext={handleSelfie}
              />
            )}
            {step === 4 && (
              <DocumentUploadStep
                data={draft.documents}
                onBack={() => goTo(3)}
                onNext={handleDocuments}
              />
            )}
            {step === 5 && (
              <BankDetailsStep
                data={draft.bank}
                onBack={() => goTo(4)}
                onNext={handleBank}
              />
            )}
            {step === 6 && (
              <ReviewSubmitStep
                draft={draft}
                onBack={() => goTo(5)}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
                onRetry={handleSubmit}
              />
            )}
          </div>

          {actionsEl && createPortal(
            <Link
              to="/dashboard"
              onClick={() => setDraft(prev => ({ ...prev }))}
              className="ob-save-exit"
              style={{
                marginLeft: 'auto',
                alignSelf: 'center',
                fontSize: '0.95rem',
                textDecoration: 'underline',
                color: 'var(--muted)',
                pointerEvents: submitting ? 'none' : undefined,
                opacity: submitting ? 0.6 : 1,
              }}
              aria-label="Save your progress and exit onboarding"
              aria-disabled={submitting || undefined}
              tabIndex={submitting ? -1 : undefined}
            >
              Save and exit
            </Link>,
            actionsEl,
          )}
        </div>
      </div>
    </main>
  )
}

// ─── KYC Pending Screen ─────────────────────────────────────────────────────

const VERIFICATION_STEPS = [
  { id: "submitted", label: "Application submitted", status: "done" as const },
  { id: "document_check", label: "Document verification", status: "current" as const },
  { id: "identity_check", label: "Identity verification", status: "pending" as const },
  { id: "compliance_review", label: "Compliance review", status: "pending" as const },
  { id: "decision", label: "Final decision", status: "pending" as const },
] as const;

function PendingIllustration() {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 120,
        height: 120,
        borderRadius: "50%",
        background: "rgba(94, 234, 212, 0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        margin: "0 auto",
      }}
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: "relative", zIndex: 1 }}
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
      {/* Animated ring */}
      <svg
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          animation: "kpRingRotate 2.5s linear infinite",
        }}
        viewBox="0 0 120 120"
      >
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="280"
          strokeDashoffset="80"
          strokeLinecap="round"
          opacity="0.4"
        />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeDasharray="200"
          strokeDashoffset="40"
          strokeLinecap="round"
          opacity="0.7"
          style={{
            animation: "kpRingPulse 2.5s ease-in-out infinite alternate",
          }}
        />
      </svg>
    </div>
  );
}

function StepTimeline() {
  return (
    <div
      role="list"
      aria-label="Verification progress timeline"
      style={{
        display: "grid",
        gap: "0",
        maxWidth: 400,
        margin: "0 auto",
      }}
    >
      {VERIFICATION_STEPS.map((step, idx) => {
        const isLast = idx === VERIFICATION_STEPS.length - 1;
        const isDone = step.status === "done";
        const isCurrent = step.status === "current";
        return (
          <div
            key={step.id}
            role="listitem"
            aria-label={`${step.label}${isDone ? " (completed)" : isCurrent ? " (in progress)" : " (pending)"}`}
            aria-current={isCurrent ? "step" : undefined}
            style={{
              display: "flex",
              gap: "0.75rem",
              position: "relative",
              paddingBottom: isLast ? 0 : "0.5rem",
            }}
          >
            {/* Connector line */}
            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 12,
                  top: 28,
                  bottom: 0,
                  width: 2,
                  background: isDone
                    ? "var(--accent)"
                    : "var(--border)",
                  opacity: isDone ? 0.6 : 0.4,
                }}
              />
            )}

            {/* Step indicator dot */}
            <div
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: isDone
                  ? "var(--accent)"
                  : isCurrent
                    ? "rgba(94, 234, 212, 0.15)"
                    : "var(--surface-strong)",
                border: `2px solid ${
                  isDone
                    ? "var(--accent)"
                    : isCurrent
                      ? "var(--accent)"
                      : "var(--border)"
                }`,
                transition: "all 300ms ease",
              }}
            >
              {isDone ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#04111f"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isCurrent ? (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--border)",
                  }}
                />
              )}
            </div>

            {/* Step label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingTop: "0.15rem",
              }}
            >
              <span
                style={{
                  fontWeight: isCurrent ? 700 : isDone ? 600 : 400,
                  fontSize: "0.9rem",
                  color: isCurrent
                    ? "var(--accent)"
                    : isDone
                      ? "var(--text)"
                      : "var(--muted)",
                }}
              >
                {step.label}
              </span>
              {isCurrent && (
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--muted)",
                    marginTop: "0.1rem",
                  }}
                >
                  In progress
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KycPendingScreen() {
  const emailToggleId = useId();
  const emailInputId = useId();
  const [notifyViaEmail, setNotifyViaEmail] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [emailSavedAck, setEmailSavedAck] = useState(false);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notificationEmail.trim()) return;
    setEmailSavedAck(true);
    setTimeout(() => setEmailSavedAck(false), 4000);
  }

  return (
    <main className="ob-page" style={{ padding: "clamp(1rem, 3vw, 2.5rem) 1rem" }}>
      <div className="ob-shell" style={{ maxWidth: 560, margin: "0 auto" }}>
        <style>{`
          @keyframes kpRingRotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes kpRingPulse {
            from { opacity: 0.4; }
            to { opacity: 0.9; }
          }
          @keyframes kpFadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .kp-animate-in {
            animation: kpFadeIn 400ms ease-out both;
          }
          .kp-animate-in:nth-child(2) { animation-delay: 100ms; }
          .kp-animate-in:nth-child(3) { animation-delay: 200ms; }
          .kp-animate-in:nth-child(4) { animation-delay: 300ms; }
          .kp-animate-in:nth-child(5) { animation-delay: 400ms; }
          @media (prefers-reduced-motion: reduce) {
            .kp-animate-in { animation: none !important; }
          }
        `}</style>

        <div
          className="ob-card"
          style={{
            border: "1px solid var(--border-strong)",
            boxShadow: "0 8px 32px rgba(2, 6, 23, 0.3)",
          }}
        >
          <div style={{ padding: "2rem 1.5rem", display: "grid", gap: "1.5rem", textAlign: "center" }}>
            {/* Step 1: Hero illustration + title */}
            <div className="kp-animate-in">
              <PendingIllustration />
              <h1
                className="ob-success-title"
                style={{ marginTop: "1.25rem", fontSize: "clamp(1.4rem, 3vw, 1.75rem)" }}
              >
                Verification in progress
              </h1>
              <p
                className="ob-success-body"
                style={{ margin: "0.5rem auto 0", color: "var(--muted)", maxWidth: "42ch", lineHeight: 1.6 }}
              >
                We received your application. Our compliance team is reviewing your documents and identity information.
              </p>
            </div>

            {/* Step 2: SLA banner */}
            <div
              className="kp-animate-in"
              style={{
                padding: "1rem 1.25rem",
                borderRadius: 12,
                background: "rgba(96, 165, 250, 0.08)",
                border: "1px solid rgba(96, 165, 250, 0.2)",
                display: "grid",
                gap: "0.5rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--accent)" }}>
                  Expected SLA: 2 business days
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                }}
              >
                Most applications are reviewed within <strong>2 business days</strong>. You will be notified of the decision via email.
              </p>
            </div>

            {/* Step 3: Timeline */}
            <div
              className="kp-animate-in"
              style={{ textAlign: "left" }}
            >
              <h2
                id="verification-timeline-heading"
                style={{
                  margin: "0 0 1rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  textAlign: "center",
                }}
              >
                Verification timeline
              </h2>
              <StepTimeline />
            </div>

            {/* Step 4: Email notification opt-in */}
            <div
              className="kp-animate-in"
            >
              <form
                onSubmit={handleEmailSubmit}
                aria-label="Email notification preferences"
                style={{
                  padding: "1rem 1.25rem",
                  borderRadius: 12,
                  background: "var(--surface-strong)",
                  border: "1px solid var(--border)",
                  display: "grid",
                  gap: "0.75rem",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                  }}
                >
                  <input
                    id={emailToggleId}
                    type="checkbox"
                    checked={notifyViaEmail}
                    onChange={(e) => setNotifyViaEmail(e.target.checked)}
                    style={{ width: 18, height: 18, marginTop: "0.15rem", flexShrink: 0 }}
                  />
                  <div>
                    <label
                      htmlFor={emailToggleId}
                      style={{ fontWeight: 600, fontSize: "0.9rem", cursor: "pointer" }}
                    >
                      Notify me by email
                    </label>
                    <p
                      style={{
                        margin: "0.15rem 0 0",
                        fontSize: "0.82rem",
                        color: "var(--muted)",
                      }}
                    >
                      Get notified when your verification status changes.
                    </p>
                  </div>
                </div>

                {notifyViaEmail && (
                  <div
                    style={{
                      display: "grid",
                      gap: "0.4rem",
                      animation: "kpFadeIn 200ms ease-out",
                    }}
                  >
                    <label
                      htmlFor={emailInputId}
                      style={{ fontSize: "0.85rem", fontWeight: 600 }}
                    >
                      Email address
                    </label>
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <input
                        id={emailInputId}
                        type="email"
                        value={notificationEmail}
                        onChange={(e) => {
                          setNotificationEmail(e.target.value);
                          setEmailSavedAck(false);
                        }}
                        placeholder="you@example.com"
                        aria-label="Notification email address"
                        style={{
                          flex: "1 1 200px",
                          padding: "0.55rem 0.75rem",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--text)",
                          fontSize: "0.9rem",
                          minHeight: "2.5rem",
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!notificationEmail.trim()}
                        className="ob-btn ob-btn-primary"
                        style={{
                          minHeight: "2.5rem",
                          padding: "0.5rem 1rem",
                          fontSize: "0.88rem",
                        }}
                      >
                        {emailSavedAck ? "Saved ✓" : "Save"}
                      </button>
                    </div>
                    {emailSavedAck && (
                      <span
                        role="status"
                        aria-live="polite"
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--success)",
                          fontWeight: 600,
                        }}
                      >
                        Notification email saved.
                      </span>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* Step 5: Nudge to explore / CTA */}
            <div
              className="kp-animate-in"
              style={{
                padding: "1rem 1.25rem",
                borderRadius: 12,
                background: "rgba(94, 234, 212, 0.06)",
                border: "1px solid rgba(94, 234, 212, 0.2)",
                display: "grid",
                gap: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    color: "var(--accent)",
                  }}
                >
                  While you wait…
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                  textAlign: "center",
                }}
              >
                Explore the dashboard to configure your attestation settings, manage API keys, or connect your first revenue source.
              </p>
              <Link
                to="/"
                className="ob-btn ob-btn-primary"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  justifySelf: "center",
                  padding: "0.65rem 1.5rem",
                }}
              >
                Go to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
