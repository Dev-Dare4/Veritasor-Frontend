import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import ForgotPassword from './ForgotPassword'
import { ToastProvider } from '../components/ToastContext'

function renderPage(initialEntries = ['/forgot-password']) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  )
}

describe('ForgotPassword Page', () => {
  describe('Request Link State', () => {
    it('renders initial request link form', () => {
      renderPage()
      expect(screen.getByRole('heading', { name: /Reset your password/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/Verified email/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Send reset link/i })).toBeInTheDocument()
    })

    it('transitions to RequestedState when valid email is submitted', async () => {
      const user = userEvent.setup()
      renderPage()
      const emailInput = screen.getByLabelText(/Verified email/i)
      const submitButton = screen.getByRole('button', { name: /Send reset link/i })

      await user.type(emailInput, 'test@veritasor.com')
      await user.click(submitButton)

      expect(screen.getByRole('heading', { name: /Check your email/i })).toBeInTheDocument()
      expect(screen.getByText(/test@veritasor.com/i)).toBeInTheDocument()
    })

    it('prevents submission with invalid email', async () => {
      const user = userEvent.setup()
      renderPage()
      const emailInput = screen.getByLabelText(/Verified email/i)
      const submitButton = screen.getByRole('button', { name: /Send reset link/i })

      await user.type(emailInput, 'invalid-email')
      await user.click(submitButton)

      // Should still be on the request page
      expect(screen.getByRole('heading', { name: /Reset your password/i })).toBeInTheDocument()
    })
  })

  describe('Requested State', () => {
    it('allows trying a different email', async () => {
      const user = userEvent.setup()
      renderPage()
      
      // Go to requested state
      await user.type(screen.getByLabelText(/Verified email/i), 'test@veritasor.com')
      await user.click(screen.getByRole('button', { name: /Send reset link/i }))
      
      expect(screen.getByRole('heading', { name: /Check your email/i })).toBeInTheDocument()
      
      const tryDifferentEmailBtn = screen.getByRole('button', { name: /Try a different email/i })
      await user.click(tryDifferentEmailBtn)

      // Should go back to request state
      expect(screen.getByRole('heading', { name: /Reset your password/i })).toBeInTheDocument()
    })
  })

  describe('Expired Link State', () => {
    it('renders expired state when url has state=expired', () => {
      renderPage(['/forgot-password?state=expired'])
      expect(screen.getByRole('heading', { name: /Link expired/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Send a new link/i })).toBeInTheDocument()
    })

    it('navigates to request form on "Send a new link"', async () => {
      const user = userEvent.setup()
      renderPage(['/forgot-password?state=expired'])
      
      const sendNewBtn = screen.getByRole('button', { name: /Send a new link/i })
      await user.click(sendNewBtn)

      // Note: Because it navigates to /forgot-password, but doesn't change query parameters in MemoryRouter unless we listen to location,
      // it should re-render without state=expired since `useNavigate` goes to `/forgot-password`.
      expect(screen.getByRole('heading', { name: /Reset your password/i })).toBeInTheDocument()
    })
  })

  describe('New Password State', () => {
    it('renders incomplete link error if token is missing', () => {
      renderPage(['/forgot-password?state=reset'])
      expect(screen.getByRole('heading', { name: /Incomplete link/i })).toBeInTheDocument()
      expect(screen.getByText(/missing required information/i)).toBeInTheDocument()
    })

    it('renders new password form if token is provided', () => {
      renderPage(['/forgot-password?state=reset&token=valid-token'])
      expect(screen.getByRole('heading', { name: /Set new password/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/New password/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Confirm password/i)).toBeInTheDocument()
    })

    it('shows error if passwords do not match on submit', async () => {
      const user = userEvent.setup()
      renderPage(['/forgot-password?state=reset&token=valid-token'])
      
      const newPasswordInput = screen.getByLabelText(/New password/i)
      const confirmPasswordInput = screen.getByLabelText(/Confirm password/i)
      const submitButton = screen.getByRole('button', { name: /Set new password/i })

      await user.type(newPasswordInput, 'StrongPassword123!')
      await user.type(confirmPasswordInput, 'StrongPassword123') // mismatch
      await user.click(submitButton)

      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument()
    })

    it('shows error if password is too weak on submit', async () => {
      const user = userEvent.setup()
      renderPage(['/forgot-password?state=reset&token=valid-token'])
      
      const newPasswordInput = screen.getByLabelText(/New password/i)
      const confirmPasswordInput = screen.getByLabelText(/Confirm password/i)
      const submitButton = screen.getByRole('button', { name: /Set new password/i })

      await user.type(newPasswordInput, 'weak')
      await user.type(confirmPasswordInput, 'weak')
      await user.click(submitButton)

      // Should still be on the same page, password is weak
      expect(screen.getByRole('heading', { name: /Set new password/i })).toBeInTheDocument()
    })

    it('rejects a password that fails the shared policy', async () => {
      const user = userEvent.setup()
      renderPage(['/forgot-password?state=reset&token=valid-token'])

      await user.type(screen.getByLabelText(/New password/i), 'abcdefg1')
      await user.type(screen.getByLabelText(/Confirm password/i), 'abcdefg1')
      await user.click(screen.getByRole('button', { name: /Set new password/i }))

      expect(screen.getByRole('heading', { name: /Set new password/i })).toBeInTheDocument()
      expect(screen.getByText(/Use at least 12 characters/i)).toBeInTheDocument()
      expect(screen.getByText(/Include an uppercase letter/i)).toBeInTheDocument()
      expect(screen.getByText(/Include a symbol/i)).toBeInTheDocument()
    })

    it('navigates to login on successful password reset', async () => {
      const user = userEvent.setup()
      renderPage(['/forgot-password?state=reset&token=valid-token'])
      
      const newPasswordInput = screen.getByLabelText(/New password/i)
      const confirmPasswordInput = screen.getByLabelText(/Confirm password/i)
      const submitButton = screen.getByRole('button', { name: /Set new password/i })

      // Strong password requirement: >8 chars, upper, lower, digit
      await user.type(newPasswordInput, 'StrongPassword123!')
      await user.type(confirmPasswordInput, 'StrongPassword123!')
      await user.click(submitButton)

      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })
})
