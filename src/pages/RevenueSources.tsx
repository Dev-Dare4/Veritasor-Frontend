import { useState, useCallback, useMemo, useRef, useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useDragReorder } from '../hooks/useDragReorder'
import { useToast } from '../components/ToastContext'
import { EmptyStateIllustration } from '../components/EmptyStateIllustrations'
import { useSources, sourcesStore, type Source, type HealthStatus } from '../store/sourcesStore'

// Types and seed data are imported from the store

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_META: Record<HealthStatus, { label: string; bg: string; color: string }> = {
  healthy: { label: 'Healthy', bg: 'var(--success-soft)', color: 'var(--success)' },
  warning: { label: 'Warning', bg: 'var(--warning-soft)', color: 'var(--warning)' },
  error: { label: 'Error', bg: 'var(--danger-soft)', color: 'var(--danger)' },
}

function formatSync(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Returns a human-readable relative time string for how long ago a date was.
 * e.g. "3 days ago", "about 2 months ago"
 */
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays < 1) return 'today'
  if (diffDays === 1) return '1 day ago'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.round(diffDays / 30)
  if (diffMonths === 1) return 'about 1 month ago'
  return `about ${diffMonths} months ago`
}

// ---------------------------------------------------------------------------
// Mock impact data — replace with real API
// ---------------------------------------------------------------------------

interface ImpactPipeline {
  id: string
  name: string
  nextRun: string
}

function getMockImpact(provider: string): ImpactPipeline[] {
  const base = new Date()
  base.setDate(base.getDate() + 1)
  return [
    { id: 'pipe-001', name: `${provider} Revenue Verification`, nextRun: base.toISOString() },
    { id: 'pipe-002', name: 'Monthly Attestation Batch', nextRun: new Date(base.getTime() + 86400000 * 2).toISOString() },
    { id: 'pipe-003', name: 'Compliance Report Sync', nextRun: new Date(base.getTime() + 86400000 * 7).toISOString() },
  ]
}

function formatNextRun(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  if (diff < 0) return 'Overdue'
  if (diff < 86400000) return 'Tomorrow'
  if (diff < 86400000 * 2) return 'In 2 days'
  if (diff < 86400000 * 7) return `In ${Math.round(diff / 86400000)} days`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---------------------------------------------------------------------------
// ExpiredTokenBanner — #222
// ---------------------------------------------------------------------------

interface ExpiredTokenBannerProps {
  sources: Source[]
  onReconnect: (id: string) => void
  dismissedIds: Set<string>
  onDismiss: (id: string) => void
}

function ExpiredTokenBanner({ sources, onReconnect, dismissedIds, onDismiss }: ExpiredTokenBannerProps) {
  const expiredSources = sources.filter(
    (s) => s.tokenExpiredAt !== undefined && !dismissedIds.has(s.id),
  )

  if (expiredSources.length === 0) return null

  return (
    <section
      aria-label={`${expiredSources.length} revenue source${expiredSources.length !== 1 ? 's' : ''} need${expiredSources.length === 1 ? 's' : ''} reconnecting`}
      style={{
        display: 'grid',
        gap: '0.625rem',
        padding: '1rem 1.1rem',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(251,191,36,0.35)',
        background:
          'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,113,133,0.05)),var(--surface)',
        marginBottom: '1.25rem',
      }}
    >
      {/* Banner header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Warning icon */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem',
              height: '1.75rem',
              borderRadius: '50%',
              background: 'var(--warning-soft)',
              color: 'var(--warning)',
              fontSize: '0.9rem',
              flexShrink: 0,
            }}
          >
            ⚠
          </span>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text)' }}>
            {expiredSources.length === 1
              ? `${expiredSources[0].provider} needs reconnecting`
              : `${expiredSources.length} sources need reconnecting`}
          </strong>
        </div>
      </div>

      {/* Per-source rows */}
      <ul
        style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}
        aria-label="Expired integrations"
      >
        {expiredSources.map((source) => (
          <li
            key={source.id}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.625rem 0.875rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
              background: 'rgba(15,23,42,0.5)',
            }}
          >
            {/* Provider + account */}
            <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{source.provider}</span>
              <span style={{ color: 'var(--muted)', fontSize: '0.82rem', marginLeft: '0.5rem' }}>
                {source.accountLabel}
              </span>
            </div>

            {/* Relative expiry time */}
            <span
              aria-label={`Token expired ${formatRelativeTime(source.tokenExpiredAt!)}`}
              style={{
                fontSize: '0.78rem',
                color: 'var(--warning)',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Expired {formatRelativeTime(source.tokenExpiredAt!)}
            </span>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
              <button
                type="button"
                aria-label={`Reconnect ${source.provider} now`}
                onClick={() => onReconnect(source.id)}
                style={{
                  ...accentBtn,
                  fontSize: '0.82rem',
                  padding: '0.35rem 0.875rem',
                }}
              >
                Reconnect
              </button>
              <button
                type="button"
                aria-label={`Dismiss reconnect reminder for ${source.provider}`}
                onClick={() => onDismiss(source.id)}
                style={{
                  ...secondaryBtn,
                  fontSize: '0.82rem',
                  padding: '0.35rem 0.625rem',
                  minWidth: 'auto',
                }}
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Footer note */}
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.55 }}>
        Attestations that rely on these sources will be incomplete until they are reconnected.
        Dismissed reminders reappear after 24 hours.
      </p>
    </section>
  )
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  source: Source
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ source, onConfirm, onCancel }: ConfirmDialogProps) {
  const [typedName, setTypedName] = useState('')
  const expectedName = source.provider
  const isConfirmed = typedName === expectedName

  const impactPipelines = useMemo(() => getMockImpact(source.provider), [source.provider])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-desc"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(2,6,23,0.72)',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: 'min(480px, 100%)',
          background: 'var(--surface-strong, #0f1b30)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '1.75rem',
          display: 'grid',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div>
          <h2 id="confirm-title" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--danger)' }}>
            Disconnect {source.provider}?
          </h2>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
            <strong style={{ color: 'var(--text)' }}>{source.accountLabel}</strong> will be removed.
            This action cannot be undone.
          </p>
        </div>

        {/* Impact preview */}
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(251,113,133,0.25)',
            background: 'rgba(251,113,133,0.06)',
            display: 'grid',
            gap: '0.65rem',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--danger)' }}>
            ⚠ Affected pipelines
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
            {impactPipelines.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.85rem',
                  padding: '0.4rem 0.5rem',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</span>
                <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                  Next: {formatNextRun(p.nextRun)}
                </span>
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.5 }}>
            Future attestations will not include data from this source.
            Scheduled attestations listed above may pause or fail.
          </p>
        </div>

        {/* Typed confirmation */}
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <label
            htmlFor="disconnect-confirm-input"
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}
          >
            Type <strong style={{ color: 'var(--danger)' }}>{expectedName}</strong> to confirm
          </label>
          <input
            id="disconnect-confirm-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={`Type "${expectedName}" to confirm`}
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            aria-describedby="confirm-desc"
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: 8,
              border: `1px solid ${typedName && !isConfirmed ? 'rgba(251,113,133,0.5)' : 'var(--border)'}`,
              background: 'var(--surface-strong)',
              color: 'var(--text)',
              fontSize: '0.95rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              outline: 'none',
            }}
          />
          {typedName && !isConfirmed && (
            <p role="alert" style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--danger)' }}>
              Name does not match. Please type exactly "{expectedName}".
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={secondaryBtn}>Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!isConfirmed}
            style={{
              ...dangerBtn,
              opacity: isConfirmed ? 1 : 0.4,
              cursor: isConfirmed ? 'pointer' : 'not-allowed',
            }}
          >
            Disconnect {source.provider}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared button styles
// ---------------------------------------------------------------------------

const baseBtn: CSSProperties = {
  padding: '0.45rem 1rem',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid transparent',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'opacity 160ms',
}

const secondaryBtn: CSSProperties = {
  ...baseBtn,
  background: 'rgba(148,163,184,0.08)',
  borderColor: 'var(--border)',
  color: 'var(--text)',
}

const dangerBtn: CSSProperties = {
  ...baseBtn,
  background: 'var(--danger-soft)',
  borderColor: 'rgba(251,113,133,0.35)',
  color: 'var(--danger)',
}

const accentBtn: CSSProperties = {
  ...baseBtn,
  background: 'rgba(94,234,212,0.08)',
  borderColor: 'rgba(94,234,212,0.3)',
  color: 'var(--accent)',
}

const moveBtn: CSSProperties = {
  ...baseBtn,
  padding: '0',
  width: '1.5rem',
  height: '1.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.6rem',
  lineHeight: 1,
  background: 'rgba(148,163,184,0.06)',
  borderColor: 'var(--border)',
  color: 'var(--muted)',
  cursor: 'pointer',
  borderRadius: '0.25rem',
}

// Drag handle — six-dot grip icon rendered via box-shadow dots
const HANDLE_SIZE = 20

// ---------------------------------------------------------------------------
// DragHandle
// ---------------------------------------------------------------------------

interface DragHandleProps {
  label: string
  isGrabbed: boolean
  onPointerDown: (e: { preventDefault(): void }) => void
  onKeyDown: (e: { key: string; preventDefault(): void }) => void
  onClick: () => void
}

function DragHandle({ label, isGrabbed, onPointerDown, onKeyDown, onClick }: DragHandleProps) {
  return (
    <button
      type="button"
      aria-label={isGrabbed ? `Release ${label}` : `Reorder ${label}`}
      aria-pressed={isGrabbed}
      data-testid="drag-handle"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: HANDLE_SIZE + 16,
        height: HANDLE_SIZE + 16,
        padding: '0.5rem',
        background: isGrabbed ? 'rgba(94,234,212,0.15)' : 'transparent',
        border: isGrabbed ? '1px solid rgba(94,234,212,0.45)' : '1px solid transparent',
        borderRadius: '0.4rem',
        cursor: isGrabbed ? 'grabbing' : 'grab',
        color: 'var(--muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        transition: 'background 120ms, border-color 120ms, color 120ms',
      }}
    >
      {/* Six-dot grip icon (2×3 grid) */}
      <svg
        aria-hidden="true"
        width={HANDLE_SIZE}
        height={HANDLE_SIZE}
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <circle cx="7" cy="5" r="1.5" />
        <circle cx="13" cy="5" r="1.5" />
        <circle cx="7" cy="10" r="1.5" />
        <circle cx="13" cy="10" r="1.5" />
        <circle cx="7" cy="15" r="1.5" />
        <circle cx="13" cy="15" r="1.5" />
      </svg>
    </button>
  )
}

// ---------------------------------------------------------------------------
// SourceRow
// ---------------------------------------------------------------------------

interface SourceRowProps {
  source: Source
  index: number
  totalCount: number
  isGrabbed: boolean
  isDropTarget: boolean
  onReconnect: (id: string) => void
  onDisconnect: (source: Source) => void
  onPointerDown: (e: { preventDefault(): void }) => void
  onPointerEnter: () => void
  onKeyDown: (e: { key: string; preventDefault(): void }) => void
  onHandleClick: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

function SourceRow({
  source,
  index,
  totalCount,
  isGrabbed,
  isDropTarget,
  onReconnect,
  onDisconnect,
  onPointerDown,
  onPointerEnter,
  onKeyDown,
  onHandleClick,
  onMoveUp,
  onMoveDown,
}: SourceRowProps) {
  const s = STATUS_META[source.status]

  const rowStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 1.25rem',
    background: isGrabbed
      ? 'rgba(94,234,212,0.06)'
      : isDropTarget
        ? 'rgba(94,234,212,0.03)'
        : 'var(--surface)',
    border: isGrabbed
      ? '1px solid rgba(94,234,212,0.45)'
      : isDropTarget
        ? '2px dashed rgba(94,234,212,0.6)'
        : '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    opacity: isGrabbed ? 0.85 : 1,
    outline: 'none',
    transition: 'background 120ms, border-color 120ms, opacity 120ms',
  }

  return (
    <li
      role="listitem"
      aria-label={`${source.provider}, priority ${index + 1} of ${totalCount}`}
      aria-grabbed={isGrabbed || undefined}
      onPointerEnter={onPointerEnter}
      style={rowStyle}
    >
      <DragHandle
        label={source.provider}
        isGrabbed={isGrabbed}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onClick={onHandleClick}
      />

      {/* Per-row move up/down controls — keyboard-accessible alternative to drag */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <button
          type="button"
          aria-label={`Move ${source.provider} up`}
          disabled={index === 0}
          data-testid={`move-up-${index}`}
          onClick={onMoveUp}
          style={{
            ...moveBtn,
            visibility: index === 0 ? 'hidden' : 'visible',
          }}
        >
          ▲
        </button>
        <button
          type="button"
          aria-label={`Move ${source.provider} down`}
          disabled={index === totalCount - 1}
          data-testid={`move-down-${index}`}
          onClick={onMoveDown}
          style={{
            ...moveBtn,
            visibility: index === totalCount - 1 ? 'hidden' : 'visible',
          }}
        >
          ▼
        </button>
      </div>

      {/* Provider + account */}
      <div style={{ flex: '1 1 10rem', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{source.provider}</div>
        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.15rem' }}>
          {source.accountLabel}
        </div>
      </div>

      {/* Status badge */}
      <span
        aria-label={`Health status: ${s.label}`}
        style={{
          padding: '0.2rem 0.7rem',
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 700,
          background: s.bg,
          color: s.color,
          flexShrink: 0,
        }}
      >
        {s.label}
      </span>

      {/* Last sync */}
      <div style={{ color: 'var(--muted)', fontSize: '0.82rem', flexShrink: 0, minWidth: '9rem' }}>
        <span style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.1rem' }}>
          Last sync
        </span>
        <time dateTime={source.lastSync ?? ''} style={{ color: 'var(--text)' }}>
          {formatSync(source.lastSync)}
        </time>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        {source.status !== 'healthy' && (
          <button
            type="button"
            aria-label={`Reconnect ${source.provider}`}
            onClick={() => onReconnect(source.id)}
            style={accentBtn}
          >
            Reconnect
          </button>
        )}
        <button
          type="button"
          aria-label={`Disconnect ${source.provider}`}
          onClick={() => onDisconnect(source)}
          style={dangerBtn}
        >
          Disconnect
        </button>
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// RevenueSources
// ---------------------------------------------------------------------------
//
// Keyboard interaction model (WCAG 2.1 AA):
//
// 1. Drag handle (six-dot grip)
//    - Click/Tap         → Enter keyboard-reorder mode (grab)
//    - Pointer drag      → Drag-and-drop reorder
//    - When grabbed: Arrow Up/Down to move, Enter/Space to drop, Escape to cancel
//
// 2. Per-row move-up/move-down buttons (▲ / ▼)
//    - Single click moves the item one position up or down
//    - Buttons are hidden at list boundaries (first item cannot move up, etc.)
//    - aria-live region announces each move: "Stripe moved up to position 2 of 3"
//
// 3. aria-live="polite" region
//    - Announces all reorder actions to screen readers
//    - Visually hidden but present in the DOM for assistive technology
// ---------------------------------------------------------------------------

export default function RevenueSources() {
  const { addToast } = useToast()
  const sources = useSources()
  const [pendingDisconnect, setPendingDisconnect] = useState<Source | null>(null)
  const [dismissedBannerIds, setDismissedBannerIds] = useState<Set<string>>(new Set())
  const dismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const getLabel = useCallback((s: Source) => s.provider, [])

  const {
    grabbedIndex,
    dropTargetIndex,
    announcement,
    handlePointerDown,
    handlePointerEnter,
    handlePointerUp,
    handleKeyboardGrab,
    handleKeyDown,
    moveUp,
    moveDown,
  } = useDragReorder(sources, sourcesStore.setAll, getLabel)

  function handleReconnect(id: string) {
    sourcesStore.update(id, { status: 'healthy', lastSync: new Date().toISOString(), tokenExpiredAt: undefined })
    const timer = dismissTimers.current.get(id)
    if (timer) { clearTimeout(timer); dismissTimers.current.delete(id) }
  }

  function handleBannerDismiss(id: string) {
    setDismissedBannerIds((prev) => new Set(prev).add(id))
    const timer = setTimeout(() => {
      setDismissedBannerIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      dismissTimers.current.delete(id)
    }, 30_000)
    dismissTimers.current.set(id, timer)
  }

  function handleDisconnectRequest(source: Source) {
    setPendingDisconnect(source)
  }

  function handleDisconnectConfirm() {
    if (!pendingDisconnect) return
    const source = pendingDisconnect
    setPendingDisconnect(null)
    sourcesStore.remove(source.id)
    addToast(
      `Disconnected ${source.provider}`,
      'info',
      8000,
      () => {
        sourcesStore.restore(source)
        addToast(`Reconnected ${source.provider}`, 'success')
      },
      'Undo'
    )
  }

  return (
    <div style={{ maxWidth: '52rem' }}>
      <h1 style={{ marginTop: 0 }}>Revenue Sources</h1>
      <p style={{ color: 'var(--muted)' }}>
        Connected integrations used to collect revenue data for attestations.
        Drag or use the handle's keyboard controls to set attestation priority order.
      </p>

      {/* aria-live region for drag/keyboard announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="dnd-announcement"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {announcement}
      </div>

      {/* ── Expired-token reconnect banner (#222) ── */}
      <ExpiredTokenBanner
        sources={sources}
        onReconnect={handleReconnect}
        dismissedIds={dismissedBannerIds}
        onDismiss={handleBannerDismiss}
      />

      {sources.length === 0 ? (
        <section
          aria-label="No sources connected"
          style={{
            marginTop: '2rem',
            padding: '1.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <EmptyStateIllustration type="revenue-sources" />
          <p style={{ margin: '0.5rem 0 1rem', color: 'var(--muted)' }}>
            No revenue sources connected.
          </p>
          <Link
            to="/connect-source/provider"
            className="app-button app-button-primary"
            style={{ display: 'inline-flex', textDecoration: 'none' }}
          >
            Connect a source
          </Link>
        </section>
      ) : (
        <ul
          aria-label="Connected revenue sources"
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ listStyle: 'none', margin: '2rem 0 0', padding: 0, display: 'grid', gap: '0.75rem', touchAction: 'none' }}
        >
          {sources.map((source, index) => (
            <SourceRow
              key={source.id}
              source={source}
              index={index}
              totalCount={sources.length}
              isGrabbed={grabbedIndex === index}
              isDropTarget={dropTargetIndex === index && grabbedIndex !== null && grabbedIndex !== index}
              onReconnect={handleReconnect}
              onDisconnect={handleDisconnectRequest}
              onPointerDown={handlePointerDown(index)}
              onPointerEnter={handlePointerEnter(index)}
              onKeyDown={handleKeyDown}
              onHandleClick={() => handleKeyboardGrab(index)}
              onMoveUp={() => moveUp(index)}
              onMoveDown={() => moveDown(index)}
            />
          ))}
        </ul>
      )}

      {pendingDisconnect && (
        <ConfirmDialog
          source={pendingDisconnect}
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setPendingDisconnect(null)}
        />
      )}
    </div>
  )
}
