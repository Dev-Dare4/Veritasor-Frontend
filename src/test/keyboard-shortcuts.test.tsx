import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import ShortcutsOverlay from '../components/ShortcutsOverlay'
import {
  SHORTCUT_REGISTRY,
  SHORTCUT_CATEGORIES,
  ShortcutDefinition,
} from '../constants/shortcuts'
import Layout from '../components/Layout'
import { CookieConsentProvider } from '../components/CookieConsentContext'
import { LocaleProvider } from '../i18n/provider'

describe('useKeyboardShortcuts hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('triggers Dashboard navigation on pressing g then d within one second', () => {
    const onNavigateDashboard = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
      }),
    )

    fireEvent.keyDown(document, { key: 'g' })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    fireEvent.keyDown(document, { key: 'd' })

    expect(onNavigateDashboard).toHaveBeenCalledOnce()
  })

  it('triggers Attestations navigation on pressing g then a', () => {
    const onNavigateAttestations = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateAttestations,
      }),
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'a' })

    expect(onNavigateAttestations).toHaveBeenCalledOnce()
  })

  it('triggers Revenue Sources navigation on pressing g then s', () => {
    const onNavigateSources = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateSources,
      }),
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(onNavigateSources).toHaveBeenCalledOnce()
  })

  it('triggers Connect Revenue Source action on pressing c then s', () => {
    const onConnectRevenueSource = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onConnectRevenueSource,
      }),
    )

    fireEvent.keyDown(document, { key: 'c' })
    fireEvent.keyDown(document, { key: 's' })

    expect(onConnectRevenueSource).toHaveBeenCalledOnce()
  })

  it('does not complete the chord if second key is pressed after the 1-second timeout', () => {
    const onNavigateDashboard = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
      }),
    )

    fireEvent.keyDown(document, { key: 'g' })
    act(() => {
      vi.advanceTimersByTime(1001)
    })
    fireEvent.keyDown(document, { key: 'd' })

    expect(onNavigateDashboard).not.toHaveBeenCalled()
  })

  it('resets chord state and does not execute shortcut when an invalid second key is pressed', () => {
    const onNavigateDashboard = vi.fn()
    const onNavigateSources = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
        onNavigateSources,
      }),
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'x' }) // invalid second key
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    // Subsequent press of 'd' should not trigger because chord was reset
    fireEvent.keyDown(document, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()
    expect(onNavigateSources).not.toHaveBeenCalled()
  })

  it('does not trigger navigation when typing in an input element', () => {
    const onNavigateDashboard = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
      }),
    )

    const input = document.createElement('input')
    document.body.appendChild(input)

    fireEvent.keyDown(input, { key: 'g' })
    fireEvent.keyDown(input, { key: 'd' })

    expect(onNavigateDashboard).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does not trigger shortcuts when typing in textarea, select, or contenteditable elements', () => {
    const onNavigateDashboard = vi.fn()
    const onConnectRevenueSource = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
        onConnectRevenueSource,
      }),
    )

    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    const editableDiv = document.createElement('div')
    editableDiv.contentEditable = 'true'
    const editableChild = document.createElement('span')
    editableDiv.appendChild(editableChild)

    document.body.appendChild(textarea)
    document.body.appendChild(select)
    document.body.appendChild(editableDiv)

    // Textarea
    fireEvent.keyDown(textarea, { key: 'g' })
    fireEvent.keyDown(textarea, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    // Select
    fireEvent.keyDown(select, { key: 'c' })
    fireEvent.keyDown(select, { key: 's' })
    expect(onConnectRevenueSource).not.toHaveBeenCalled()

    // Contenteditable child
    fireEvent.keyDown(editableChild, { key: 'g' })
    fireEvent.keyDown(editableChild, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    document.body.removeChild(textarea)
    document.body.removeChild(select)
    document.body.removeChild(editableDiv)
  })

  it('does not trigger sequential chord when modifier keys are held', () => {
    const onNavigateDashboard = vi.fn()
    renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
      }),
    )

    // Ctrl+G then d
    fireEvent.keyDown(document, { key: 'g', ctrlKey: true })
    fireEvent.keyDown(document, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    // Alt+G then d
    fireEvent.keyDown(document, { key: 'g', altKey: true })
    fireEvent.keyDown(document, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    // Shift+G then d
    fireEvent.keyDown(document, { key: 'G', shiftKey: true })
    fireEvent.keyDown(document, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    // g then Ctrl+D
    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'd', ctrlKey: true })
    expect(onNavigateDashboard).not.toHaveBeenCalled()

    // g then Shift+D
    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'D', shiftKey: true })
    expect(onNavigateDashboard).not.toHaveBeenCalled()
  })

  it('continues to support explicit modifier shortcuts including Ctrl/Cmd+K, Shift+?, and Ctrl+H', () => {
    const onOpenCommandPalette = vi.fn()
    const onToggleShortcuts = vi.fn()
    const onOpenHelpSearch = vi.fn()

    renderHook(() =>
      useKeyboardShortcuts({
        onOpenCommandPalette,
        onToggleShortcuts,
        onOpenHelpSearch,
      }),
    )

    // Shift+?
    fireEvent.keyDown(document, { key: '?', shiftKey: true })
    expect(onToggleShortcuts).toHaveBeenCalledOnce()

    // Ctrl+K
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(onOpenCommandPalette).toHaveBeenCalledOnce()

    // Cmd+K (metaKey)
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(onOpenCommandPalette).toHaveBeenCalledTimes(2)

    // Ctrl+H
    fireEvent.keyDown(document, { key: 'h', ctrlKey: true })
    expect(onOpenHelpSearch).toHaveBeenCalledOnce()

    // Meta+H
    fireEvent.keyDown(document, { key: 'h', metaKey: true })
    expect(onOpenHelpSearch).toHaveBeenCalledTimes(2)
  })

  it('continues to support the existing K->W chord', () => {
    const onOpenCommandPalette = vi.fn()
    const onWorkspaceJump = vi.fn()

    renderHook(() =>
      useKeyboardShortcuts({
        onOpenCommandPalette,
        onWorkspaceJump,
      }),
    )

    // Step 1: Ctrl+K
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(onOpenCommandPalette).toHaveBeenCalledOnce()
    expect(onWorkspaceJump).not.toHaveBeenCalled()

    // Step 2: W within 1 second
    act(() => {
      vi.advanceTimersByTime(400)
    })
    fireEvent.keyDown(document, { key: 'w' })
    expect(onWorkspaceJump).toHaveBeenCalledOnce()

    // Test timeout on K->W
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    act(() => {
      vi.advanceTimersByTime(1001)
    })
    fireEvent.keyDown(document, { key: 'w' })
    expect(onWorkspaceJump).toHaveBeenCalledTimes(1)
  })

  it('cleans up event listeners and pending timers on unmount', () => {
    const onNavigateDashboard = vi.fn()
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        onNavigateDashboard,
      }),
    )

    // Start chord
    fireEvent.keyDown(document, { key: 'g' })

    // Unmount
    unmount()

    // Try completing chord after unmount
    fireEvent.keyDown(document, { key: 'd' })
    expect(onNavigateDashboard).not.toHaveBeenCalled()
  })

  it('avoids stale closures by always invoking latest action references', () => {
    let count = 0
    const { rerender } = renderHook(
      ({ value }) =>
        useKeyboardShortcuts({
          onNavigateDashboard: () => {
            count = value
          },
        }),
      { initialProps: { value: 1 } },
    )

    rerender({ value: 42 })

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'd' })

    expect(count).toBe(42)
  })
})

describe('Shortcut registry and overlay parity', () => {
  it('renders all shortcuts from the single shared registry', () => {
    render(<ShortcutsOverlay open={true} onClose={vi.fn()} />)

    for (const shortcut of SHORTCUT_REGISTRY) {
      expect(screen.getByText(shortcut.label)).toBeInTheDocument()
    }
  })

  it('every shortcut displayed by the overlay has a supported registered action', () => {
    for (const shortcut of SHORTCUT_REGISTRY) {
      expect(shortcut.actionKey).toBeDefined()
      expect(typeof shortcut.actionKey).toBe('string')
      expect(String(shortcut.actionKey).length).toBeGreaterThan(0)
    }
  })

  it('does not advertise unsupported shortcuts', () => {
    render(<ShortcutsOverlay open={true} onClose={vi.fn()} />)

    // Unsupported items removed
    expect(screen.queryByText('Toggle theme')).not.toBeInTheDocument()
    expect(screen.queryByText('New attestation')).not.toBeInTheDocument()
    expect(screen.queryByText('Confirm attestation')).not.toBeInTheDocument()

    const registryLabels = SHORTCUT_REGISTRY.map((s: ShortcutDefinition) => s.label)
    expect(registryLabels).not.toContain('Toggle theme')
    expect(registryLabels).not.toContain('New attestation')
    expect(registryLabels).not.toContain('Confirm attestation')
  })

  it('includes all required shortcuts in the registry', () => {
    const requiredKeys = [
      ['G', 'D'],
      ['G', 'A'],
      ['G', 'S'],
      ['C', 'S'],
      ['Ctrl', 'H'],
    ]

    for (const keys of requiredKeys) {
      const match = SHORTCUT_REGISTRY.find(
        (s) =>
          s.keys.length === keys.length &&
          s.keys.every((k, i) => k.toLowerCase() === keys[i].toLowerCase()),
      )
      expect(match, `Expected shortcut ${keys.join(' ')} to be registered`).toBeDefined()
    }
  })

  it('rendered shortcut labels and key sequences correspond to their registry definitions', () => {
    render(<ShortcutsOverlay open={true} onClose={vi.fn()} />)

    for (const cat of SHORTCUT_CATEGORIES) {
      for (const item of cat.shortcuts) {
        const matchingDef = SHORTCUT_REGISTRY.find((r) => r.label === item.label)
        expect(matchingDef).toBeDefined()
        expect(item.keys).toEqual(matchingDef!.keys)
      }
    }
  })
})

describe('Layout integration with keyboard shortcuts', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size
      },
    }
    vi.stubGlobal('localStorage', mockStorage)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function LocationDisplay() {
    const location = useLocation()
    return <div data-testid="current-location">{location.pathname}</div>
  }

  function renderLayoutWithRoutes(initialRoute = '/dashboard') {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <CookieConsentProvider>
          <LocaleProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="dashboard" element={<div>Dashboard Page <LocationDisplay /></div>} />
                <Route path="attestations" element={<div>Attestations Page <LocationDisplay /></div>} />
                <Route path="sources" element={<div>Revenue Sources Page <LocationDisplay /></div>} />
                <Route
                  path="connect-source/provider"
                  element={<div>Connect Source Provider Step <LocationDisplay /></div>}
                />
              </Route>
            </Routes>
          </LocaleProvider>
        </CookieConsentProvider>
      </MemoryRouter>,
    )
  }

  it('navigates to /dashboard on G then D', () => {
    renderLayoutWithRoutes('/attestations')
    expect(screen.getByTestId('current-location')).toHaveTextContent('/attestations')

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'd' })

    expect(screen.getByTestId('current-location')).toHaveTextContent('/dashboard')
  })

  it('navigates to /attestations on G then A', () => {
    renderLayoutWithRoutes('/dashboard')
    expect(screen.getByTestId('current-location')).toHaveTextContent('/dashboard')

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 'a' })

    expect(screen.getByTestId('current-location')).toHaveTextContent('/attestations')
  })

  it('navigates to /sources on G then S', () => {
    renderLayoutWithRoutes('/dashboard')
    expect(screen.getByTestId('current-location')).toHaveTextContent('/dashboard')

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('current-location')).toHaveTextContent('/sources')
  })

  it('navigates to connect source flow on C then S', () => {
    renderLayoutWithRoutes('/dashboard')
    expect(screen.getByTestId('current-location')).toHaveTextContent('/dashboard')

    fireEvent.keyDown(document, { key: 'c' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('current-location')).toHaveTextContent('/connect-source/provider')
  })

  it('opens Help Search dialog on Ctrl+H', () => {
    renderLayoutWithRoutes('/dashboard')
    expect(screen.queryByRole('dialog', { name: /help & support/i })).not.toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'h', ctrlKey: true })

    expect(screen.getByRole('dialog', { name: /help & support/i })).toBeInTheDocument()
  })

  it('opens Shortcuts Overlay on Shift+?', () => {
    renderLayoutWithRoutes('/dashboard')
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument()

    fireEvent.keyDown(document, { key: '?', shiftKey: true })

    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument()
  })
})
