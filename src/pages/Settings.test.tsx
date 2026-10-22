/**
 * Settings page tests
 *
 * Covers the tabbed navigation pattern for issue #172:
 * - WAI-ARIA tablist / tab / tabpanel roles
 * - Arrow-key navigation (Left / Right / Home / End)
 * - Deep-link URL-hash routing
 * - Responsive select collapse
 *
 * Issue #251: Security tab session management.
 */

import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LocaleProvider } from '../i18n/provider'
import Settings from '../pages/Settings'

function renderSettings(hash = '') {
  const router = createMemoryRouter([
    {
      path: '/settings',
      element: (
        <>
          <Link to="/dashboard">Dashboard navigation</Link>
          <Settings />
        </>
      ),
    },
    { path: '/dashboard', element: <h1>Dashboard route</h1> },
  ], {
    initialEntries: [`/settings${hash}`],
  })
  return render(
    <LocaleProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </LocaleProvider>,
  )
}

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe('Settings — rendering', () => {
  it('renders the page heading', () => {
    renderSettings()
    expect(screen.getByRole('heading', { level: 1, name: /settings/i })).toBeInTheDocument()
  })

  it('renders a tablist with aria-label', () => {
    renderSettings()
    expect(screen.getByRole('tablist', { name: /settings tabs/i })).toBeInTheDocument()
  })

  it('renders all 8 tabs', () => {
    renderSettings()
    expect(screen.getAllByRole('tab')).toHaveLength(8)
  })

  it('renders all 8 tab panels (including hidden)', () => {
    renderSettings()
    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(8)
  })

  it('renders a select for mobile collapse', () => {
    renderSettings()
    expect(screen.getByRole('combobox', { name: /settings section/i })).toBeInTheDocument()
  })

  it('renders tab labels: Profile, Notifications, Integrations, API Keys, Tokens, Billing, Security, Audit Log', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /notifications/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /api keys/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /tokens/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /billing/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /security/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /audit log/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /webhooks/i })).toBeInTheDocument()
  })
})

// ─── Default active tab ───────────────────────────────────────────────────────

describe('Settings — default tab', () => {
  it('activates the Profile tab by default', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('Profile panel is visible by default (not hidden)', () => {
    renderSettings()
    expect(document.getElementById('panel-profile')).not.toHaveAttribute('hidden')
  })

  it('Profile tab has tabIndex 0; others have -1', () => {
    renderSettings()
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: /notifications/i })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: /billing/i })).toHaveAttribute('tabindex', '-1')
  })
})

// ─── Deep links ───────────────────────────────────────────────────────────────

describe('Settings — deep links (URL hash)', () => {
  it('activates Notifications tab when hash is #notifications', () => {
    renderSettings('#notifications')
    expect(screen.getByRole('tab', { name: /notifications/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('activates Integrations tab when hash is #integrations', () => {
    renderSettings('#integrations')
    expect(screen.getByRole('tab', { name: /integrations/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('activates API Keys tab when hash is #api-keys', () => {
    renderSettings('#api-keys')
    expect(screen.getByRole('tab', { name: /api keys/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('activates Tokens tab when hash is #tokens', () => {
    renderSettings('#tokens')
    expect(screen.getByRole('tab', { name: /tokens/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('activates Billing tab when hash is #billing', () => {
    renderSettings('#billing')
    expect(screen.getByRole('tab', { name: /billing/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('activates Security tab when hash is #security', () => {
    renderSettings('#security')
    expect(screen.getByRole('tab', { name: /security/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to Profile for an unknown hash', () => {
    renderSettings('#unknown')
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
  })
})

// ─── Tab click navigation ─────────────────────────────────────────────────────

describe('Settings — click navigation', () => {
  it('clicking Notifications activates it and shows its panel', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: /notifications/i }))
    expect(screen.getByRole('tab', { name: /notifications/i })).toHaveAttribute('aria-selected', 'true')
    expect(document.getElementById('panel-notifications')).not.toHaveAttribute('hidden')
  })

  describe('Settings — unsaved changes navigation guard', () => {
    it('keeps the active tab and edits when cancelling a tab switch', () => {
      renderSettings()
      const nameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(nameInput, { target: { value: 'Updated name' } })
      fireEvent.click(screen.getByRole('tab', { name: /notifications/i }))

      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /^stay$/i }))

      expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
      expect(nameInput).toHaveValue('Updated name')
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })

    it('discards edits and navigates when leaving through a route link', async () => {
      renderSettings()
      fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Discard this name' } })
      fireEvent.click(screen.getByRole('link', { name: /dashboard navigation/i }))

      expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /discard & leave/i }))

      expect(await screen.findByRole('heading', { name: /dashboard route/i })).toBeInTheDocument()
    })

    it('saves all edits and switches tabs when confirmed', async () => {
      renderSettings()
      const nameInput = screen.getByLabelText(/display name/i)
      fireEvent.change(nameInput, { target: { value: 'Saved name' } })
      fireEvent.click(screen.getByRole('tab', { name: /notifications/i }))
      fireEvent.click(screen.getByRole('button', { name: /save & leave/i }))

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /notifications/i })).toHaveAttribute('aria-selected', 'true')
      })
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    })
  })

  it('clicking a new tab deactivates the previous one', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: /billing/i }))
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'false')
  })

  it('clicking Billing shows the Billing panel content', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: /billing/i }))
    expect(screen.getByRole('heading', { name: /billing/i })).toBeInTheDocument()
  })

  it('clicking Security shows the Security panel content', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: /security/i }))
    expect(screen.getByRole('heading', { name: /security/i })).toBeInTheDocument()
  })

  it('clicking API Keys shows the API Keys panel content', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: /api keys/i }))
    expect(screen.getByRole('heading', { name: /api keys/i })).toBeInTheDocument()
  })

  it('clicking Tokens shows the Tokens panel content', () => {
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: /tokens/i }))
    expect(screen.getByRole('heading', { name: /design tokens/i })).toBeInTheDocument()
  })
})

// ─── ARIA attributes ──────────────────────────────────────────────────────────

describe('Settings — ARIA attributes', () => {
  it('each tab has aria-controls pointing to its panel id', () => {
    renderSettings()
    const profileTab = screen.getByRole('tab', { name: /profile/i })
    expect(profileTab).toHaveAttribute('aria-controls', 'panel-profile')
    expect(document.getElementById('panel-profile')).toBeInTheDocument()
  })

  it('each tabpanel has aria-labelledby pointing to its tab id', () => {
    renderSettings()
    const profilePanel = document.getElementById('panel-profile')
    expect(profilePanel).toHaveAttribute('aria-labelledby', 'tab-profile')
    expect(document.getElementById('tab-profile')).toBeInTheDocument()
  })

  it('inactive panels have hidden attribute', () => {
    renderSettings()
    expect(document.getElementById('panel-notifications')).toHaveAttribute('hidden')
    expect(document.getElementById('panel-billing')).toHaveAttribute('hidden')
    expect(document.getElementById('panel-security')).toHaveAttribute('hidden')
  })

  it('active panel does not have hidden attribute', () => {
    renderSettings()
    expect(document.getElementById('panel-profile')).not.toHaveAttribute('hidden')
  })

  it('tabpanels have tabIndex 0', () => {
    renderSettings()
    const panels = screen.getAllByRole('tabpanel', { hidden: true })
    panels.forEach((panel) => expect(panel).toHaveAttribute('tabindex', '0'))
  })
})

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe('Settings — keyboard navigation', () => {
  it('ArrowRight moves focus from Profile to Notifications', () => {
    renderSettings()
    const profileTab = screen.getByRole('tab', { name: /profile/i })
    fireEvent.keyDown(profileTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: /notifications/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowLeft moves focus from Notifications to Profile', () => {
    renderSettings('#notifications')
    const notifTab = screen.getByRole('tab', { name: /notifications/i })
    fireEvent.keyDown(notifTab, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowRight wraps from last tab to first', () => {
    renderSettings('#audit-log')
    const auditLogTab = screen.getByRole('tab', { name: /audit log/i })
    fireEvent.keyDown(auditLogTab, { key: 'ArrowRight' })
    const auditTab = screen.getByRole('tab', { name: /audit log/i })
    fireEvent.keyDown(auditTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('ArrowLeft wraps from first tab to last', () => {
    renderSettings()
    const profileTab = screen.getByRole('tab', { name: /profile/i })
    fireEvent.keyDown(profileTab, { key: 'ArrowLeft' })
    expect(screen.getByRole('tab', { name: /audit log/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('Home key navigates to the first tab', () => {
    renderSettings('#audit-log')
    const auditLogTab = screen.getByRole('tab', { name: /audit log/i })
    fireEvent.keyDown(auditLogTab, { key: 'Home' })
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('End key navigates to the last tab', () => {
    renderSettings()
    const profileTab = screen.getByRole('tab', { name: /profile/i })
    fireEvent.keyDown(profileTab, { key: 'End' })
    expect(screen.getByRole('tab', { name: /audit log/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('unrelated key does not change the active tab', () => {
    renderSettings()
    const profileTab = screen.getByRole('tab', { name: /profile/i })
    fireEvent.keyDown(profileTab, { key: 'Tab' })
    expect(screen.getByRole('tab', { name: /profile/i })).toHaveAttribute('aria-selected', 'true')
  })
})

// ─── Mobile select ────────────────────────────────────────────────────────────

describe('Settings — mobile select', () => {
  it('changing the select switches the active tab', () => {
    renderSettings()
    const select = screen.getByRole('combobox', { name: /settings section/i })
    fireEvent.change(select, { target: { value: 'billing' } })
    expect(screen.getByRole('tab', { name: /billing/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('select has the correct initial value', () => {
    renderSettings()
    const select = screen.getByRole('combobox', { name: /settings section/i }) as HTMLSelectElement
    expect(select.value).toBe('profile')
  })

  it('select options include all 8 tabs', () => {
    renderSettings()
    const select = screen.getByRole('combobox', { name: /settings section/i })
    const options = Array.from((select as HTMLSelectElement).options)
    expect(options).toHaveLength(8)
  })
})

// ─── Panel content spot checks ────────────────────────────────────────────────

describe('Settings — panel content', () => {
  it('Profile panel contains a display-name input', () => {
    renderSettings()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
  })

  it('Profile panel contains an email input', () => {
    renderSettings()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('Notifications panel lists notification items', () => {
    renderSettings('#notifications')
    expect(screen.getByLabelText(/attestation completed/i)).toBeInTheDocument()
  })

  it('API Keys panel shows a code element', () => {
    renderSettings('#api-keys')
    expect(document.querySelector('code')).toBeInTheDocument()
  })

  it('Billing panel shows a description list', () => {
    renderSettings('#billing')
    expect(document.querySelector('dl')).toBeInTheDocument()
  })

  it('Security panel contains a current-password input', () => {
    renderSettings('#security')
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
  })

  it('Security panel shows active sessions heading', () => {
    renderSettings('#security')
    expect(screen.getByRole('heading', { name: /active sessions/i })).toBeInTheDocument()
  })

  it('Security panel shows session count', () => {
    renderSettings('#security')
    expect(screen.getByText(/4 active sessions/i)).toBeInTheDocument()
  })

  it('Security panel shows current session badge', () => {
    renderSettings('#security')
    const badges = screen.getAllByText('Current')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('Security panel shows revoke buttons for non-current sessions', () => {
    renderSettings('#security')
    const revokeButtons = screen.getAllByText('Revoke')
    expect(revokeButtons.length).toBeGreaterThanOrEqual(3)
  })

  it('Security panel shows sign-out-everywhere button', () => {
    renderSettings('#security')
    expect(screen.getByText(/sign out of all other sessions/i)).toBeInTheDocument()
  })

  it('Audit Log panel contains a log role element', () => {
    renderSettings('#audit-log')
    expect(screen.getByRole('log', { name: /audit log timeline/i })).toBeInTheDocument()
  })

  it('Audit Log panel shows audit entries', () => {
    renderSettings('#audit-log')
    const entries = screen.getAllByText('Attestation completed')
    expect(entries.length).toBeGreaterThan(0)
  })
})

// ─── MFA Recovery Codes ────────────────────────────────────────────────────────

describe('Security — MFA recovery codes', () => {
  const CODE_RE = /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/

  it('shows MFA setup button when MFA is not enabled', () => {
    renderSettings('#security')
    expect(screen.getByRole('button', { name: /set up two-factor authentication/i })).toBeInTheDocument()
  })

  it('clicking setup transitions to recovery codes view', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    expect(screen.getByRole('heading', { name: /recovery codes/i })).toBeInTheDocument()
  })

  it('displays 10 recovery codes after setup', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(10)
  })

  it('each recovery code matches XXXX-XXXX-XXXX pattern', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    const items = screen.getAllByRole('listitem')
    items.forEach((item) => {
      expect(item.textContent).toMatch(CODE_RE)
    })
  })

  it('codes are displayed in a list with aria-label', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    expect(screen.getByRole('list', { name: /recovery codes/i })).toBeInTheDocument()
  })

  it('copy all button is present', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    expect(screen.getByRole('button', { name: /copy all/i })).toBeInTheDocument()
  })

  it('download .txt button is present', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    expect(screen.getByRole('button', { name: /download \.txt/i })).toBeInTheDocument()
  })

  it('print button is present', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })

  it('confirmation checkbox is present and unchecked by default', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    const checkbox = screen.getByRole('checkbox', { name: /i.ve saved/i })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('continue button is disabled until codes are confirmed', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    const continueBtn = screen.getByRole('button', { name: /continue/i })
    expect(continueBtn).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /i.ve saved/i }))
    expect(continueBtn).toBeEnabled()
  })

  it('confirming codes transitions to MFA active state', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /i.ve saved/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/two-factor authentication is enabled/i)).toBeInTheDocument()
  })

  it('shows enabled status after completing setup', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /i.ve saved/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByRole('button', { name: /disable/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /view recovery codes/i })).toBeInTheDocument()
  })

  it('view recovery codes from active state shows codes again', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /i.ve saved/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /view recovery codes/i }))
    expect(screen.getByRole('list', { name: /recovery codes/i })).toBeInTheDocument()
  })

  it('disable button returns to initial off state', () => {
    renderSettings('#security')
    fireEvent.click(screen.getByRole('button', { name: /set up two-factor authentication/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /i.ve saved/i }))
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /disable/i }))
    expect(screen.getByRole('button', { name: /set up two-factor authentication/i })).toBeInTheDocument()
  })
})
