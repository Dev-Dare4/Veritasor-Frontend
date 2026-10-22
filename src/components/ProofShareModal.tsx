import React, { useState, useEffect, useRef } from 'react'
import { useToast } from './ToastContext'

// Shared password strength logic
function computeStrength(password: string): number {
  if (!password) return 0
  if (password.length < 8) return 1
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasDigit = /[0-9]/.test(password)
  const hasSym = /[^A-Za-z0-9]/.test(password)
  const mixed = hasUpper && hasLower && hasDigit
  if (password.length >= 12 && mixed && hasSym) return 4
  if (password.length >= 12 && mixed) return 3
  if (password.length >= 8 && (hasUpper || hasLower) && hasDigit) return 2
  return 1
}

const STRENGTH_COPY: Record<number, string> = {
  0: 'Enter a password to see its strength',
  1: 'Too short — use at least 8 characters',
  2: 'Fair — try adding uppercase and numbers',
  3: 'Good — add a symbol for maximum strength',
  4: 'Strong enough for a production workspace',
}

interface ProofShareModalProps {
  isOpen: boolean
  onClose: () => void
  attestationId: string
}

type PermissionType = 'public' | 'password'

export default function ProofShareModal({ isOpen, onClose, attestationId }: ProofShareModalProps) {
  const [permission, setPermission] = useState<PermissionType>('public')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiry, setExpiry] = useState('none')
  const [generatedLink, setGeneratedLink] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  
  const { addToast } = useToast()
  const modalRef = useRef<HTMLDivElement>(null)
  
  const strength = computeStrength(password)
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])
  
  // Trap focus
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      const firstElement = focusableElements[0] as HTMLElement
      if (firstElement) {
        firstElement.focus()
      }
    }
  }, [isOpen])
  
  if (!isOpen) return null

  const handleGenerateLink = () => {
    if (permission === 'password' && strength < 2) {
      addToast('Please enter a stronger password.', 'error')
      return
    }

    // Deterministic demo URL derived solely from the attestation ID
    const params = new URLSearchParams({ share: attestationId })
    if (expiry !== 'none') params.set('expires', expiry)
    if (permission === 'password') params.set('protected', '1')
    const link = `https://veritasor.app/proof/${attestationId}?${params.toString()}`
    setGeneratedLink(link)
    addToast('Link generated successfully.', 'success')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch {
      addToast('Failed to copy link.', 'error')
    }
  }

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
    >
      <div 
        ref={modalRef}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          width: '100%',
          maxWidth: '500px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="share-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Share Attestation Proof</h2>
          <button 
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '0.25rem',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Permissions Section */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text)' }}>Link Permissions</legend>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="permission" 
                  value="public" 
                  checked={permission === 'public'}
                  onChange={() => setPermission('public')}
                />
                Public
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="permission" 
                  value="password" 
                  checked={permission === 'password'}
                  onChange={() => setPermission('password')}
                />
                Password Protected
              </label>
            </div>
          </fieldset>
          
          {/* Password Input & Shared Meter */}
          {permission === 'password' && (
            <div className="auth-input-group" style={{ margin: 0 }}>
              <label className="auth-label" htmlFor="share-password">
                Password
              </label>
              <div className="auth-input-toggle-group">
                <input
                  id="share-password"
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="share-password-strength"
                />
                <button
                  type="button"
                  className="auth-toggle-btn"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div
                className="auth-strength"
                id="share-password-strength"
                aria-label="Password strength"
                aria-live="polite"
                aria-atomic="true"
                style={{ marginTop: '0.5rem' }}
              >
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={
                      'auth-strength-bar' +
                      (strength >= bar ? ' auth-strength-bar-active' : '')
                    }
                  />
                ))}
                <p className="auth-strength-copy">{STRENGTH_COPY[strength]}</p>
              </div>
            </div>
          )}
          
          {/* Expiry Picker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="share-expiry" style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>
              Expiry
            </label>
            <select 
              id="share-expiry" 
              className="auth-input"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              style={{ appearance: 'auto' }}
            >
              <option value="none">Never expire</option>
              <option value="1hour">1 Hour</option>
              <option value="1day">1 Day</option>
              <option value="1week">1 Week</option>
            </select>
          </div>
          
          {/* Generated Link & Copy */}
          {generatedLink && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)' }}>Shareable Link</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={generatedLink}
                  className="auth-input"
                  style={{ flex: 1, backgroundColor: 'var(--bg)', color: 'var(--muted)' }}
                  aria-label="Generated link"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="auth-button auth-button-secondary"
                  style={{ width: 'auto', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  aria-live="polite"
                >
                  {isCopied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
        </div>
        
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'var(--bg)' }}>
          <button 
            type="button" 
            onClick={onClose}
            className="auth-button auth-button-ghost"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
          >
            Cancel
          </button>
          {!generatedLink && (
            <button 
              type="button" 
              onClick={handleGenerateLink}
              className="auth-button auth-button-primary"
              style={{ width: 'auto', padding: '0.5rem 1.5rem' }}
            >
              Generate Link
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
