import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useObjectUrl } from './useObjectUrl'

describe('useObjectUrl', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>
  let revokeObjectURLMock: ReturnType<typeof vi.fn>
  let originalCreateObjectURL: typeof URL.createObjectURL
  let originalRevokeObjectURL: typeof URL.revokeObjectURL

  beforeEach(() => {
    originalCreateObjectURL = URL.createObjectURL
    originalRevokeObjectURL = URL.revokeObjectURL

    let counter = 0
    createObjectURLMock = vi.fn((file: Blob | MediaSource) => `blob:mock-url-${++counter}`)
    revokeObjectURLMock = vi.fn()

    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURLMock,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURLMock,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      writable: true,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  it('returns null when file is null or undefined without calling createObjectURL', () => {
    const { result, rerender } = renderHook(({ file }) => useObjectUrl(file), {
      initialProps: { file: null as File | null },
    })

    expect(result.current).toBeNull()
    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(revokeObjectURLMock).not.toHaveBeenCalled()

    rerender({ file: undefined as unknown as File })
    expect(result.current).toBeNull()
    expect(createObjectURLMock).not.toHaveBeenCalled()
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
  })

  it('calls URL.createObjectURL once and returns the object URL', () => {
    const file = new File(['content'], 'test.png', { type: 'image/png' })
    const { result } = renderHook(() => useObjectUrl(file))

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(createObjectURLMock).toHaveBeenCalledWith(file)
    expect(result.current).toBe('blob:mock-url-1')
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
  })

  it('does not re-call URL.createObjectURL on subsequent re-renders with the same file', () => {
    const file = new File(['content'], 'test.png', { type: 'image/png' })
    const { result, rerender } = renderHook(({ f }) => useObjectUrl(f), {
      initialProps: { f: file },
    })

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(result.current).toBe('blob:mock-url-1')

    // Re-render multiple times with the same file reference
    rerender({ f: file })
    rerender({ f: file })
    rerender({ f: file })
    rerender({ f: file })

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).not.toHaveBeenCalled()
    expect(result.current).toBe('blob:mock-url-1')
  })

  it('revokes previous URL and creates a new one when file changes', () => {
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.png', { type: 'image/png' })

    const { result, rerender } = renderHook(({ f }) => useObjectUrl(f), {
      initialProps: { f: fileA },
    })

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(createObjectURLMock).toHaveBeenLastCalledWith(fileA)
    expect(result.current).toBe('blob:mock-url-1')
    expect(revokeObjectURLMock).not.toHaveBeenCalled()

    // Change file
    rerender({ f: fileB })

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url-1')
    expect(createObjectURLMock).toHaveBeenCalledTimes(2)
    expect(createObjectURLMock).toHaveBeenLastCalledWith(fileB)
    expect(result.current).toBe('blob:mock-url-2')
  })

  it('revokes URL and resets to null when file is changed to null', () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' })

    const { result, rerender } = renderHook(({ f }) => useObjectUrl(f), {
      initialProps: { f: file as File | null },
    })

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(result.current).toBe('blob:mock-url-1')

    rerender({ f: null })

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url-1')
    expect(result.current).toBeNull()
  })

  it('revokes URL when component unmounts', () => {
    const file = new File(['test'], 'test.png', { type: 'image/png' })

    const { unmount } = renderHook(() => useObjectUrl(file))

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).not.toHaveBeenCalled()

    unmount()

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url-1')
  })
})
