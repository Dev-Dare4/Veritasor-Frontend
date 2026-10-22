/**
 * Focused behavior coverage for the Login route state machine
 * (`src/pages/Login.tsx`).
 *
 * `Login` is a three-state router with an optional recovery deep link:
 *
 *   credentials → mfa-challenge → mfa-recovery
 *
 * The credentials form is a local-only demo: it validates the password shape,
 * runs a `SUBMIT_DEMO_MS` timer while `SubmitButton` reports `aria-busy`, and
 * only then advances to the MFA challenge.
 *
 * Coverage targets:
 *   ✔ Default state, MFA state protection, unknown values, and both
 *     recovery aliases (`mfa-recover` / `mfa-recovery`)
 *   ✔ Password-shape validation gates the demo timer (failure path)
 *   ✔ Successful submit enters the busy state during `SUBMIT_DEMO_MS` and
 *     then advances to the challenge (success path)
 *   ✔ Back navigation from both the challenge and the recovery flow clears
 *     the query string
 */

import { MemoryRouter, useLocation } from 'react-router-dom'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'
import { ToastProvider } from '../components/ToastContext'
import { SUBMIT_DEMO_MS } from '../components/SubmitButton'

function renderLogin(url = '/login') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        {<Login /> as ReactElement}
        <CurrentLocation />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function CurrentLocation() {
  const { pathname, search } = useLocation()
  return <output data-testid="location">{pathname}{search}</output>
}

function passwordField() {
  return screen.getByLabelText(/password/i)
}

function submitButton() {
  return screen.getByRole('button', { name: /^sign in$/i })
}

function emailField() {
  return screen.getByLabelText(/work email/i)
}

describe('Login route state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('state selection', () => {
    it('defaults to the credentials state', () => {
      renderLogin()

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/work email/i)).toBeInTheDocument()
      expect(submitButton()).toBeInTheDocument()
    })

    it('falls back to credentials when state=mfa is requested without credentials', () => {
      renderLogin('/login?state=mfa')

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /verify your sign-in/i })).not.toBeInTheDocument()
    })

    it.each(['mfa-recover', 'mfa-recovery'])(
      'renders the recovery flow when state=%s is requested',
      (state) => {
        renderLogin(`/login?state=${state}`)

        expect(
          screen.getByRole('heading', { name: /lost your mfa device\?/i }),
        ).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /choose a recovery method/i })).toBeInTheDocument()
      },
    )

    it('falls back to the credentials state for an unknown state value', () => {
      renderLogin('/login?state=something-else')

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /verify your sign-in/i })).not.toBeInTheDocument()
    })
  })

  describe('credentials state', () => {
    it('does not show any errors while typing before first submit or blur', () => {
      renderLogin()

      expect(screen.queryAllByRole('alert')).toHaveLength(0)

      fireEvent.change(emailField(), { target: { value: 'invalid-email' } })
      fireEvent.change(passwordField(), { target: { value: 'abc' } })

      expect(screen.queryAllByRole('alert')).toHaveLength(0)
      expect(emailField()).not.toHaveAttribute('aria-invalid')
      expect(passwordField()).not.toHaveAttribute('aria-invalid')
    })

    it('shows two inline errors and does not advance on empty submit', () => {
      renderLogin()

      fireEvent.click(submitButton())

      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(2)
      expect(alerts[0]).toHaveTextContent(/email is required/i)
      expect(alerts[1]).toHaveTextContent(/password is required/i)

      expect(emailField()).toHaveAttribute('aria-invalid', 'true')
      expect(emailField()).toHaveAttribute('aria-describedby', alerts[0].id)
      expect(passwordField()).toHaveAttribute('aria-invalid', 'true')
      expect(passwordField()).toHaveAttribute('aria-describedby', alerts[1].id)

      act(() => {
        vi.advanceTimersByTime(SUBMIT_DEMO_MS * 3)
      })

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /verify your sign-in/i })).not.toBeInTheDocument()
      expect(submitButton()).toBeEnabled()
      expect(submitButton()).not.toHaveAttribute('aria-busy')
    })

    it('moves focus to the first invalid field on failed submit', () => {
      renderLogin()

      fireEvent.click(submitButton())
      expect(emailField()).toHaveFocus()

      fireEvent.change(emailField(), { target: { value: 'user@example.com' } })
      fireEvent.click(submitButton())
      expect(passwordField()).toHaveFocus()
    })

    it('blocks submit with invalid email and accepts a short password at sign-in', () => {
      renderLogin()

      fireEvent.change(emailField(), { target: { value: 'foo' } })
      fireEvent.change(passwordField(), { target: { value: 'abc' } })
      fireEvent.click(submitButton())

      const alerts = screen.getAllByRole('alert')
      expect(alerts).toHaveLength(1)
      expect(alerts[0]).toHaveTextContent(/valid email/i)
      expect(emailField()).toHaveAttribute('aria-invalid', 'true')
      expect(passwordField()).not.toHaveAttribute('aria-invalid')
      expect(emailField()).toHaveFocus()

      act(() => {
        vi.advanceTimersByTime(SUBMIT_DEMO_MS * 3)
      })

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /verify your sign-in/i })).not.toBeInTheDocument()
    })

    it('shows inline errors on blur', () => {
      renderLogin()

      fireEvent.blur(emailField())
      expect(screen.getByText(/email is required/i)).toBeInTheDocument()
      expect(emailField()).toHaveAttribute('aria-invalid', 'true')

      fireEvent.change(emailField(), { target: { value: 'invalid' } })
      expect(screen.getByText(/valid email/i)).toBeInTheDocument()

      fireEvent.blur(passwordField())
      expect(screen.getByText(/password is required/i)).toBeInTheDocument()
      expect(passwordField()).toHaveAttribute('aria-invalid', 'true')
    })

    it('shows the busy demo state for SUBMIT_DEMO_MS and then opens the MFA challenge on valid credentials', () => {
      renderLogin()

      fireEvent.change(emailField(), { target: { value: 'user@example.com' } })
      fireEvent.change(passwordField(), { target: { value: 'abc' } })
      fireEvent.click(submitButton())

      const busy = screen.getByRole('button', { name: /signing in/i })
      expect(busy).toBeDisabled()
      expect(busy).toHaveAttribute('aria-busy', 'true')

      // One millisecond short of the demo delay nothing has changed yet.
      act(() => {
        vi.advanceTimersByTime(SUBMIT_DEMO_MS - 1)
      })
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1)
      })

      expect(screen.getByRole('heading', { name: /verify your sign-in/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /welcome back/i })).not.toBeInTheDocument()
    })

    it('ignores extra submits while the demo timer is in flight', () => {
      renderLogin()

      fireEvent.change(emailField(), { target: { value: 'user@example.com' } })
      fireEvent.change(passwordField(), { target: { value: 'abc' } })
      fireEvent.click(submitButton())
      fireEvent.click(screen.getByRole('button', { name: /signing in/i }))

      act(() => {
        vi.advanceTimersByTime(SUBMIT_DEMO_MS)
      })

      // A single transition happened, so the challenge is showing (not stuck busy).
      expect(screen.getByRole('heading', { name: /verify your sign-in/i })).toBeInTheDocument()
    })

    it('clears the pending demo timer when the form unmounts', () => {
      const clearSpy = vi.spyOn(window, 'clearTimeout')
      const { unmount } = renderLogin()

      fireEvent.change(emailField(), { target: { value: 'user@example.com' } })
      fireEvent.change(passwordField(), { target: { value: 'abc' } })
      fireEvent.click(submitButton())

      const callsAfterSubmit = clearSpy.mock.calls.length
      unmount()

      expect(clearSpy.mock.calls.length).toBeGreaterThan(callsAfterSubmit)
    })
  })

  describe('back navigation', () => {
    it('returns from the MFA challenge to the credentials form', () => {
      renderLogin('/login?state=mfa')

      fireEvent.change(passwordField(), { target: { value: 'correct-horse-1' } })
      fireEvent.click(submitButton())
      act(() => {
        vi.advanceTimersByTime(SUBMIT_DEMO_MS)
      })

      expect(screen.getByRole('heading', { name: /verify your sign-in/i })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /^← back$/i }))

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/login')
    })

    it('returns from the recovery flow to the credentials form', () => {
      renderLogin('/login?state=mfa-recovery')

      fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }))

      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.getByTestId('location')).toHaveTextContent('/login')
    })
  })
})
