import { useState } from 'react'
import { Link } from 'react-router-dom'
import AttestationConfirmModal from '../components/AttestationConfirmModal'
import UsageMeter from '../components/UsageMeter'
import { useViewportObserver } from '../hooks/useViewportObserver'
import { useToast } from '../components/ToastContext'
import { useAttestations } from '../state/attestations'
import { DEFAULT_TRIGGER_DETAILS } from '../state/attestationMocks'

const METRICS = [
  { label: 'Total Revenue', value: '$84,320', sub: 'YTD 2026' },
  { label: 'Attestations', value: '12', sub: 'This month' },
  { label: 'Revenue Sources', value: '3', sub: 'Connected' },
]

// Demo usage data — swap for real API values in production
const USAGE_DATA = [
  {
    label: 'Attestations',
    used: 9,
    limit: 10,
    unit: 'attestations',
    period: 'July 2026',
  },
  {
    label: 'API calls',
    used: 7_520,
    limit: 10_000,
    unit: 'calls',
    period: 'July 2026',
  },
]

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [attestError, setAttestError] = useState<string | null>(null)
  const { trigger } = useAttestations()
  const { addToast } = useToast()

  // Entrance animation observers — one per metric card
  const { ref: revenueRef, isVisible: revenueVisible } = useViewportObserver<HTMLDivElement>()
  const { ref: attestationsRef, isVisible: attestationsVisible } = useViewportObserver<HTMLDivElement>()
  const { ref: sourcesRef, isVisible: sourcesVisible } = useViewportObserver<HTMLDivElement>()
  const { ref: usageSectionRef, isVisible: usageVisible } = useViewportObserver<HTMLDivElement>({ threshold: 0.05 })
  const { ref: actionsRef, isVisible: actionsVisible } = useViewportObserver<HTMLDivElement>()

  async function handleConfirm() {
    setIsLoading(true)
    setAttestError(null)
    try {
      await trigger(DEFAULT_TRIGGER_DETAILS)
      addToast('Attestation submitted successfully.', 'success')
      setModalOpen(false)
    } catch (err) {
      setAttestError(err instanceof Error ? err.message : 'Failed to process attestation')
    } finally {
      setIsLoading(false)
    }
  }

  function handleClose() {
    setModalOpen(false)
    setAttestError(null)
  }

  return (
    <div className="dashboard-page">
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ color: 'var(--muted)' }}>
        Connect your revenue sources and manage attestations from here. (Demo build: all figures shown are sample data.)
      </p>

      <div className="dashboard-grid">
        <section className="dashboard-section">
          <h2>Key metrics</h2>
          <div className="dashboard-metrics-grid">
            {METRICS.map((m, i) => {
              const refs = [revenueRef, attestationsRef, sourcesRef]
              const visibles = [revenueVisible, attestationsVisible, sourcesVisible]
              const metricRef = refs[i] ?? refs[0]
              const isVisible = visibles[i] ?? false
              return (
                <div
                  key={m.label}
                  ref={metricRef}
                  className={`dashboard-metric-card chart-entrance chart-entrance-bar-grow${isVisible ? ' chart-entrance-animate' : ''}`}
                  style={{
                    transitionDelay: `${i * 60}ms`,
                    animationDelay: `${i * 60}ms`,
                    willChange: isVisible ? undefined : 'opacity, transform',
                  }}
                >
                  <span className="dashboard-metric-label">{m.label}</span>
                  <span className="dashboard-metric-value">{m.value}</span>
                  <span className="dashboard-metric-sub">{m.sub}</span>
                </div>
              )
            })}
          </div>
        </section>

        <section
          className={`dashboard-section${actionsVisible ? ' chart-entrance chart-entrance-animate' : ' chart-entrance'}`}
          ref={actionsRef}
        >
          <h2>Quick actions</h2>
          <ul className="dashboard-actions-list">
            <li>
              <Link to="/connect-source/provider" aria-label="Open connect source wizard">
                Connect Stripe, Razorpay, or Shopify
              </Link>
            </li>
            <li>
              <button
                type="button"
                className="dashboard-action-btn"
                onClick={() => setModalOpen(true)}
              >
                Trigger monthly revenue report
              </button>
            </li>
            <li><Link to="/attestations">View attestation history</Link></li>
          </ul>
        </section>

        <section
          className={`dashboard-section chart-entrance chart-entrance-line-draw${usageVisible ? ' chart-entrance-animate' : ''}`}
          ref={usageSectionRef}
          aria-labelledby="usage-heading"
        >
          <h2 id="usage-heading">Usage this month</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {USAGE_DATA.map((u) => (
              <UsageMeter
                key={u.label}
                label={u.label}
                used={u.used}
                limit={u.limit}
                unit={u.unit}
                period={u.period}
              />
            ))}
          </div>
        </section>
      </div>

      <AttestationConfirmModal
        open={modalOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        isLoading={isLoading}
        error={attestError}
        details={DEFAULT_TRIGGER_DETAILS}
      />
    </div>
  )
}
