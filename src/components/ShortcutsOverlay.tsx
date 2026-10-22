/**
 * ShortcutsOverlay
 *
 * Opens on Shift+? (registered in Layout). Lists all keyboard shortcuts by
 * category with a live-filter search input.
 *
 * Accessibility: WCAG 2.1 AA
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - Focus trap (Tab / Shift+Tab cycles inside the dialog)
 *   - Escape closes
 *   - Backdrop click closes
 *   - <kbd> elements for screen-reader-friendly key labels
 *   - aria-live region announces result count on search
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  SHORTCUT_CATEGORIES,
  type Shortcut,
  type ShortcutCategory,
} from '../constants/shortcuts'

export type { Shortcut, ShortcutCategory }
export { SHORTCUT_CATEGORIES }

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ShortcutsOverlay({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  const titleId = useId()
  const searchId = useId()
  const statusId = useId()

  // Save trigger, focus dialog on open; restore on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    } else {
      setQuery('')
      triggerRef.current?.focus()
    }
  }, [open])

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(
        dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE),
      )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const filteredCategories = useMemo(() => {
    if (!query.trim()) return SHORTCUT_CATEGORIES
    const q = query.toLowerCase()
    return SHORTCUT_CATEGORIES.map((cat) => ({
      ...cat,
      shortcuts: cat.shortcuts.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.keys.some((k) => k.toLowerCase().includes(q)) ||
          cat.name.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.shortcuts.length > 0)
  }, [query])

  const totalResults = filteredCategories.reduce((sum, c) => sum + c.shortcuts.length, 0)

  if (!open) return null

  return (
    <div
      className="modal-backdrop kso-backdrop"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-dialog kso-dialog"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id={titleId} className="modal-title">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className="modal-close"
            aria-label="Close keyboard shortcuts"
            onClick={onClose}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {/* Search */}
        <div className="kso-search-wrap">
          <span className="kso-search-icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            id={searchId}
            type="search"
            className="kso-search-input"
            placeholder="Filter shortcuts…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Filter shortcuts"
            aria-controls="kso-results"
          />
        </div>

        {/* Live count for screen readers */}
        <span
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {query ? `${totalResults} shortcut${totalResults !== 1 ? 's' : ''} found` : ''}
        </span>

        {/* Results */}
        <div id="kso-results" className="kso-body modal-body">
          {filteredCategories.length === 0 ? (
            <p className="kso-empty">
              No shortcuts match <strong>"{query}"</strong>
            </p>
          ) : (
            filteredCategories.map((cat) => (
              <section key={cat.name} aria-labelledby={`kso-cat-${cat.name}`}>
                <h3 id={`kso-cat-${cat.name}`} className="kso-category-title">
                  {cat.name}
                </h3>
                <ul className="kso-list" role="list">
                  {cat.shortcuts.map((shortcut) => (
                    <li key={shortcut.label} className="kso-row">
                      <span className="kso-label">{shortcut.label}</span>
                      <span className="kso-keys" aria-label={shortcut.keys.join(' then ')}>
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd key={`${key}-${keyIndex}`} className="kso-kbd">
                            {key}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="kso-footer" aria-hidden="true">
          <kbd className="kso-kbd kso-kbd-muted">Esc</kbd>
          <span>to close</span>
        </div>
      </div>
    </div>
  )
}
