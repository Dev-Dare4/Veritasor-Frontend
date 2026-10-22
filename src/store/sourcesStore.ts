/**
 * sourcesStore — shared, persisted revenue-source list.
 *
 * Backed by localStorage so the list survives navigation and page reload.
 * Uses useSyncExternalStore so any component subscribed re-renders on change.
 * Falls back to INITIAL_SOURCES on first load or on corrupt/missing storage.
 */

import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Types (exported so pages don't need to re-declare them)
// ---------------------------------------------------------------------------

export type HealthStatus = 'healthy' | 'warning' | 'error'

export interface Source {
  id: string
  provider: string
  accountLabel: string
  status: HealthStatus
  lastSync: string | null
}

// ---------------------------------------------------------------------------
// Seed data — used on first load and as fallback for corrupt storage
// ---------------------------------------------------------------------------

export const INITIAL_SOURCES: Source[] = [
  { id: 'src-001', provider: 'Stripe',     accountLabel: 'acct_1A2B3C4D',         status: 'healthy', lastSync: '2026-06-01T14:00:00Z' },
  { id: 'src-002', provider: 'Shopify',    accountLabel: 'my-store.myshopify.com', status: 'warning', lastSync: '2026-05-30T08:15:00Z' },
  { id: 'src-003', provider: 'QuickBooks', accountLabel: 'Acme Corp',              status: 'error',   lastSync: '2026-05-20T11:45:00Z' },
]

const STORAGE_KEY = 'veritasor-sources-v1'

// ---------------------------------------------------------------------------
// Validation — rejects payloads that aren't a valid Source[]
// ---------------------------------------------------------------------------

function isValidSource(v: unknown): v is Source {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.provider === 'string' &&
    typeof s.accountLabel === 'string' &&
    (s.status === 'healthy' || s.status === 'warning' || s.status === 'error') &&
    (s.lastSync === null || typeof s.lastSync === 'string')
  )
}

function isValidSources(v: unknown): v is Source[] {
  return Array.isArray(v) && v.every(isValidSource)
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function readStorage(): Source[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_SOURCES
    const parsed: unknown = JSON.parse(raw)
    return isValidSources(parsed) ? parsed : INITIAL_SOURCES
  } catch {
    return INITIAL_SOURCES
  }
}

function writeStorage(sources: Source[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sources))
  } catch {
    // quota exceeded or private browsing — ignore
  }
}

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------

let state: Source[] = readStorage()
const listeners = new Set<() => void>()

function getSnapshot(): Source[] {
  return state
}

function getServerSnapshot(): Source[] {
  return INITIAL_SOURCES
}

function notify(): void {
  for (const l of listeners) l()
}

function setState(next: Source[]): void {
  state = next
  writeStorage(next)
  notify()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// ---------------------------------------------------------------------------
// Public store actions
// ---------------------------------------------------------------------------

export const sourcesStore = {
  /** Replace the entire list (used for reorder). */
  setAll(sources: Source[]): void {
    setState(sources)
  },

  /** Prepend a new source. Ignores duplicates (same id). */
  add(source: Source): void {
    if (state.some((s) => s.id === source.id)) return
    setState([source, ...state])
  },

  /** Remove a source by id. */
  remove(id: string): void {
    setState(state.filter((s) => s.id !== id))
  },

  /** Re-insert a previously removed source at its original index (undo support). */
  restore(source: Source): void {
    if (state.some((s) => s.id === source.id)) return
    setState([...state, source])
  },

  /** Update a single source in-place. */
  update(id: string, patch: Partial<Source>): void {
    setState(state.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  },

  /** Reset to seed data (useful for testing). */
  reset(): void {
    setState(INITIAL_SOURCES)
  },

  /** Read current state without subscribing. */
  getAll(): Source[] {
    return state
  },
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useSources(): Source[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

// ---------------------------------------------------------------------------
// ID generation for new sources added by the wizard
// ---------------------------------------------------------------------------

export function generateSourceId(): string {
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}
