import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import { useEnvironment } from '../context/EnvironmentContext'
import Breadcrumb from '../components/Breadcrumb'
import StatusTimeline, { 
  TimelineStep, 
  TimelineStepStatus 
} from '../components/StatusTimeline'
import ProofShareModal from '../components/ProofShareModal'
import ConfirmDialog from '../components/ConfirmDialog'
import './AttestationCertificate.print.css'
import { useAttestations } from '../state/attestations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStatus = 'verified' | 'pending' | 'failed'

interface AttestationRecord {
  id: string
  merkleRoot: string
  stellarTxHash: string
  timestamp: string
  recordCount: number
  totalRevenue: string
  currency: string
  status: VerificationStatus
  failureReason?: string
  remediation?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STELLAR_EXPLORER_BASE: Record<'testnet' | 'mainnet', string> = {
  testnet: 'https://stellar.expert/explorer/testnet/tx/',
  mainnet: 'https://stellar.expert/explorer/public/tx/',
}

const STATUS_STYLES: Record<VerificationStatus, { bg: string; color: string; label: string }> = {
  verified: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'Verified' },
  pending: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'Pending' },
  failed: { bg: 'var(--danger-soft)', color: 'var(--danger)', label: 'Failed' },
}

function truncate(hash: string, chars = 12) {
  if (hash.length <= chars * 2 + 3) return hash
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Grayscale-safe label/icon for the formal printed certificate. Each status
// combines an icon glyph (shape channel) with a text label and a styled border
// so the document remains informative when printed in black & white.
const PRINT_STATUS: Record<
  VerificationStatus,
  { label: string; glyph: string; ariaLabel: string }
> = {
  verified: { label: 'VERIFIED', glyph: '✓', ariaLabel: 'Status: verified' },
  pending: { label: 'PENDING ON-CHAIN CONFIRMATION', glyph: '◷', ariaLabel: 'Status: pending on-chain confirmation' },
  failed: { label: 'NOT ATTESTED — VALIDATION FAILED', glyph: '✕', ariaLabel: 'Status: validation failed' },
}

// ---------------------------------------------------------------------------
// Timeline generation helpers
// ---------------------------------------------------------------------------

function generateTimelineSteps(
  attestation: AttestationRecord
): TimelineStep[] {
  const baseSteps: TimelineStep[] = [
    {
      id: 'submitted',
      label: 'Submitted',
      description: 'Attestation request submitted for processing',
      timestamp: attestation.timestamp,
      status: 'completed',
    },
    {
      id: 'queued',
      label: 'Queued',
      description: 'Request queued for verification processing',
      status: 'pending',
    },
    {
      id: 'verifying',
      label: 'Verifying',
      description: 'Cryptographic verification of revenue data in progress',
      status: 'pending',
    },
    {
      id: 'anchored',
      label: 'Anchored',
      description: 'Merkle root anchored on Stellar blockchain',
      status: 'pending',
    },
    {
      id: 'finalized',
      label: 'Finalized',
      description: 'Attestation finalized and certificate issued',
      status: 'pending',
    },
  ]

  // Map attestation status to timeline progression
  if (attestation.status === 'verified') {
    // All steps completed
    return baseSteps.map((step, index) => ({
      ...step,
      status: 'completed' as TimelineStepStatus,
      timestamp: index === 0 ? attestation.timestamp : undefined,
    }))
  } else if (attestation.status === 'pending') {
    // First step completed, rest pending with second as current
    return baseSteps.map((step, index) => ({
      ...step,
      status: index === 0 
        ? 'completed' as TimelineStepStatus
        : index === 1 
          ? 'current' as TimelineStepStatus
          : 'pending' as TimelineStepStatus,
    }))
  } else if (attestation.status === 'failed') {
    // First step completed, second step failed
    return baseSteps.map((step, index) => ({
      ...step,
      status: index === 0 
        ? 'completed' as TimelineStepStatus
        : index === 1 
          ? 'failed' as TimelineStepStatus
          : 'pending' as TimelineStepStatus,
      description: index === 1 
        ? `Verification failed: ${attestation.failureReason || 'Unknown error'}`
        : step.description,
    }))
  }

  return baseSteps
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

type CopyState = 'idle' | 'copied' | 'failed'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<CopyState>('idle')

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2000)
  }

  const isCopied = state === 'copied'
  const isFailed = state === 'failed'

  return (
    <>
      {/* aria-live region announces outcome to screen readers without moving focus */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
      >
        {isCopied ? `${label} copied` : isFailed ? `Failed to copy ${label}` : ''}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={isCopied ? `${label} copied` : isFailed ? `Failed to copy ${label}` : `Copy ${label}`}
        title={isCopied ? 'Copied!' : isFailed ? 'Copy failed' : 'Copy to clipboard'}
        className="no-print"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.25rem 0.6rem',
          fontSize: '0.78rem',
          fontWeight: 600,
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          background: isCopied ? 'var(--success-soft)' : isFailed ? 'var(--danger-soft)' : 'rgba(148,163,184,0.08)',
          color: isCopied ? 'var(--success)' : isFailed ? 'var(--danger)' : 'var(--muted)',
          cursor: 'pointer',
          transition: 'background 160ms, color 160ms',
          flexShrink: 0,
        }}
      >
        {isCopied ? (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="2,6 5,9 10,3" />
            </svg>
            Copied
          </>
        ) : isFailed ? (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="2" y1="2" x2="10" y2="10" /><line x1="10" y1="2" x2="2" y2="10" />
            </svg>
            Failed
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="4" y="1" width="7" height="9" rx="1" />
              <path d="M4 3H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-1" />
            </svg>
            Copy
          </>
        )}
      </button>
    </>
  )
}

// ---------------------------------------------------------------------------
// MetaRow
// ---------------------------------------------------------------------------

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="certificate-data-row"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.875rem 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <dt
        className="certificate-data-label"
        style={{
          width: '10rem',
          flexShrink: 0,
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }} className="certificate-data-value">
        {children}
      </dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Certificate Seal (print-only SVG)
// ---------------------------------------------------------------------------

function CertificateSeal({ status, attestationId }: { status: VerificationStatus; attestationId: string }) {
  const sealLabel =
    status === 'verified'
      ? 'Attested On-Chain'
      : status === 'pending'
        ? 'Awaiting On-Chain'
        : 'Not Attested'

  return (
    <aside className="certificate-seal print-only" aria-label={`Issuance seal: ${sealLabel}`}>
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`Round seal reading Veritasor Protocol on top arc, ${sealLabel} on bottom arc, with attestation ${attestationId} in the center`}
      >
        <defs>
          <path
            id="seal-arc-top"
            d="M60 60 m -45 0 a 45 45 0 1 1 90 0"
          />
          <path
            id="seal-arc-bottom"
            d="M60 60 m 45 0 a 45 45 0 1 1 -90 0"
          />
        </defs>
        {/* Outer ring */}
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="1.2" />
        {/* Inner ring */}
        <circle cx="60" cy="60" r="48" fill="none" stroke="currentColor" strokeWidth="0.6" />
        {/* Top arc text */}
        <text fontSize="6.6" fontWeight="700" letterSpacing="2.4" fill="currentColor">
          <textPath href="#seal-arc-top" startOffset="50%" textAnchor="middle">
            VERITASOR PROTOCOL
          </textPath>
        </text>
        {/* Bottom arc text */}
        <text fontSize="5.4" letterSpacing="1.6" fill="currentColor">
          <textPath href="#seal-arc-bottom" startOffset="50%" textAnchor="middle">
            {sealLabel.toUpperCase()}
          </textPath>
        </text>
        {/* Center monogram */}
        <g transform="translate(60 60)">
          <circle r="14" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <text textAnchor="middle" dy="4" fontSize="14" fontWeight="700" fill="currentColor">
            V
          </text>
        </g>
      </svg>
      <span className="certificate-seal-caption">Stellar On-Chain Proof Seal</span>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// BackLink
// ---------------------------------------------------------------------------

function BackLink({ className = '' }: { className?: string }) {
  return (
    <Link
      to="/attestations"
      aria-label="Back to attestations list"
      className={`back-link ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.9rem',
        color: 'var(--muted)',
      }}
    >
      {/* left arrow */}
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 2 4 7l5 5" />
      </svg>
      Attestations
    </Link>
  )
}

// ---------------------------------------------------------------------------
// AttestationDetail
// ---------------------------------------------------------------------------

export default function AttestationDetail() {
  const { id } = useParams<{ id: string }>()
  const { environment } = useEnvironment()
  const attestation = id ? MOCK[id] : undefined
  const [printedOn, setPrintedOn] = useState<string | null>(null)
  const [now] = useState(() => new Date())
  const [isShareOpen, setIsShareOpen] = useState(false)
  const shareButtonRef = useRef<HTMLButtonElement>(null)

  // Retry-attestation state (local; shared store is out of scope)
  const [retryDialogOpen, setRetryDialogOpen] = useState(false)
  const [retryStatus, setRetryStatus] = useState<VerificationStatus | null>(null)
  const [retryBusy, setRetryBusy] = useState(false)
  const [retryAnnouncement, setRetryAnnouncement] = useState('')
  const retryButtonRef = useRef<HTMLButtonElement>(null)

  // Reset printed-on timestamp whenever the attestation changes so the footer
  // reflects the most-recent print of the current record.
  useEffect(() => {
    setPrintedOn(null)
  }, [id])

  const handlePrint = useCallback(() => {
    // Flush the printed-on timestamp synchronously into the DOM so the footer
    // captures the new "Printed …" line before the browser snapshots the page.
    flushSync(() => {
      setPrintedOn(new Date().toISOString())
    })
    window.print()
  }, [])

  const handleShareClose = useCallback(() => {
    setIsShareOpen(false)
    // Restore focus to the trigger button after the modal unmounts
    requestAnimationFrame(() => {
      shareButtonRef.current?.focus()
    })
  }, [])

  const handleRetryConfirm = useCallback(() => {
    setRetryBusy(true)
    setRetryStatus('pending')
    setRetryAnnouncement('Retry in progress…')

    // Simulate async retry (replace with real API call when backend lands)
    setTimeout(() => {
      const outcome: VerificationStatus = 'verified'
      setRetryStatus(outcome)
      setRetryBusy(false)
      setRetryDialogOpen(false)
      setRetryAnnouncement(
        outcome === 'verified'
          ? 'Retry succeeded. Attestation is now verified.'
          : 'Retry failed. Please try again later.',
      )
      requestAnimationFrame(() => {
        retryButtonRef.current?.focus()
      })
    }, 2000)
  }, [])

  const handleRetryDialogClose = useCallback(() => {
    if (retryBusy) return
    setRetryDialogOpen(false)
    requestAnimationFrame(() => {
      retryButtonRef.current?.focus()
    })
  }, [retryBusy])

  // ── Loading / not-found states ──────────────────────────────────────────
  if (!id) {
    return (
      <div role="alert" aria-live="polite" style={{ color: 'var(--muted)' }}>
        No attestation ID provided.
      </div>
    )
  }

  if (!attestation) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Attestations', href: '/attestations' }, { label: id }]} />
        <div
          role="alert"
          aria-live="polite"
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--muted)',
          }}
        >
          Attestation <strong style={{ color: 'var(--text)' }}>{id}</strong> was not found.
        </div>
      </div>
    )
  }

  const currentAttestation = { ...attestation, status: retryStatus ?? attestation.status }
  const status = STATUS_STYLES[currentAttestation.status]
  const printStatus = PRINT_STATUS[currentAttestation.status]
  const issuedOn = formatDate(attestation.timestamp)
  const formattedTotal = `${attestation.totalRevenue} ${attestation.currency}`
  const timelineSteps = generateTimelineSteps(currentAttestation)

  return (
    <article
      className="certificate"
      aria-label={`Certificate of revenue attestation: ${attestation.id}`}
      data-cert-id={attestation.id}
    >
      {/* ── Screen-only breadcrumb ──────────────────────────────────────── */}
      <div className="no-print" style={{ width: '100%' }}>
        <Breadcrumb
          items={[
            { label: 'Attestations', href: '/attestations' },
            { label: `Attestation ${attestation.id}` },
          ]}
        />
      </div>

      {/* ── Screen-only header ─────────────────────────────────────────── */}
      <header
        className="screen-only"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 3vw, 2rem)' }}>
          Attestation Proof
        </h1>
        <span
          role="status"
          aria-label={printStatus.ariaLabel}
          className="no-print"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--primary)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {status.label}
        </span>
        <button
          ref={shareButtonRef}
          type="button"
          onClick={() => setIsShareOpen(true)}
          aria-label={
            currentAttestation.status === 'verified'
              ? 'Share proof'
              : `Share proof — not available for ${currentAttestation.status} attestations`
          }
          title={
            currentAttestation.status === 'verified'
              ? 'Share this attestation proof'
              : `Sharing is only available for verified attestations (current status: ${currentAttestation.status})`
          }
          disabled={currentAttestation.status !== 'verified'}
          className="no-print"
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.85rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            background: 'var(--surface)',
            color: currentAttestation.status === 'verified' ? 'var(--text)' : 'var(--muted)',
            cursor: currentAttestation.status === 'verified' ? 'pointer' : 'not-allowed',
            opacity: currentAttestation.status === 'verified' ? 1 : 0.5,
            transition: 'border-color 160ms, background 160ms',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="2.5" r="1.5" />
            <circle cx="11" cy="11.5" r="1.5" />
            <circle cx="3" cy="7" r="1.5" />
            <line x1="4.4" y1="6.25" x2="9.6" y2="3.25" />
            <line x1="4.4" y1="7.75" x2="9.6" y2="10.75" />
          </svg>
          Share proof
        </button>
        <button
          type="button"
          onClick={handlePrint}
          aria-label="Print certificate"
          title="Print this attestation as a formal certificate"
          className="no-print"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.85rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            background: 'var(--surface)',
            color: 'var(--text)',
            cursor: 'pointer',
            transition: 'border-color 160ms, background 160ms',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 4 V1 H11 V4" />
            <rect x="2" y="4" width="10" height="6" rx="1" />
            <rect x="4" y="8" width="6" height="4" />
            <circle cx="11" cy="6.5" r="0.6" fill="currentColor" />
          </svg>
          Print Certificate
        </button>
      </header>

      {/* ── Print-only formal header ───────────────────────────────────── */}
      <header className="certificate-header print-only">
        <div className="certificate-brand">
          <svg viewBox="0 0 40 40" aria-hidden="true" className="certificate-brand-mark">
            <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" strokeWidth="1" />
            <text
              x="20"
              y="25"
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill="currentColor"
            >
              V
            </text>
          </svg>
          <span>
            <span className="certificate-brand-name">Veritasor</span>
            <span className="certificate-brand-tagline">Revenue Attestation Protocol</span>
          </span>
        </div>
        <div className="certificate-header-meta">
          <div>
            <strong>Document ID</strong>
          </div>
          <div style={{ fontFamily: '"Courier New", monospace' }}>{attestation.id}</div>
          <div style={{ marginTop: 4 }}>
            <strong>Issued</strong> {issuedOn}
          </div>
        </div>
      </header>

      {/* ── Print-only title block ────────────────────────────────────── */}
      <section className="certificate-title-block print-only">
        <p className="certificate-eyebrow">On-Chain Revenue Attestation</p>
        <h2 className="certificate-title">Certificate of Revenue Attestation</h2>
        <p className="certificate-subtitle">
          Formally attested on the Stellar public network.
        </p>
      </section>

      {/* ── Print-only issuer statement ────────────────────────────────── */}
      <section className="certificate-statement print-only" aria-label="Issuance statement">
        <p>
          This document certifies that the <strong>{attestation.recordCount.toLocaleString()}</strong>{' '}
          revenue entries summarised below, totalling{' '}
          <strong>{formattedTotal}</strong>, were cryptographically committed to the
          Stellar public ledger under the Merkle root{' '}
          <strong>{attestation.merkleRoot}</strong>, and were anchored on-chain at{' '}
          <strong>{issuedOn}</strong>.
        </p>
      </section>

      {/* ── Failure Banner (screen-only) ───────────────────────────────── */}
      {(attestation.status === 'failed' || retryStatus !== null) && (
        <section
          aria-labelledby="retry-banner-title"
          className="no-print"
          style={{
            background: currentAttestation.status === 'verified' ? 'var(--success-soft)' : 'var(--danger-soft)',
            border: `1px solid ${currentAttestation.status === 'verified' ? 'var(--success)' : 'var(--danger)'}`,
            borderRadius: 'var(--radius-sm)',
            padding: '1.25rem',
            marginBottom: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={currentAttestation.status === 'verified' ? 'var(--success)' : 'var(--danger)'} strokeWidth="2" aria-hidden="true" style={{ marginTop: '0.1rem', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              {currentAttestation.status === 'verified' ? (
                <path d="m8 12 2.5 2.5L16 9" />
              ) : (
                <>
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              )}
            </svg>
            <div>
              <h2 id="retry-banner-title" style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem', color: currentAttestation.status === 'verified' ? 'var(--success)' : 'var(--danger)' }}>
                {currentAttestation.status === 'verified'
                  ? 'Attestation Retry Complete'
                  : currentAttestation.status === 'pending'
                    ? 'Attestation Retry In Progress'
                    : 'Attestation Failed'}
              </h2>
              {currentAttestation.status !== 'verified' && (
                <p style={{ margin: '0 0 0.25rem 0', color: 'var(--text)', fontSize: '0.95rem' }}>
                  <strong>Reason:</strong> {attestation.failureReason || 'Unknown error occurred.'}
                </p>
              )}
              {currentAttestation.status !== 'verified' && attestation.remediation && (
                <p style={{ margin: 0, color: 'var(--text)', fontSize: '0.95rem' }}>
                  <strong>Suggested Remediation:</strong> {attestation.remediation}{' '}
                  <Link to="/help" style={{ color: 'var(--danger)', textDecoration: 'underline', fontWeight: 600 }}>
                    Read docs
                  </Link>
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              ref={retryButtonRef}
              type="button"
              onClick={() => setRetryDialogOpen(true)}
              disabled={retryBusy || currentAttestation.status === 'pending'}
              aria-busy={retryBusy}
              className="no-print"
              style={{
                background: 'var(--danger)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: retryBusy || currentAttestation.status === 'pending' ? 'not-allowed' : 'pointer',
                opacity: retryBusy || currentAttestation.status === 'pending' ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
              onMouseOver={(e) => { if (!retryBusy && currentAttestation.status !== 'pending') e.currentTarget.style.opacity = '0.9' }}
              onMouseOut={(e) => { if (!retryBusy && currentAttestation.status !== 'pending') e.currentTarget.style.opacity = '1' }}
            >
              {retryBusy || currentAttestation.status === 'pending'
                ? 'Retrying…'
                : currentAttestation.status === 'verified'
                  ? 'Retry Again'
                  : 'Retry Attestation'}
            </button>
          </div>

          <span
            role="status"
            aria-label="Retry status"
            aria-live="polite"
            aria-atomic="true"
            style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}
          >
            {retryAnnouncement}
          </span>

          <ConfirmDialog
            open={retryDialogOpen}
            title="Retry Attestation"
            description="Are you sure you want to retry this failed attestation? The process will resubmit your data for verification."
            confirmText="Retry"
            cancelText="Cancel"
            tone="danger"
            isLoading={retryBusy}
            onClose={handleRetryDialogClose}
            onConfirm={handleRetryConfirm}
          />
        </section>
      )}

      {/* ── Certificate body: metadata + seal are direct grid children in print ─ */}
      <div className="certificate-body">
      {/* ── Metadata card (visible in both screen and print) ───────────── */}
      <section
        aria-label="Attestation metadata"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '0 1.25rem',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <dl style={{ margin: 0 }}>
          {/* Merkle Root */}
          <MetaRow label="Merkle Root">
            <code
              aria-label="Merkle root hash"
              style={{
                fontSize: '0.85rem',
                color: 'var(--accent)',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
              }}
            >
              <span className="hash-full" aria-hidden="false">{attestation.merkleRoot}</span>
            </code>
            <CopyButton value={attestation.merkleRoot} label="Merkle root" />
          </MetaRow>

          {/* Stellar TX — show truncated on screen, full hash in print via CSS */}
          <MetaRow label="Stellar TX">
            <code
              aria-label="Stellar transaction hash"
              style={{
                fontSize: '0.85rem',
                color: 'var(--muted)',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
              }}
            >
              <span className="hash-truncated" aria-hidden="false">
                {truncate(attestation.stellarTxHash, 10)}
              </span>
              <span className="hash-full" aria-hidden="false">
                {attestation.stellarTxHash}
              </span>
            </code>
            <CopyButton value={attestation.stellarTxHash} label="Stellar transaction hash" />
            <a
              href={`${stellarExplorer}${attestation.stellarTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View transaction on Stellar Expert (opens in new tab)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              Explorer
              {/* external link icon */}
              <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4.5 2H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6.5" />
                <path d="M7 1h3v3M10 1 5.5 5.5" />
              </svg>
            </a>
          </MetaRow>

          {/* Timestamp */}
          <MetaRow label="Timestamp">
            <time dateTime={attestation.timestamp} style={{ color: 'var(--text)' }}>
              {formatDate(attestation.timestamp)}
            </time>
          </MetaRow>

          {/* Records */}
          <MetaRow label="Records">
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
              {attestation.recordCount.toLocaleString()}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>included revenue entries</span>
          </MetaRow>

          {/* Revenue */}
          <MetaRow label="Total Revenue">
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>
              {attestation.totalRevenue}
            </span>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{attestation.currency}</span>
          </MetaRow>

          {/* ID */}
          <MetaRow label="Attestation ID">
            <code style={{ fontSize: '0.85rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
              {attestation.id}
            </code>
            <CopyButton value={attestation.id} label="Attestation ID" />
          </MetaRow>

          {/* Status (grayscale-safe pill — visible in print and screen) */}
          <MetaRow label="Verification Status">
            <span
              className={`certificate-status certificate-status-${currentAttestation.status}`}
              aria-label={printStatus.ariaLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.85rem',
                border: '2px solid var(--text)',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                background: 'var(--surface-soft)',
                color: 'var(--text)',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '1rem', lineHeight: 1 }}>
                {printStatus.glyph}
              </span>
              {printStatus.label}
            </span>
          </MetaRow>
        </dl>
      </section>

      {/* ── Status Timeline (screen-only) ─────────────────────────────────── */}
      <section
        className="no-print"
        aria-label="Attestation lifecycle timeline"
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
        }}
      >
        <h2
          style={{
            margin: '0 0 1.25rem 0',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text)',
          }}
        >
          Attestation Progress
        </h2>
        <StatusTimeline 
          steps={timelineSteps} 
          showTimestamps={true}
          ariaLabel="Attestation lifecycle timeline showing current progress"
        />
      </section>

      {/* ── Print-only certificate body (seal + statement + footer) ────── */}
      <div className="print-only" aria-hidden="true" />

      {/* ── Print-only seal (sits to the right of metadata on print) ────── */}
      <CertificateSeal status={currentAttestation.status} attestationId={attestation.id} />

      {/* ── Print-only failure notice ──────────────────────────────────── */}
      {currentAttestation.status === 'failed' && (
        <section className="certificate-failure-notice print-only" aria-label="Validation failure notice">
          <h2>Validation Not Completed</h2>
          <p>
            <strong>Reason:</strong> {attestation.failureReason || 'Unknown error occurred.'}
          </p>
          {attestation.remediation && (
            <p>
              <strong>Suggested Remediation:</strong> {attestation.remediation}
            </p>
          )}
          <p>This certificate reflects an attempted attestation that did not publish to the Stellar public network.</p>
        </section>
      )}
      </div>

      {/* ── Print-only formal footer ───────────────────────────────────── */}
      <footer
        className="certificate-footer print-only"
        role="contentinfo"
        aria-label="Certificate footer"
      >
        <div className="certificate-signature">
          <div>Signed on behalf of the issuing authority:</div>
          <div className="certificate-signature-name">Veritasor Protocol</div>
          <div className="certificate-signature-title">Issuing Authority</div>
        </div>
        <div className="certificate-meta-stack">
          <div>
            <strong>Document</strong> {attestation.id}
          </div>
          <div>
            <strong>Printed</strong>{' '}
            <time dateTime={printedOn ?? now.toISOString()}>
              {printedOn
                ? formatDate(printedOn)
                : `${formatDate(now.toISOString())} (preview)`}
            </time>
          </div>
          <div>veritasor.app / attestations / {attestation.id}</div>
        </div>
      </footer>

      {/* ── Print-only authenticity line ───────────────────────────────── */}
      <p className="certificate-authenticity print-only" aria-label="Authentication reference">
        Authenticated against Stellar transaction hash{' '}
        <code>{attestation.stellarTxHash}</code>. Verify at stellar.expert.
      </p>

      {/* ── Screen-only back link ──────────────────────────────────────── */}
      <div className="screen-only" style={{ marginTop: '2rem' }}>
        <BackLink />
      </div>

      {/* ── Share proof modal (screen-only, excluded from print) ───────── */}
      <ProofShareModal
        isOpen={isShareOpen}
        onClose={handleShareClose}
        attestationId={attestation.id}
      />
    </article>
  )
}
