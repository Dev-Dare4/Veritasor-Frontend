import { useEffect, useId, useState } from 'react'
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from 'react-router-dom'
import WizardProgress from '../../components/WizardProgress'
import { useToast } from '../../components/ToastContext'
import { sourcesStore, generateSourceId } from '../../store/sourcesStore'

type ProviderId = 'stripe' | 'shopify' | 'razorpay'
type OAuthCallbackState = 'success' | 'denied' | 'expired' | 'unknown'
type AuthorizationStatus = 'idle' | 'pending' | 'authorized' | 'denied' | 'expired' | 'unknown'
type SyncWindowId = 'trailing-12-months' | 'current-fiscal-year' | 'all-history'

// ---------------------------------------------------------------------------
// Mapping step types (#223)
// ---------------------------------------------------------------------------

type InternalCategory = 'recurring' | 'one-time' | 'refund' | 'fee' | 'other'
type LedgerAccount = 'revenue' | 'deferred' | 'contra' | 'expense' | 'unassigned'

interface CurrencyRow {
  /** ISO 4217 code as reported by the source */
  currency: string
  /** User-assigned internal category */
  category: InternalCategory | null
  /** User-assigned ledger account */
  ledgerAccount: LedgerAccount | null
}

type ProviderDefinition = {
  id: ProviderId
  name: string
  badge: string
  description: string
  note: string
}

type SyncWindowDefinition = {
  id: SyncWindowId
  label: string
  description: string
}

type WizardStep = {
  id: string
  path: string
  label: string
  detail: string
}

type WizardData = {
  provider: ProviderId | null
  authorizationStatus: AuthorizationStatus
  oauthCallbackState: OAuthCallbackState
  syncWindow: SyncWindowId | null
  optionalScopes: string[]
  /** Currency/ledger mapping rows (#223) */
  currencyMappings: CurrencyRow[]
  confirmLeastPrivilege: boolean
  scopeValidationAttempted: boolean
  mappingValidationAttempted: boolean
}

type WizardContext = {
  data: WizardData
  currentStepIndex: number
  providerName: string
  setProvider: (provider: ProviderId) => void
  startAuthorization: () => void
  setAuthorizationDenied: () => void
  setOAuthCallbackState: (state: OAuthCallbackState) => void
  setSyncWindow: (windowId: SyncWindowId) => void
  toggleOptionalScope: (scopeId: string) => void
  setCurrencyMapping: (currency: string, field: 'category' | 'ledgerAccount', value: string) => void
  setConfirmLeastPrivilege: (checked: boolean) => void
  runTestConnection: () => void
  resetTestConnection: () => void
}

const providerOptions: ProviderDefinition[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    badge: 'Most requested',
    description: 'Sync payouts, charges, and balance movements used in attestation runs.',
    note: 'Read-only OAuth permissions with fast reconnect support.',
  },
  {
    id: 'shopify',
    name: 'Shopify',
    badge: 'Commerce',
    description: 'Bring order and payout summaries into one source of truth for revenue checks.',
    note: 'Best for marketplace or storefront-led reporting workflows.',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    badge: 'Emerging markets',
    description: 'Verify settlements and fee data without exposing payout controls.',
    note: 'Useful for teams reconciling multi-region payment activity.',
  },
]

const requiredScopes = [
  'Read payout and settlement totals required to compute attestation evidence.',
  'Read charge and refund metadata needed for reconciliation checks.',
  'Read account configuration relevant to revenue-source ownership.',
]

const optionalScopes = [
  {
    id: 'disputes',
    label: 'Include disputes and adjustments',
    description: 'Adds supporting context for revenue exceptions and negative adjustments.',
  },
  {
    id: 'subscriptions',
    label: 'Include subscription summaries',
    description: 'Useful when attestations should separate recurring revenue from one-off sales.',
  },
]

const syncWindows: SyncWindowDefinition[] = [
  {
    id: 'trailing-12-months',
    label: 'Trailing 12 months',
    description: 'Recommended for first-time connections and lighter initial syncs.',
  },
  {
    id: 'current-fiscal-year',
    label: 'Current fiscal year',
    description: 'Pulls only the active reporting year for a faster initial review.',
  },
  {
    id: 'all-history',
    label: 'All available history',
    description: 'Best when a backfill is needed before publishing the next attestation.',
  },
]

const wizardSteps: WizardStep[] = [
  {
    id: 'provider',
    path: '/connect-source/provider',
    label: 'Select provider',
    detail: 'Choose the revenue platform we should connect.',
  },
  {
    id: 'authorize',
    path: '/connect-source/authorize',
    label: 'Authorize',
    detail: 'Complete the secure provider handoff.',
  },
  {
    id: 'callback',
    path: '/connect-source/callback',
    label: 'OAuth callback',
    detail: 'Review authorization feedback and scope permissions.',
  },
  {
    id: 'scope',
    path: '/connect-source/scope',
    label: 'Configure scope',
    detail: 'Decide how much history and supporting context to sync.',
  },
  {
    id: 'mapping',
    path: '/connect-source/mapping',
    label: 'Map currencies',
    detail: 'Assign internal categories and ledger accounts to source currencies.',
  },
  {
    id: 'confirm',
    path: '/connect-source/confirm',
    label: 'Confirm',
    detail: 'Review the connection before finishing.',
  },
]

// Default currency rows — in production these would come from the provider's account info
const DEFAULT_CURRENCY_ROWS: CurrencyRow[] = [
  { currency: 'USD', category: 'recurring', ledgerAccount: 'revenue' },
  { currency: 'EUR', category: null, ledgerAccount: null },
  { currency: 'GBP', category: null, ledgerAccount: null },
  { currency: 'INR', category: null, ledgerAccount: null },
]

const CATEGORY_OPTIONS: { value: InternalCategory; label: string }[] = [
  { value: 'recurring', label: 'Recurring' },
  { value: 'one-time', label: 'One-time' },
  { value: 'refund', label: 'Refund' },
  { value: 'fee', label: 'Fee' },
  { value: 'other', label: 'Other' },
]

const LEDGER_OPTIONS: { value: LedgerAccount; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'deferred', label: 'Deferred revenue' },
  { value: 'contra', label: 'Contra revenue' },
  { value: 'expense', label: 'Expense' },
  { value: 'unassigned', label: 'Unassigned' },
]

const initialWizardData: WizardData = {
  provider: null,
  authorizationStatus: 'idle',
  oauthCallbackState: 'success',
  syncWindow: null,
  optionalScopes: [],
  currencyMappings: DEFAULT_CURRENCY_ROWS,
  confirmLeastPrivilege: false,
  scopeValidationAttempted: false,
  mappingValidationAttempted: false,
}

function getProviderName(provider: ProviderId | null) {
  return providerOptions.find((option) => option.id === provider)?.name ?? 'your provider'
}

function getStepIndex(pathname: string) {
  return wizardSteps.findIndex((step) => pathname.endsWith(step.path))
}

function isProviderComplete(data: WizardData) {
  return data.provider !== null
}

function isAuthorizeComplete(data: WizardData) {
  return isProviderComplete(data) && data.authorizationStatus !== 'idle' && data.authorizationStatus !== 'pending'
}

function isCallbackComplete(data: WizardData) {
  return (
    isAuthorizeComplete(data) &&
    (data.authorizationStatus === 'authorized' || data.oauthCallbackState === 'success')
  )
}

function isScopeComplete(data: WizardData) {
  return isCallbackComplete(data) && data.syncWindow !== null
}

function isMappingComplete(data: WizardData) {
  return (
    isScopeComplete(data) &&
    data.currencyMappings.every((row) => row.category !== null && row.ledgerAccount !== null)
  )
}

function getFirstIncompleteStepIndex(data: WizardData) {
  if (!isProviderComplete(data)) return 0
  if (!isAuthorizeComplete(data)) return 1
  if (!isCallbackComplete(data)) return 2
  if (!isScopeComplete(data)) return 3
  if (!isMappingComplete(data)) return 4
  return 5
}

function useWizardContext() {
  return useOutletContext<WizardContext>()
}

export function ConnectSourceWizard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [data, setData] = useState<WizardData>(initialWizardData)
  const currentStepIndex = getStepIndex(location.pathname)
  const providerName = getProviderName(data.provider)

  useEffect(() => {
    if (currentStepIndex === -1) {
      navigate(wizardSteps[0].path, { replace: true })
      return
    }

    const furthestAllowedStepIndex = getFirstIncompleteStepIndex(data)

    if (currentStepIndex > furthestAllowedStepIndex) {
      navigate(wizardSteps[furthestAllowedStepIndex].path, { replace: true })
    }
  }, [currentStepIndex, data, navigate])

  useEffect(() => {
    if (data.authorizationStatus !== 'pending') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setData((currentData) => ({
        ...currentData,
        authorizationStatus: 'authorized',
        oauthCallbackState: 'success',
      }))
      navigate('/connect-source/callback?state=success')
    }, 900)

    return () => window.clearTimeout(timeoutId)
  }, [data.authorizationStatus, navigate])

  useEffect(() => {
    const activeStep = wizardSteps[currentStepIndex]

    if (!activeStep) {
      return
    }

    document.title = `${activeStep.label} | Connect source | Veritasor`
  }, [currentStepIndex])

  if (currentStepIndex === -1) {
    return null
  }

  const activeStep = wizardSteps[currentStepIndex]
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === wizardSteps.length - 1

  const isPrimaryDisabled =
    activeStep.id === 'provider'
      ? !isProviderComplete(data)
      : activeStep.id === 'authorize'
        ? data.authorizationStatus !== 'authorized'
        : activeStep.id === 'callback'
          ? data.oauthCallbackState !== 'success'
          : activeStep.id === 'confirm'
            ? !data.confirmLeastPrivilege
            : false

  function goToStep(index: number) {
    navigate(wizardSteps[index].path)
  }

  function handleNext() {
    if (activeStep.id === 'scope' && data.syncWindow === null) {
      setData((currentData) => ({
        ...currentData,
        scopeValidationAttempted: true,
      }))
      return
    }

    if (activeStep.id === 'mapping') {
      const hasUnmapped = data.currencyMappings.some(
        (row) => row.category === null || row.ledgerAccount === null,
      )
      if (hasUnmapped) {
        setData((currentData) => ({
          ...currentData,
          mappingValidationAttempted: true,
        }))
        return
      }
    }

    if (isLastStep) {
      // Build a new Source from wizard data and add it to the shared store
      const providerName = getProviderName(data.provider)
      const newSource = {
        id: generateSourceId(),
        provider: providerName,
        accountLabel: `${providerName.toLowerCase()}-connected`,
        status: 'healthy' as const,
        lastSync: new Date().toISOString(),
      }
      sourcesStore.add(newSource)
      addToast(`${providerName} connected successfully`, 'success')
      navigate('/sources')
      return
    }

    goToStep(currentStepIndex + 1)
  }

  const context: WizardContext = {
    data,
    currentStepIndex,
    providerName,
    setProvider: (provider) =>
      setData({
        provider,
        authorizationStatus: 'idle',
        oauthCallbackState: 'success',
        syncWindow: null,
        optionalScopes: [],
        currencyMappings: DEFAULT_CURRENCY_ROWS,
        confirmLeastPrivilege: false,
        scopeValidationAttempted: false,
        mappingValidationAttempted: false,
      }),
    startAuthorization: () =>
      setData((currentData) => ({
        ...currentData,
        authorizationStatus: 'pending',
      })),
    setAuthorizationDenied: () => {
      setData((currentData) => ({
        ...currentData,
        authorizationStatus: 'denied',
        oauthCallbackState: 'denied',
      }))
      navigate('/connect-source/callback?state=denied')
    },
    setOAuthCallbackState: (state) =>
      setData((currentData) => ({
        ...currentData,
        oauthCallbackState: state,
        authorizationStatus:
          state === 'success'
            ? 'authorized'
            : state === 'denied'
              ? 'denied'
              : state === 'expired'
                ? 'expired'
                : 'unknown',
      })),
    setSyncWindow: (windowId) =>
      setData((currentData) => ({
        ...currentData,
        syncWindow: windowId,
        scopeValidationAttempted: false,
        confirmLeastPrivilege: false,
      })),
    toggleOptionalScope: (scopeId) =>
      setData((currentData) => ({
        ...currentData,
        optionalScopes: currentData.optionalScopes.includes(scopeId)
          ? currentData.optionalScopes.filter((currentScope) => currentScope !== scopeId)
          : [...currentData.optionalScopes, scopeId],
        confirmLeastPrivilege: false,
      })),
    setCurrencyMapping: (currency, field, value) =>
      setData((currentData) => ({
        ...currentData,
        mappingValidationAttempted: false,
        currencyMappings: currentData.currencyMappings.map((row) =>
          row.currency === currency
            ? { ...row, [field]: value === '' ? null : value }
            : row,
        ),
      })),
    setConfirmLeastPrivilege: (checked) =>
      setData((currentData) => ({
        ...currentData,
        confirmLeastPrivilege: checked,
      })),
    runTestConnection: () => {},
    resetTestConnection: () => {},
  }

  return (
    <section className="app-page wizard-page">
      <header className="page-header page-header-tight">
        <p className="page-eyebrow">Connect revenue source</p>
        <div className="page-header-split">
          <div>
            <h1 className="page-title">Guide teams through a safer connection flow</h1>
            <p className="page-description">
              The wizard keeps sensitive setup linear: pick a provider, complete the secure
              handoff, set the sync scope, then confirm the read-only connection.
            </p>
          </div>
        </div>
      </header>

      <div className="wizard-shell app-card">
        <WizardProgress currentStepIndex={currentStepIndex} steps={wizardSteps} />

        <div className="wizard-content">
          <header className="wizard-step-heading">
            <p className="wizard-step-eyebrow">{providerName}</p>
            <h2>{activeStep.label}</h2>
            <p>{activeStep.detail}</p>
          </header>

          <Outlet context={context} />
        </div>

        <footer className="wizard-footer">
          <Link to="/" className="app-button app-button-ghost wizard-cancel">
            Cancel
          </Link>

          <div className="wizard-footer-actions">
            {!isFirstStep ? (
              <button
                type="button"
                className="app-button app-button-secondary"
                onClick={() => goToStep(currentStepIndex - 1)}
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="app-button app-button-primary"
              onClick={handleNext}
              disabled={isPrimaryDisabled}
            >
              {isLastStep ? 'Finish connection' : 'Next'}
            </button>
          </div>
        </footer>
      </div>
    </section>
  )
}

export function SelectSourceProviderStep() {
  const { data, setProvider } = useWizardContext()

  return (
    <div className="wizard-step-body">
      <div className="wizard-callout">
        <h3>Why this step comes first</h3>
        <p>
          Provider selection affects both the authorization language and the downstream scope
          copy, so the wizard keeps later steps locked until a source is chosen.
        </p>
      </div>

      <fieldset className="wizard-fieldset">
        <legend className="wizard-legend">Choose a revenue provider</legend>
        <p className="wizard-supporting-copy">
          Each option uses the same shell and action layout, but keeps the provider-specific
          trust note visible before the user is asked to authorize anything.
        </p>

        <div className="wizard-choice-grid">
          {providerOptions.map((provider) => {
            const isChecked = data.provider === provider.id

            return (
              <label key={provider.id} className="wizard-choice-card">
                <input
                  className="wizard-choice-input"
                  type="radio"
                  name="provider"
                  value={provider.id}
                  checked={isChecked}
                  onChange={() => setProvider(provider.id)}
                />
                <span className="wizard-choice-surface">
                  <span className="wizard-choice-headline">
                    <span className="wizard-choice-title">{provider.name}</span>
                    <span className="wizard-choice-badge">{provider.badge}</span>
                  </span>
                  <span className="wizard-choice-description">{provider.description}</span>
                  <span className="wizard-choice-note">{provider.note}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}

export function ProviderLogo({ provider }: { provider: ProviderId | null }) {
  if (provider === 'stripe') {
    return (
      <div className="provider-logo-badge stripe-badge" aria-label="Stripe logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M13.9 8.6c0-.7.6-1 1.6-1 1.4 0 3.2.5 4.5 1.2V4.5c-1.5-.6-3.1-.9-4.7-.9-3.9 0-6.5 2-6.5 5.2 0 4.9 6.7 4.1 6.7 6.3 0 .8-.7 1.1-1.7 1.1-1.6 0-3.7-.7-5.2-1.5v4.4c1.7.7 3.5 1.1 5.2 1.1 4 0 6.8-2 6.8-5.3-.1-5.3-6.7-4.3-6.7-6.3z" fill="#635BFF"/>
        </svg>
        <span>Stripe</span>
      </div>
    )
  }
  if (provider === 'shopify') {
    return (
      <div className="provider-logo-badge shopify-badge" aria-label="Shopify logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M18.5 4.5L16.2 3s-.3 0-.5.2l-1.3 1.2c-.3-.2-.7-.4-1.2-.5l-.3-1.8c0-.2-.2-.3-.4-.3h-2.1c-.2 0-.4.1-.4.3l-.3 1.8c-.5.1-.9.3-1.2.5L7.2 3.2c-.2-.2-.4-.2-.5-.2L4.4 4.5c-.2.1-.2.4-.1.5l1.4 2.2c-.3.4-.5.9-.6 1.4L3.3 9c-.2.1-.3.3-.3.5v2.6c0 .2.1.4.3.5l1.8.4c.1.5.3 1 .6 1.4L4.3 16.6c-.1.2-.1.4.1.5l2.3 1.5c.2.1.4.1.5-.1l1.3-1.2c.5.3 1 .5 1.5.6l.3 1.8c0 .2.2.3.4.3h2.6c.2 0 .4-.1.4-.3l.3-1.8c.5-.1 1-.3 1.5-.6l1.3 1.2c.1.2.4.2.5.1l2.3-1.5c.2-.1.2-.4.1-.5l-1.4-2.2c.3-.4.5-.9.6-1.4l1.8-.4c.2-.1.3-.3.3-.5V9.5c0-.2-.1-.4-.3-.5l-1.8-.4c-.1-.5-.3-1-.6-1.4l1.4-2.2c.1-.1.1-.4-.1-.5z" fill="#95BF47"/>
        </svg>
        <span>Shopify</span>
      </div>
    )
  }
  if (provider === 'razorpay') {
    return (
      <div className="provider-logo-badge razorpay-badge" aria-label="Razorpay logo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4.5 20.5l4-17h11l-3 4.5-5.5.5-2.5 12z" fill="#0C2340"/>
          <path d="M12.5 8l-3 12.5h3.5l2.5-12.5z" fill="#0284C7"/>
        </svg>
        <span>Razorpay</span>
      </div>
    )
  }
  return (
    <div className="provider-logo-badge default-badge" aria-label="Revenue Source logo">
      <span>{provider || 'Revenue Source'}</span>
    </div>
  )
}

export function AuthorizeSourceStep() {
  const { data, providerName, startAuthorization, setAuthorizationDenied, setOAuthCallbackState } = useWizardContext()
  const navigate = useNavigate()

  return (
    <div className="wizard-step-body">
      <div className="wizard-two-column">
        <section className="app-card wizard-inline-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3>Before redirecting to {providerName}</h3>
            <ProviderLogo provider={data.provider} />
          </div>
          <p className="wizard-supporting-copy">
            The CTA below stands in for an OAuth handoff. The step keeps the main Next button
            disabled until the handoff resolves, so the user cannot skip over authorization.
          </p>
          <ul className="wizard-list">
            {requiredScopes.map((scope) => (
              <li key={scope}>{scope}</li>
            ))}
          </ul>
          <div className="wizard-inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
            <button
              type="button"
              className="app-button app-button-primary"
              onClick={startAuthorization}
              disabled={data.authorizationStatus === 'pending'}
            >
              {data.authorizationStatus === 'pending'
                ? `Connecting to ${providerName}...`
                : `Simulate secure redirect`}
            </button>
            <button
              type="button"
              className="app-button app-button-secondary"
              onClick={setAuthorizationDenied}
              disabled={data.authorizationStatus === 'pending'}
            >
              Simulate access denied
            </button>
            <button
              type="button"
              className="app-button app-button-ghost"
              onClick={() => {
                setOAuthCallbackState('expired')
                navigate('/connect-source/callback?state=expired')
              }}
              disabled={data.authorizationStatus === 'pending'}
            >
              Simulate expired session
            </button>
            <button
              type="button"
              className="app-button app-button-ghost"
              onClick={() => {
                setOAuthCallbackState('unknown')
                navigate('/connect-source/callback?state=unknown')
              }}
              disabled={data.authorizationStatus === 'pending'}
            >
              Simulate unknown error
            </button>
          </div>
        </section>

        <aside className="app-card wizard-status-card">
          <h3>Connection status</h3>
          {data.authorizationStatus === 'idle' ? (
            <p className="wizard-status-message">
              Waiting for the provider handoff. Keep Next disabled until the secure redirect
              finishes successfully.
            </p>
          ) : null}
          {data.authorizationStatus === 'pending' ? (
            <p className="wizard-status-message wizard-status-message-info" role="status">
              Securely establishing the connection and checking the returned permissions.
            </p>
          ) : null}
          {data.authorizationStatus === 'authorized' ? (
            <p className="wizard-status-message wizard-status-message-success" role="status">
              Read-only access confirmed. The user can now continue to scope configuration.
            </p>
          ) : null}
          {data.authorizationStatus === 'denied' ? (
            <p className="wizard-status-message wizard-status-message-error" role="alert">
              Authorization was denied. Keep the user in this step, explain the impact, and
              provide a retry path instead of silently dropping them back to the dashboard.
            </p>
          ) : null}
          {data.authorizationStatus === 'expired' ? (
            <p className="wizard-status-message wizard-status-message-error" role="alert">
              Authorization session expired before completion.
            </p>
          ) : null}
          {data.authorizationStatus === 'unknown' ? (
            <p className="wizard-status-message wizard-status-message-error" role="alert">
              Unknown OAuth callback response error encountered.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

export function OAuthCallbackLandingStep() {
  const { data, providerName, setOAuthCallbackState } = useWizardContext()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const stateParam = searchParams.get('state') || searchParams.get('status') || searchParams.get('error')
    if (stateParam) {
      const lower = stateParam.toLowerCase()
      if (lower.includes('denied') || lower.includes('access_denied')) {
        setOAuthCallbackState('denied')
      } else if (lower.includes('expire') || lower.includes('timeout')) {
        setOAuthCallbackState('expired')
      } else if (lower.includes('unknown') || lower.includes('error') || lower.includes('invalid')) {
        setOAuthCallbackState('unknown')
      } else if (lower.includes('success') || lower.includes('authorized')) {
        setOAuthCallbackState('success')
      }
    }
  }, [searchParams, setOAuthCallbackState])

  const currentState: OAuthCallbackState = data.oauthCallbackState || 'success'

  const stateDetails: Record<
    OAuthCallbackState,
    {
      badgeClass: string
      badgeText: string
      title: string
      subtitle: string
      telemetryCode: string
      telemetryDetail: string
      refId: string
      primaryCtaLabel: string
      primaryCtaAction: () => void
      secondaryCtaLabel: string
      secondaryCtaAction: () => void
      isError: boolean
    }
  > = {
    success: {
      badgeClass: 'status-success',
      badgeText: 'Authorization Successful',
      title: `Connected to ${providerName}`,
      subtitle: `Verifiable read-only credentials issued. Scope permissions verified against least-privilege standards.`,
      telemetryCode: 'AUTH_SUCCESS_READ_ONLY',
      telemetryDetail: 'OAuth 2.0 PKCE flow completed. Token hash registered safely with read-only scopes.',
      refId: 'auth-ref-success-2001',
      primaryCtaLabel: 'Continue to scope configuration',
      primaryCtaAction: () => navigate('/connect-source/scope'),
      secondaryCtaLabel: 'Re-authorize connection',
      secondaryCtaAction: () => navigate('/connect-source/authorize'),
      isError: false,
    },
    denied: {
      badgeClass: 'status-denied',
      badgeText: 'Access Denied',
      title: `Authorization declined by ${providerName}`,
      subtitle: `The consent request was declined during the OAuth handoff step by the account owner or provider.`,
      telemetryCode: 'ERR_OAUTH_ACCESS_DENIED',
      telemetryDetail: 'Permission request was explicitly denied or canceled. No tokens or account credentials were generated.',
      refId: 'auth-ref-denied-8492',
      primaryCtaLabel: 'Retry authorization',
      primaryCtaAction: () => navigate('/connect-source/authorize'),
      secondaryCtaLabel: 'Choose another provider',
      secondaryCtaAction: () => navigate('/connect-source/provider'),
      isError: true,
    },
    expired: {
      badgeClass: 'status-expired',
      badgeText: 'Session Expired',
      title: 'OAuth state token expired',
      subtitle: 'The authorization handoff timed out before completion. Session state hashes have been safely invalidated.',
      telemetryCode: 'ERR_OAUTH_SESSION_EXPIRED',
      telemetryDetail: 'State verification token expired after 15 minutes of inactivity. Anti-CSRF tokens cleared.',
      refId: 'auth-ref-expired-3091',
      primaryCtaLabel: 'Restart authorization',
      primaryCtaAction: () => navigate('/connect-source/authorize'),
      secondaryCtaLabel: 'Choose another provider',
      secondaryCtaAction: () => navigate('/connect-source/provider'),
      isError: true,
    },
    unknown: {
      badgeClass: 'status-unknown',
      badgeText: 'Handoff Error',
      title: 'Unexpected OAuth response',
      subtitle: 'An unrecognized or malformed payload was received during the revenue provider redirect.',
      telemetryCode: 'ERR_OAUTH_INVALID_RESPONSE',
      telemetryDetail: 'Callback URI payload failed validation checks. Raw error parameters omitted for telemetry safety.',
      refId: 'auth-ref-unknown-9182',
      primaryCtaLabel: 'Try connecting again',
      primaryCtaAction: () => navigate('/connect-source/authorize'),
      secondaryCtaLabel: 'Return to provider selection',
      secondaryCtaAction: () => navigate('/connect-source/provider'),
      isError: true,
    },
  }

  const currentDetails = stateDetails[currentState]

  return (
    <div className="wizard-step-body oauth-callback-wrapper">
      {/* State Switcher for visual inspection and review */}
      <div className="oauth-state-tabs" role="tablist" aria-label="OAuth callback state variants">
        {(['success', 'denied', 'expired', 'unknown'] as OAuthCallbackState[]).map((tabState) => (
          <button
            key={tabState}
            type="button"
            role="tab"
            aria-selected={currentState === tabState}
            className={`oauth-state-tab ${currentState === tabState ? 'is-active' : ''}`}
            onClick={() => setOAuthCallbackState(tabState)}
          >
            {tabState.charAt(0).toUpperCase() + tabState.slice(1)}
          </button>
        ))}
      </div>

      {/* Main Landing Card */}
      <section className="app-card wizard-inline-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ProviderLogo provider={data.provider} />
            <span className={`oauth-status-badge ${currentDetails.badgeClass}`} role="status">
              {currentDetails.badgeText}
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'monospace' }}>
            {currentDetails.refId}
          </span>
        </div>

        <h3 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{currentDetails.title}</h3>
        <p className="wizard-supporting-copy" style={{ marginBottom: '1.25rem' }}>
          {currentDetails.subtitle}
        </p>

        {/* Telemetry-Safe Error / Status Details */}
        <div className="oauth-telemetry-box" role={currentDetails.isError ? 'alert' : 'status'}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong style={{ fontSize: '0.85rem', color: currentDetails.isError ? 'var(--danger)' : 'var(--success)' }}>
              Telemetry Record: {currentDetails.telemetryCode}
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Safe Logging Standard</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)' }}>
            {currentDetails.telemetryDetail}
          </p>
        </div>

        {/* Scope Summary (shown on Success state or partial context) */}
        {currentState === 'success' ? (
          <div className="oauth-scope-summary" style={{ marginTop: '1.25rem' }}>
            <h4>Scope Summary & Data Access Rights</h4>
            <ul className="wizard-list" style={{ margin: 0 }}>
              {requiredScopes.map((scope) => (
                <li key={scope}>{scope}</li>
              ))}
              {data.optionalScopes.map((optId) => (
                <li key={optId} style={{ color: 'var(--accent)' }}>
                  Optional scope: {optId}
                </li>
              ))}
            </ul>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)' }}>
              🔒 Least-Privilege Guarantee: Read-only permissions active. Veritasor cannot initiate payments, withdraw funds, or alter revenue source configurations.
            </p>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="oauth-action-bar">
          <button
            type="button"
            className="app-button app-button-primary"
            onClick={currentDetails.primaryCtaAction}
          >
            {currentDetails.primaryCtaLabel}
          </button>
          <button
            type="button"
            className="app-button app-button-secondary"
            onClick={currentDetails.secondaryCtaAction}
          >
            {currentDetails.secondaryCtaLabel}
          </button>
        </div>
      </section>
    </div>
  )
}

export function ConfigureSourceScopeStep() {
  const { data, setSyncWindow, toggleOptionalScope } = useWizardContext()
  const hasSyncWindowError = data.scopeValidationAttempted && data.syncWindow === null

  return (
    <div className="wizard-step-body">
      <section className="app-card wizard-inline-card">
        <h3>Define the sync window</h3>
        <p className="wizard-supporting-copy">
          This step demonstrates how validation errors surface inside the wizard body: the
          footer action stays available, but the missing field is called out inline with
          helper text and an alert summary.
        </p>

        {hasSyncWindowError ? (
          <div className="wizard-inline-alert" role="alert">
            Choose a sync window before continuing to the confirmation step.
          </div>
        ) : null}

        <fieldset className="wizard-fieldset">
          <legend className="wizard-legend">Initial sync window</legend>
          <div className="wizard-choice-grid wizard-choice-grid-compact">
            {syncWindows.map((windowOption) => {
              const isChecked = data.syncWindow === windowOption.id

              return (
                <label key={windowOption.id} className="wizard-choice-card">
                  <input
                    className="wizard-choice-input"
                    type="radio"
                    name="sync-window"
                    value={windowOption.id}
                    checked={isChecked}
                    aria-describedby={hasSyncWindowError ? 'sync-window-error' : undefined}
                    onChange={() => setSyncWindow(windowOption.id)}
                  />
                  <span className="wizard-choice-surface">
                    <span className="wizard-choice-title">{windowOption.label}</span>
                    <span className="wizard-choice-description">{windowOption.description}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {hasSyncWindowError ? (
            <p id="sync-window-error" className="wizard-field-error">
              Error: a sync window is required so reviewers understand the default data
              boundary before approving the connection.
            </p>
          ) : null}
        </fieldset>
      </section>

      <section className="app-card wizard-inline-card">
        <h3>Optional supporting scopes</h3>
        <p className="wizard-supporting-copy">
          Required read-only scopes stay fixed. Optional scopes are additive and never
          replace the least-privilege baseline.
        </p>
        <ul className="wizard-list wizard-list-muted">
          {requiredScopes.map((scope) => (
            <li key={scope}>{scope}</li>
          ))}
        </ul>
        <div className="wizard-checkbox-list">
          {optionalScopes.map((scope) => (
            <label key={scope.id} className="wizard-checkbox">
              <input
                type="checkbox"
                checked={data.optionalScopes.includes(scope.id)}
                onChange={() => toggleOptionalScope(scope.id)}
              />
              <span>
                <strong>{scope.label}</strong>
                <span className="wizard-checkbox-description">{scope.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}

export function ConfirmSourceStep() {
  const { data, providerName, setConfirmLeastPrivilege } = useWizardContext()
  const syncWindowLabel =
    syncWindows.find((windowOption) => windowOption.id === data.syncWindow)?.label ?? 'Not set'

  const unmappedCount = data.currencyMappings.filter(
    (r) => r.category === null || r.ledgerAccount === null,
  ).length

  return (
    <div className="wizard-step-body">
      <section className="app-card wizard-inline-card">
        <h3>Review the connection before finishing</h3>
        <dl className="wizard-summary-grid">
          <div>
            <dt>Provider</dt>
            <dd>{providerName}</dd>
          </div>
          <div>
            <dt>Authorization</dt>
            <dd>Read-only access approved</dd>
          </div>
          <div>
            <dt>Initial sync</dt>
            <dd>{syncWindowLabel}</dd>
          </div>
          <div>
            <dt>Optional scopes</dt>
            <dd>
              {data.optionalScopes.length > 0
                ? data.optionalScopes
                    .map(
                      (scopeId) =>
                        optionalScopes.find((scope) => scope.id === scopeId)?.label ?? scopeId,
                    )
                    .join(', ')
                : 'None added'}
            </dd>
          </div>
          <div>
            <dt>Currency mapping</dt>
            <dd>
              {unmappedCount === 0
                ? `${data.currencyMappings.length} currencies mapped`
                : `${unmappedCount} of ${data.currencyMappings.length} unmapped`}
            </dd>
          </div>
        </dl>
      </section>

      <label className="wizard-checkbox wizard-checkbox-confirm">
        <input
          type="checkbox"
          checked={data.confirmLeastPrivilege}
          onChange={(event) => setConfirmLeastPrivilege(event.target.checked)}
        />
        <span>
          <strong>Confirm least-privilege access</strong>
          <span className="wizard-checkbox-description">
            I understand this connection is limited to the selected read-only scopes and can be
            reviewed or revoked later.
          </span>
        </span>
      </label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MapCurrenciesStep — #223
// ---------------------------------------------------------------------------

export function MapCurrenciesStep() {
  const { data, setCurrencyMapping } = useWizardContext()
  const [search, setSearch] = useState('')
  const searchId = useId()
  const alertId = useId()

  const { currencyMappings, mappingValidationAttempted } = data

  const hasUnmapped = currencyMappings.some(
    (row) => row.category === null || row.ledgerAccount === null,
  )

  const filtered = currencyMappings.filter((row) =>
    row.currency.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="wizard-step-body">
      {/* Context callout */}
      <div className="wizard-callout">
        <h3>Why this step matters</h3>
        <p className="wizard-supporting-copy">
          Each currency the source reports must be mapped to an internal revenue category and a
          ledger account. Unmapped currencies will be excluded from attestation evidence until
          they are assigned. Defaults are pre-filled where Veritasor can infer a safe choice.
        </p>
      </div>

      {/* Validation alert — shown inline when user tries to advance with unmapped rows */}
      {mappingValidationAttempted && hasUnmapped && (
        <div id={alertId} className="wizard-inline-alert" role="alert">
          All currencies must have a category and ledger account assigned before continuing.
          Rows flagged below are missing one or both values.
        </div>
      )}

      <section className="app-card wizard-inline-card">
        <h3>Currency and ledger mapping</h3>

        {/* Search */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label htmlFor={searchId} className="sr-only">
            Search currencies
          </label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '0.875rem',
                color: 'var(--muted)',
                fontSize: '1rem',
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              id={searchId}
              type="search"
              placeholder="Search by currency code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search currencies"
              style={{
                width: '100%',
                minHeight: '2.75rem',
                padding: '0.6rem 0.875rem 0.6rem 2.5rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(15,23,42,0.82)',
                color: 'var(--text)',
                font: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Two-column mapping table */}
        <div
          role="table"
          aria-label="Currency mapping"
          aria-describedby={mappingValidationAttempted && hasUnmapped ? alertId : undefined}
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          {/* Header row */}
          <div
            role="row"
            aria-hidden="true"
            style={{
              display: 'grid',
              gridTemplateColumns: '5rem 1fr 1fr auto',
              gap: '0.75rem',
              padding: '0.4rem 0.875rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
              color: 'var(--muted)',
            }}
          >
            <span>Currency</span>
            <span>Category</span>
            <span>Ledger account</span>
            <span style={{ width: '1.25rem' }} />
          </div>

          {filtered.length === 0 ? (
            <p style={{ margin: '0.5rem 0', color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              No currencies match "{search}".
            </p>
          ) : (
            filtered.map((row) => {
              const isUnmapped =
                mappingValidationAttempted &&
                (row.category === null || row.ledgerAccount === null)
              const categorySelectId = `cat-${row.currency}`
              const ledgerSelectId = `ledger-${row.currency}`

              return (
                <div
                  key={row.currency}
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '5rem 1fr 1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.6rem 0.875rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isUnmapped
                      ? '1px solid rgba(251,113,133,0.45)'
                      : '1px solid var(--border)',
                    background: isUnmapped
                      ? 'rgba(251,113,133,0.06)'
                      : 'rgba(148,163,184,0.04)',
                  }}
                >
                  {/* Currency code */}
                  <span
                    role="cell"
                    style={{
                      fontWeight: 700,
                      fontFamily: '"SF Mono","Fira Code",monospace',
                      fontSize: '0.9rem',
                      color: 'var(--text)',
                    }}
                  >
                    {row.currency}
                  </span>

                  {/* Category select */}
                  <div role="cell">
                    <label htmlFor={categorySelectId} className="sr-only">
                      {row.currency} internal category
                    </label>
                    <select
                      id={categorySelectId}
                      value={row.category ?? ''}
                      onChange={(e) => setCurrencyMapping(row.currency, 'category', e.target.value)}
                      aria-invalid={isUnmapped && row.category === null}
                      style={{
                        width: '100%',
                        minHeight: '2.5rem',
                        padding: '0.4rem 2rem 0.4rem 0.75rem',
                        border: `1px solid ${isUnmapped && row.category === null ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(15,23,42,0.82)',
                        color: row.category === null ? 'rgba(173,192,217,0.55)' : 'var(--text)',
                        font: 'inherit',
                        fontSize: '0.88rem',
                        appearance: 'none',
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23adc0d9' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.625rem center',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">— Select category —</option>
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ledger account select */}
                  <div role="cell">
                    <label htmlFor={ledgerSelectId} className="sr-only">
                      {row.currency} ledger account
                    </label>
                    <select
                      id={ledgerSelectId}
                      value={row.ledgerAccount ?? ''}
                      onChange={(e) =>
                        setCurrencyMapping(row.currency, 'ledgerAccount', e.target.value)
                      }
                      aria-invalid={isUnmapped && row.ledgerAccount === null}
                      style={{
                        width: '100%',
                        minHeight: '2.5rem',
                        padding: '0.4rem 2rem 0.4rem 0.75rem',
                        border: `1px solid ${isUnmapped && row.ledgerAccount === null ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(15,23,42,0.82)',
                        color: row.ledgerAccount === null ? 'rgba(173,192,217,0.55)' : 'var(--text)',
                        font: 'inherit',
                        fontSize: '0.88rem',
                        appearance: 'none',
                        backgroundImage:
                          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23adc0d9' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0.625rem center',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">— Select ledger —</option>
                      {LEDGER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Unmapped flag indicator */}
                  <span
                    role="cell"
                    aria-label={isUnmapped ? `${row.currency} has unmapped fields` : undefined}
                    style={{
                      width: '1.25rem',
                      textAlign: 'center',
                      color: isUnmapped ? 'var(--danger)' : 'var(--success)',
                      fontSize: '0.85rem',
                    }}
                  >
                    {isUnmapped ? '✗' : row.category !== null && row.ledgerAccount !== null ? '✓' : ''}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Summary footer */}
        <p
          role="status"
          aria-live="polite"
          style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}
        >
          {currencyMappings.filter((r) => r.category !== null && r.ledgerAccount !== null).length}
          {' '}of {currencyMappings.length} currencies fully mapped
        </p>
      </section>
    </div>
  )
}
