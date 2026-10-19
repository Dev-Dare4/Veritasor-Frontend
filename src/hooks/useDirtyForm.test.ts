// Regression coverage for issue #638 — SaveStatus failure handling.
//
// Branch evidence exercised:
//   - src/hooks/useDirtyForm.ts:63  → `return null` (lastSavedAt empty-result path)
//   - src/hooks/useDirtyForm.ts:116 → `throw new Error("Save failed")` (save failure path)
//
// Public contract asserted (unchanged):
//   - save() rejects with exactly `Error("Save failed")` when onSave throws or
//     rejects, reverts saveStatus to "dirty", keeps isDirty true, preserves the
//     edited values, and leaves lastSavedAt / confirmLeave untouched.
//   - lastSavedAt is null on mount whenever there is no draft in localStorage,
//     and becomes a Date after a successful save.
//   - Success path: saveStatus "saving" → "saved" → back to "idle" after 2s,
//     draft persisted, isDirty cleared, confirmLeave reset.

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDirtyForm } from './useDirtyForm'

type FormValues = { name: string }

const key = 'veritasor.useDirtyForm.test'

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  window.localStorage.clear()
})

describe('useDirtyForm — save() failure path', () => {
  it('rejects with exactly "Save failed" when onSave rejects', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'unsaved work')
    })
    expect(result.current.saveStatus).toBe('dirty')

    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ name: 'unsaved work' })
  })

  it('rejects with exactly "Save failed" when onSave throws synchronously', async () => {
    const onSave = vi.fn(() => {
      throw new Error('sync boom')
    })
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'x')
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })
    expect(result.current.saveStatus).toBe('dirty')
  })

  it('keeps the edited values, dirty flag, and null lastSavedAt after a failed save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'precious edits')
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })

    expect(result.current.values).toEqual({ name: 'precious edits' })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.saveStatus).toBe('dirty')
    expect(result.current.lastSavedAt).toBeNull()
    expect(result.current.confirmLeave).toBe(false)
  })

  it('does not clear confirmLeave on failure, but does on a subsequent successful save', async () => {
    vi.useFakeTimers()
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'x')
    })
    act(() => {
      result.current.setConfirmLeave(true)
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })
    expect(result.current.confirmLeave).toBe(true)

    await act(async () => {
      await result.current.save()
    })
    expect(result.current.confirmLeave).toBe(false)
    expect(result.current.saveStatus).toBe('saved')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.saveStatus).toBe('idle')
  })

  it('marks saveStatus "dirty" after a failed save even when the form was clean (documents current behavior)', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    expect(result.current.isDirty).toBe(false)

    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })

    expect(result.current.isDirty).toBe(false)
    expect(result.current.saveStatus).toBe('dirty')
  })

  it('never reaches the saved state when onSave fails repeatedly', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'x')
    })

    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })
    await act(async () => {
      await expect(result.current.save()).rejects.toThrowError(/^Save failed$/)
    })

    expect(onSave).toHaveBeenCalledTimes(2)
    expect(result.current.saveStatus).toBe('dirty')
    expect(result.current.isDirty).toBe(true)
    expect(result.current.lastSavedAt).toBeNull()
  })
})

describe('useDirtyForm — lastSavedAt empty-result path', () => {
  it('is null on mount when localStorage has no draft', () => {
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    expect(result.current.lastSavedAt).toBeNull()
    expect(result.current.saveStatus).toBe('idle')
  })

  it('is null on mount when the stored draft is an empty string', () => {
    window.localStorage.setItem(key, '')
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    expect(result.current.lastSavedAt).toBeNull()
    expect(result.current.values).toEqual({ name: '' })
  })

  it('is a Date on mount when a draft exists, and the draft is hydrated', () => {
    window.localStorage.setItem(key, JSON.stringify({ name: 'from-draft' }))
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    expect(result.current.lastSavedAt).toBeInstanceOf(Date)
    expect(result.current.values).toEqual({ name: 'from-draft' })
  })

  it('is a Date on mount even when the draft is malformed JSON (presence-only check), with values falling back to initial', () => {
    window.localStorage.setItem(key, '{not json')
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    expect(result.current.lastSavedAt).toBeInstanceOf(Date)
    expect(result.current.values).toEqual({ name: '' })
  })

  it('transitions from null to a Date after a successful save and persists the draft', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    expect(result.current.lastSavedAt).toBeNull()

    act(() => {
      result.current.setField('name', 'saved!')
    })
    await act(async () => {
      await result.current.save()
    })

    expect(result.current.lastSavedAt).toBeInstanceOf(Date)
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.isDirty).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual({
      name: 'saved!',
    })

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.saveStatus).toBe('idle')
  })
})

describe('useDirtyForm — neighboring normal paths', () => {
  it('save() without onSave persists the draft and reports saved', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'local only')
    })
    await act(async () => {
      await result.current.save()
    })
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.isDirty).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(key)!)).toEqual({
      name: 'local only',
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.saveStatus).toBe('idle')
  })

  it('auto-saves after autoSaveIntervalMs when dirty and returns to idle', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSaveIntervalMs: 1000,
      }),
    )
    act(() => {
      result.current.setField('name', 'autosaved')
    })
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith({ name: 'autosaved' })
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.isDirty).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.saveStatus).toBe('idle')
  })

  it('does not auto-save when autoSave is disabled', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        onSave,
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'manual only')
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(onSave).not.toHaveBeenCalled()
    expect(result.current.saveStatus).toBe('dirty')
  })

  it('reset() restores the initial values and returns to idle', () => {
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', 'changed')
    })
    expect(result.current.isDirty).toBe(true)
    act(() => {
      result.current.reset()
    })
    expect(result.current.values).toEqual({ name: '' })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.saveStatus).toBe('idle')
  })

  it('clearDraft() drops the drafted values, resets lastSavedAt to null, and leaves storage holding the initial values', () => {
    // Current contract: clearDraft() removes the key, but because it also
    // resets `values`, the persist effect immediately re-writes the (initial)
    // values. The guaranteed observable outcome is that the *drafted* values
    // are gone from storage — not that the key is absent.
    window.localStorage.setItem(key, JSON.stringify({ name: 'draft' }))
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    expect(result.current.lastSavedAt).not.toBeNull()
    act(() => {
      result.current.clearDraft()
    })
    expect(JSON.parse(window.localStorage.getItem(key) ?? 'null')).toEqual({
      name: '',
    })
    expect(result.current.values).toEqual({ name: '' })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.saveStatus).toBe('idle')
    expect(result.current.lastSavedAt).toBeNull()
    expect(result.current.confirmLeave).toBe(false)
  })
})

describe('useDirtyForm — boundary inputs', () => {
  it('does not read, write, or remove storage when persistence is disabled', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem')
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        persist: false,
        autoSave: false,
      }),
    )

    act(() => result.current.setField('name', 'secret'))
    await act(async () => result.current.save())
    act(() => result.current.clearDraft())

    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    getItem.mockRestore()
    setItem.mockRestore()
    removeItem.mockRestore()
  })

  it('setField with an unchanged value keeps the form clean', () => {
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
      }),
    )
    act(() => {
      result.current.setField('name', '')
    })
    expect(result.current.isDirty).toBe(false)
    expect(result.current.saveStatus).toBe('idle')
  })

  it('respects a custom isEqual comparator (trimmed comparison)', () => {
    const isEqual = (a: FormValues, b: FormValues) =>
      a.name.trim() === b.name.trim()
    const { result } = renderHook(() =>
      useDirtyForm<FormValues>({
        storageKey: key,
        initialValues: { name: '' },
        autoSave: false,
        isEqual,
      }),
    )
    act(() => {
      result.current.setField('name', '  ')
    })
    expect(result.current.isDirty).toBe(false)
    act(() => {
      result.current.setField('name', ' x')
    })
    expect(result.current.isDirty).toBe(true)
    expect(result.current.saveStatus).toBe('dirty')
  })

  it('merges a partial stored draft over the initial values', () => {
    window.localStorage.setItem(key, JSON.stringify({ name: 'from-draft' }))
    const { result } = renderHook(() =>
      useDirtyForm<{ name: string; extra: string }>({
        storageKey: key,
        initialValues: { name: '', extra: 'kept' },
        autoSave: false,
      }),
    )
    expect(result.current.values).toEqual({
      name: 'from-draft',
      extra: 'kept',
    })
  })

  it('tolerates unserializable values: dirty tracking falls back to identity, persistence is skipped, and save still succeeds', async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() =>
      useDirtyForm<{ name: string; meta: Record<string, unknown> }>({
        storageKey: key,
        initialValues: { name: '', meta: {} },
        onSave,
        autoSave: false,
      }),
    )
    const circular: Record<string, unknown> = {}
    circular.self = circular
    act(() => {
      result.current.setField('meta', circular)
    })
    expect(result.current.isDirty).toBe(true)

    await act(async () => {
      await result.current.save()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(result.current.saveStatus).toBe('saved')
    expect(result.current.lastSavedAt).toBeInstanceOf(Date)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.saveStatus).toBe('idle')
  })
})
