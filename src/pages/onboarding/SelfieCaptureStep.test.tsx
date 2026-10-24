import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SelfieCaptureStep from './SelfieCaptureStep'
import type { SelfieCapture } from '../../hooks/useOnboardingDraft'

function makeFile(name: string, type: string, size: number): File {
  const file = new File(['content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const jpg = (name = 'selfie.jpg', size = 4096) => makeFile(name, 'image/jpeg', size)

describe('SelfieCaptureStep — object URL preview cleanup', () => {
  let createSpy: ReturnType<typeof vi.spyOn>
  let revokeSpy: ReturnType<typeof vi.spyOn>

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: () => 'blob:mock',
      configurable: true,
      writable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: () => {},
      configurable: true,
      writable: true,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    createSpy = vi.spyOn(URL, 'createObjectURL')
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('calls URL.createObjectURL once across multiple re-renders and revokes when clearing or unmounting', async () => {
    const onBack = vi.fn()
    const onNext = vi.fn()
    const data: SelfieCapture = { captured: false, fileName: '' }

    const { rerender, unmount } = render(
      <SelfieCaptureStep data={data} onBack={onBack} onNext={onNext} />,
    )

    // Switch to upload photo fallback
    const uploadFallbackBtn = screen.getByRole('button', { name: /Upload photo instead/i })
    fireEvent.click(uploadFallbackBtn)

    const uploadInput = document.getElementById('sc-upload-input') as HTMLInputElement
    expect(uploadInput).toBeTruthy()

    const file = jpg('selfie.jpg')
    fireEvent.change(uploadInput, { target: { files: [file] } })

    // Preview should now be shown
    expect(await screen.findByAltText('Uploaded selfie preview')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).not.toHaveBeenCalled()

    // Re-render 5 times to simulate parent re-renders or draft updates
    for (let i = 0; i < 5; i++) {
      rerender(<SelfieCaptureStep data={data} onBack={onBack} onNext={onNext} />)
    }

    // Assert a single create call across all 5 re-renders
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).not.toHaveBeenCalled()

    // Clicking "Change photo" resets the uploadFile, which should revoke the URL
    const changeBtn = screen.getByRole('button', { name: /Change photo/i })
    fireEvent.click(changeBtn)

    await waitFor(() => expect(revokeSpy).toHaveBeenCalledTimes(1))

    // Re-upload and unmount to assert unmount cleanup
    const secondInput = document.getElementById('sc-upload-input') as HTMLInputElement
    fireEvent.change(secondInput, { target: { files: [file] } })

    expect(await screen.findByAltText('Uploaded selfie preview')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledTimes(2)

    unmount()
    expect(revokeSpy).toHaveBeenCalledTimes(2)
  })
})
