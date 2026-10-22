import { useEffect, useRef } from 'react'
import {
  SHORTCUT_REGISTRY,
  KeyboardShortcutActions,
  ShortcutDefinition,
} from '../constants/shortcuts'

export interface UseKeyboardShortcutsOptions {
  timeoutMs?: number
  registry?: readonly ShortcutDefinition[]
  enabled?: boolean
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true
  }
  let current: HTMLElement | null = target
  while (current) {
    if (
      current.isContentEditable ||
      current.contentEditable === 'true' ||
      current.contentEditable === '' ||
      current.getAttribute?.('contenteditable') === 'true' ||
      current.getAttribute?.('contenteditable') === ''
    ) {
      return true
    }
    current = current.parentElement
  }
  return false
}

type ChordState =
  | { type: 'idle' }
  | { type: 'pending-key'; firstKey: string }
  | { type: 'pending-ctrl-k' }

export function useKeyboardShortcuts(
  actions: KeyboardShortcutActions = {},
  options: UseKeyboardShortcutsOptions = {},
) {
  const { timeoutMs = 1000, registry = SHORTCUT_REGISTRY, enabled = true } = options
  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  })

  const chordStateRef = useRef<ChordState>({ type: 'idle' })
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    function clearChordTimer() {
      if (chordTimerRef.current !== null) {
        clearTimeout(chordTimerRef.current)
        chordTimerRef.current = null
      }
    }

    function resetChordState() {
      clearChordTimer()
      chordStateRef.current = { type: 'idle' }
    }

    function executeAction(
      actionKey: keyof KeyboardShortcutActions,
      id?: string,
    ) {
      const currentActions = actionsRef.current
      const handler = currentActions[actionKey] || (id ? currentActions[id] : undefined)
      if (typeof handler === 'function') {
        handler()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) {
        if (chordStateRef.current.type !== 'idle') {
          resetChordState()
        }
        return
      }

      const hasCtrlOrMeta = e.ctrlKey || e.metaKey
      const hasModifier = hasCtrlOrMeta || e.altKey || e.shiftKey
      const keyLower = e.key.toLowerCase()

      // 1. Shift+? — Open keyboard shortcuts
      if (e.shiftKey && !hasCtrlOrMeta && !e.altKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault()
        resetChordState()
        executeAction('onToggleShortcuts', 'open-shortcuts')
        return
      }

      // 2. Ctrl/Cmd+H — Open help search
      if (hasCtrlOrMeta && !e.shiftKey && !e.altKey && keyLower === 'h') {
        e.preventDefault()
        resetChordState()
        executeAction('onOpenHelpSearch', 'open-help')
        return
      }

      // 3. Ctrl/Cmd+K — Open command palette and prime chord for W
      if (hasCtrlOrMeta && !e.shiftKey && !e.altKey && keyLower === 'k') {
        e.preventDefault()
        clearChordTimer()
        chordStateRef.current = { type: 'pending-ctrl-k' }
        chordTimerRef.current = setTimeout(() => {
          chordStateRef.current = { type: 'idle' }
        }, timeoutMs)
        executeAction('onOpenCommandPalette', 'open-command-palette')
        return
      }

      // 4. Escape — Close overlay
      if (!hasModifier && e.key === 'Escape') {
        resetChordState()
        executeAction('onCloseOverlay', 'close-overlay')
        return
      }

      // 5. If any modifier is held, sequential chords must not advance or trigger
      if (hasModifier) {
        if (chordStateRef.current.type !== 'idle') {
          resetChordState()
        }
        return
      }

      // 6. Non-modifier sequential handling
      // Subcase A: Waiting for W after Ctrl+K
      if (chordStateRef.current.type === 'pending-ctrl-k') {
        if (keyLower === 'w') {
          e.preventDefault()
          resetChordState()
          executeAction('onWorkspaceJump', 'workspace-jump')
          return
        }
        // Invalid follow-up key to Ctrl+K
        resetChordState()
        return
      }

      // Subcase B: Waiting for second key of sequential chord (e.g. after 'g' or 'c')
      if (chordStateRef.current.type === 'pending-key') {
        const firstKey = chordStateRef.current.firstKey
        clearChordTimer()
        chordStateRef.current = { type: 'idle' }

        const matchedSeq = registry.find(
          (s) =>
            s.type === 'sequence' &&
            s.sequence?.[0] === firstKey &&
            s.sequence?.[1] === keyLower,
        )

        if (matchedSeq) {
          e.preventDefault()
          executeAction(matchedSeq.actionKey, matchedSeq.id)
          return
        }

        // Invalid second key — state was reset to idle, do not execute anything
        return
      }

      // Subcase C: Currently idle — check if this key can start a sequential chord
      const canStartChord = registry.some(
        (s) => s.type === 'sequence' && s.sequence?.[0] === keyLower,
      )

      if (canStartChord) {
        clearChordTimer()
        chordStateRef.current = { type: 'pending-key', firstKey: keyLower }
        chordTimerRef.current = setTimeout(() => {
          chordStateRef.current = { type: 'idle' }
        }, timeoutMs)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      clearChordTimer()
    }
  }, [enabled, timeoutMs, registry])
}

export default useKeyboardShortcuts
