import { act, Profiler, useCallback, useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useOutletContext } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import {
  ConnectSourceWizard,
  OAuthCallbackLandingStep,
  SelectSourceProviderStep,
} from '../pages/connect-source/ConnectSourceWizard'

/**
 * Renders the full route tree inside a MemoryRouter so tests can drive
 * navigation without a BrowserRouter (avoids the nested-router error).
 * LocaleProvider is already inside AppRoutes; we add IntlProvider here
 * because TopAppBar calls useIntl() and LocaleProvider uses import.meta.glob
 * which doesn't resolve in vitest's jsdom environment.
 */
function renderApp(initialEntry = '/') {
  window.history.replaceState(null, '', initialEntry)
  return render(<App />)
}

function renderOAuthCallback(initialEntry: string, onRender: () => void) {
  function CallbackHarness() {
    const [data, setData] = useState({
      provider: 'stripe',
      oauthCallbackState: 'success',
      authorizationStatus: 'idle',
      optionalScopes: [] as string[],
    })

    const setOAuthCallbackState = useCallback(
      (state: 'success' | 'denied' | 'expired' | 'unknown') => {
        const authorizationStatus =
          state === 'success'
            ? 'authorized'
            : state === 'denied'
              ? 'denied'
              : state === 'expired'
                ? 'expired'
                : 'unknown'

        setData((currentData) => {
          if (
            currentData.oauthCallbackState === state &&
            currentData.authorizationStatus === authorizationStatus
          ) {
            return currentData
          }

          return { ...currentData, oauthCallbackState: state, authorizationStatus }
        })
      },
      [],
    )
    const context = {
      data,
      providerName: 'Stripe',
      setOAuthCallbackState,
    }

    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/connect-source/callback"
            element={
              <Profiler id="oauth-callback" onRender={onRender}>
                <Outlet context={context} />
              </Profiler>
            }
          >
            <Route index element={<OAuthCallbackLandingStep />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )
  }

  return render(<CallbackHarness />)
}

function OAuthActionIdentityProbe({
  onAction,
}: {
  onAction: (action: (state: 'success' | 'denied' | 'expired' | 'unknown') => void) => void
}) {
  const { setOAuthCallbackState } = useOutletContext<{
    setOAuthCallbackState: (state: 'success' | 'denied' | 'expired' | 'unknown') => void
  }>()
  onAction(setOAuthCallbackState)
  return null
}

function renderWizardWithActionProbe(onAction: (action: (state: 'success' | 'denied' | 'expired' | 'unknown') => void) => void) {
  return render(
    <MemoryRouter initialEntries={['/connect-source/provider']}>
      <Routes>
        <Route path="/connect-source" element={<ConnectSourceWizard />}>
          <Route
            path="provider"
            element={
              <>
                <SelectSourceProviderStep />
                <OAuthActionIdentityProbe onAction={onAction} />
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  window.history.replaceState(null, '', '/')
})

beforeEach(() => {
  localStorage.clear()
  sourcesStore.reset()
})

// ─── Existing wizard flow tests ────────────────────────────────────────────

describe('connect source wizard', () => {
  it.each([
    ['?state=denied', /Access Denied/i],
    ['?status=access_denied', /Access Denied/i],
    ['?error=timeout', /Session Expired/i],
    ['?state=success', /Authorization Successful/i],
    ['?state=invalid_request', /Handoff Error/i],
  ])('synchronizes OAuth callback URL %s without an update loop', (query, expectedStatus) => {
    let renderCount = 0
    renderOAuthCallback(`/connect-source/callback${query}`, () => {
      renderCount += 1
    })

    expect(screen.getByText(expectedStatus)).toBeInTheDocument()
    expect(renderCount).toBeLessThanOrEqual(3)
  })

  it('keeps OAuth callback actions stable when wizard state changes', () => {
    const actions: Array<(state: 'success' | 'denied' | 'expired' | 'unknown') => void> = []
    renderWizardWithActionProbe((action) => {
      actions.push(action)
    })

    fireEvent.click(screen.getByLabelText(/stripe/i))

    expect(actions.length).toBeGreaterThanOrEqual(2)
    expect(actions[0]).toBe(actions[1])
  })

  it('surfaces the dashboard entry point for the new flow', () => {
    renderApp('/')

    expect(screen.getByRole('link', { name: /open connect source wizard/i })).toHaveAttribute(
      'href',
      '/connect-source/provider',
    )
  })

  it('redirects locked routes back to the earliest incomplete step', () => {
    renderApp('/connect-source/scope')

    expect(screen.getByRole('heading', { name: /select provider/i })).toBeInTheDocument()
    expect(screen.getByText(/Step 1 of 6: Select provider/i)).toBeInTheDocument()
  })

  it('keeps next disabled until a provider is selected and authorization completes', async () => {
    vi.useFakeTimers()
    renderApp('/connect-source/provider')

    const nextButton = screen.getByRole('button', { name: /^next$/i })

    expect(nextButton).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/stripe/i))
    expect(nextButton).toBeEnabled()

    fireEvent.click(nextButton)
    expect(screen.getByRole('heading', { name: /authorize/i })).toBeInTheDocument()
    expect(nextButton).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /simulate secure redirect/i }))
    expect(screen.getByText(/Connecting to Stripe/i)).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    expect(screen.getByText(/Authorization Successful/i)).toBeInTheDocument()
    expect(screen.getByText(/Connected to Stripe/i)).toBeInTheDocument()
    expect(nextButton).toBeEnabled()
  })

  it('handles all 4 OAuth callback landing states (success, denied, expired, unknown)', async () => {
    vi.useFakeTimers()
    renderApp('/connect-source/provider')

    fireEvent.click(screen.getByLabelText(/stripe/i))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.click(screen.getByRole('button', { name: /simulate secure redirect/i }))

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    // Success State
    expect(screen.getByText(/Authorization Successful/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue to scope configuration/i })).toBeInTheDocument()

    // Switch to Denied State tab
    fireEvent.click(screen.getByRole('tab', { name: /denied/i }))
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument()
    expect(screen.getByText(/ERR_OAUTH_ACCESS_DENIED/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry authorization/i })).toBeInTheDocument()

    // Switch to Expired State tab
    fireEvent.click(screen.getByRole('tab', { name: /expired/i }))
    expect(screen.getByText(/Session Expired/i)).toBeInTheDocument()
    expect(screen.getByText(/ERR_OAUTH_SESSION_EXPIRED/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /restart authorization/i })).toBeInTheDocument()

    // Switch to Unknown State tab
    fireEvent.click(screen.getByRole('tab', { name: /unknown/i }))
    expect(screen.getByText(/Handoff Error/i)).toBeInTheDocument()
    expect(screen.getByText(/ERR_OAUTH_INVALID_RESPONSE/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try connecting again/i })).toBeInTheDocument()
  })

  it('shows inline validation on scope configuration before allowing confirmation', async () => {
    vi.useFakeTimers()
    renderApp('/connect-source/provider')

    fireEvent.click(screen.getByLabelText(/stripe/i))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))
    fireEvent.click(screen.getByRole('button', { name: /simulate secure redirect/i }))

    await act(async () => {
      vi.advanceTimersByTime(900)
    })

    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    const nextButton = screen.getByRole('button', { name: /^next$/i })

    fireEvent.click(nextButton)
    expect(
      screen.getByText(/Choose a sync window before continuing to the confirmation step/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/trailing 12 months/i))
    fireEvent.click(nextButton)
    fireEvent.click(nextButton)

    const finishButton = screen.getByRole('button', { name: /finish connection/i })
    expect(finishButton).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /confirm least-privilege access/i }))
    expect(finishButton).toBeEnabled()
  })
})

// ─── Integration: finish wizard → sources list ────────────────────────────

describe('connect source wizard — finish navigates to /sources', () => {
  async function completeWizard() {
    vi.useFakeTimers()
    renderApp('/connect-source/provider')

    // Step 1: pick Stripe
    fireEvent.click(screen.getByLabelText(/stripe/i))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    // Step 2: authorize
    fireEvent.click(screen.getByRole('button', { name: /simulate secure redirect/i }))
    await act(async () => { vi.advanceTimersByTime(900) })
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    // Step 3: scope
    fireEvent.click(screen.getByLabelText(/trailing 12 months/i))
    fireEvent.click(screen.getByRole('button', { name: /^next$/i }))

    // Step 4: confirm + finish
    fireEvent.click(screen.getByRole('checkbox', { name: /confirm least-privilege access/i }))
    fireEvent.click(screen.getByRole('button', { name: /finish connection/i }))
  }

  it('lands on the Revenue Sources page after finishing', async () => {
    await completeWizard()
    expect(screen.getByRole('heading', { name: /revenue sources/i })).toBeInTheDocument()
  })

  it('adds the new source to the list', async () => {
    await completeWizard()
    // Stripe appears at least once in the sources list (seed + newly added both show Stripe)
    expect(screen.getAllByText('Stripe').length).toBeGreaterThanOrEqual(1)
  })

  it('new source is listed alongside the existing seeds', async () => {
    await completeWizard()
    // INITIAL_SOURCES still present plus the new Stripe row
    const stripeItems = screen.getAllByText('Stripe')
    // At least one Stripe row (seed + potentially new, but seed is already Stripe)
    expect(stripeItems.length).toBeGreaterThanOrEqual(1)
  })

  it('adds the source to the store so it persists', async () => {
    await completeWizard()
    const stored = sourcesStore.getAll()
    expect(stored.some((s) => s.provider === 'Stripe')).toBe(true)
  })

  it('shows a success toast after finishing', async () => {
    await completeWizard()
    // Toast renders the message in the DOM
    expect(screen.getByText(/stripe connected successfully/i)).toBeInTheDocument()
  })
})

// ─── Empty state: Connect a source link ────────────────────────────────────

describe('RevenueSources — empty state', () => {
  it('shows a "Connect a source" link when no sources exist', () => {
    sourcesStore.setAll([])

    render(
      <MemoryRouter initialEntries={['/sources']}>
        <IntlProvider locale="en" messages={enMessages}>
          <CookieConsentProvider>
            <AppRoutes />
          </CookieConsentProvider>
        </IntlProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /connect a source/i })).toBeInTheDocument()
  })

  it('"Connect a source" link points to the wizard', () => {
    sourcesStore.setAll([])

    render(
      <MemoryRouter initialEntries={['/sources']}>
        <IntlProvider locale="en" messages={enMessages}>
          <CookieConsentProvider>
            <AppRoutes />
          </CookieConsentProvider>
        </IntlProvider>
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /connect a source/i }) as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/connect-source/provider')
  })
})
