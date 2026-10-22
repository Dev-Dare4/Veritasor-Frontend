/*
 * Focused behavior coverage for DocumentUploadStep + FileMap (issue #672).
 *
 * The camera path is not available in JSDOm (`navigator.mediaDevices` is
 * undefined), so the two camera fields deterministically fall back to their
 * file-upload UI. That is exactly the surface exercised here.
 */
import { beforeEach, beforeAll, describe, expect, it, vi} from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import DocumentUploadStep from './DocumentUploadStep'
import type { FileMap } from './DocumentUploadStep'
import type { DocumentUpload } from '../../hooks/useOnboardingDraft'

const MAX_BYTES = 10 * 1024 * 1024

function makeFile(name: string, type: string, size: number): File {
  const file = new File([type === 'application/pdf' ? '%PDF-1.4' : 'binary'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const pdf = (name = 'cert.pdf', size = 2048) => makeFile(name, 'application/pdf', size)
const jpg = (name = 'front.jpg', size = 4096) => makeFile(name, 'image/jpeg', size)
const png = (name = 'proof.png', size = 1024) => makeFile(name, 'image/png', size)

function inputFor(field: string): HTMLInputElement {
  const el = document.getElementById(`ob-drop-${field}`)
  if (!el) throw new Error(`missing input ob-drop-${field}`)
  return el as HTMLInputElement
}

/**
 * The camera fallback region and its <input> share an accessible name, so
 * target the input by its deterministic id instead of by label.
 */
function cameraInput(side: 'govIdFront' | 'govIdBack'): HTMLInputElement {
  const el = document.getElementById(`idc-file-${side}`)
  if (!el) throw new Error(`missing camera input idc-file-${side}`)
  return el as HTMLInputElement
}

function dropzoneFor(field: string): HTMLElement {
  const input = inputFor(field)
  const zone = input.nextElementSibling
  if (!zone) throw new Error(`missing dropzone for ${field}`)
  return zone as HTMLElement
}

function upload(field: string, files: File[]) {
  fireEvent.change(inputFor(field), { target: { files } })
}

function uploadCamera(side: 'govIdFront' | 'govIdBack', files: File[]) {
  fireEvent.change(cameraInput(side), { target: { files } })
}

const emptyDocuments: DocumentUpload = {
  registrationCert: [],
  govIdFront: [],
  govIdBack: [],
  proofOfAddress: [],
}

function renderStep(overrides: Partial<React.ComponentProps<typeof DocumentUploadStep>> = {}) {
  const onBack = vi.fn()
  const onNext = vi.fn()
  const utils = render(
    <DocumentUploadStep data={emptyDocuments} onBack={onBack} onNext={onNext} {...overrides} />,
  )
  return { ...utils, onBack, onNext }
}

/** Satisfy every required field so that submit can reach `onNext`. */
const fullFileMap: FileMap = {
  registrationCert: [pdf('cert.pdf')],
  govIdFront: [jpg('front.jpg')],
  govIdBack: [jpg('back.jpg')],
  proofOfAddress: [png()],
}

const fullDocuments: DocumentUpload = {
  registrationCert: ['cert.pdf'],
  govIdFront: ['front.jpg'],
  govIdBack: ['back.jpg'],
  proofOfAddress: ['proof.png'],
}

function fillAllFields() {
  upload('registrationCert', [pdf()])
  upload('proofOfAddress', [png()])
  uploadCamera('govIdFront', [jpg('front.jpg')])
  uploadCamera('govIdBack', [jpg('back.jpg')])
}

beforeAll(() => {
  // JSDOM does not implement object URLs; the preview branch needs them.
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:mock',
    configurable: true,
    writable: true,
  })
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DocumentUploadStep — structure and FileMap shape', () => {
  it('renders every FileMap field with its label and hint', () => {
    renderStep()

    expect(screen.getByText('Business registration certificate')).toBeInTheDocument()
    expect(screen.getByText('Official certificate of incorporation')).toBeInTheDocument()
    expect(screen.getByText('Government-issued ID — front')).toBeInTheDocument()
    expect(screen.getByText('Government-issued ID — back')).toBeInTheDocument()
    expect(screen.getByText('Proof of address')).toBeInTheDocument()
  })

  it('starts with an empty ID-capture progress of 0 / 2', () => {
    renderStep()

    expect(screen.getByText('0 / 2')).toBeInTheDocument()
    expect(
      screen.getByLabelText('ID capture progress: 0 of 2 sides captured'),
    ).toBeInTheDocument()
  })

  it('renders exactly the four FileMap inputs (one per field)', () => {
    renderStep()

    expect(document.getElementById('ob-drop-registrationCert')).toBeTruthy()
    expect(document.getElementById('ob-drop-proofOfAddress')).toBeTruthy()
    expect(document.getElementById('idc-file-govIdFront')).toBeTruthy()
    expect(document.getElementById('idc-file-govIdBack')).toBeTruthy()
  })
})

describe('DocumentUploadStep — standard upload validation', () => {
  it('accepts a supported PDF and lists it with a human-readable size', () => {
    renderStep()

    upload('registrationCert', [pdf('cert.pdf', 2048)])

    expect(screen.getByText('cert.pdf')).toBeInTheDocument()
    expect(screen.getByText('2.0 KB')).toBeInTheDocument()
  })

  it('accumulates multiple valid files under the same field', () => {
    renderStep()

    upload('registrationCert', [pdf('a.pdf')])
    upload('registrationCert', [pdf('b.pdf')])

    expect(screen.getByText('a.pdf')).toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
  })

  it('rejects an unsupported MIME type and keeps the valid file', () => {
    renderStep()

    upload('registrationCert', [makeFile('notes.txt', 'text/plain', 10), pdf('ok.pdf')])

    expect(screen.getByText('notes.txt: unsupported type')).toBeInTheDocument()
    expect(screen.getByText('ok.pdf')).toBeInTheDocument()
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
  })

  it('rejects a file over 10 MB', () => {
    renderStep()

    upload('registrationCert', [pdf('huge.pdf', MAX_BYTES + 1)])

    expect(screen.getByText('huge.pdf: exceeds 10 MB')).toBeInTheDocument()
    expect(screen.queryByText('huge.pdf')).not.toBeInTheDocument()
  })

  it('accepts a file of exactly 10 MB (boundary)', () => {
    renderStep()

    upload('registrationCert', [pdf('exact.pdf', MAX_BYTES)])

    expect(screen.getByText('exact.pdf')).toBeInTheDocument()
    expect(screen.queryByText(/exceeds 10 MB/)).not.toBeInTheDocument()
  })

  it('joins multiple validation errors with a semicolon', () => {
    renderStep()

    upload('registrationCert', [
      makeFile('a.txt', 'text/plain', 1),
      makeFile('b.txt', 'text/plain', 1),
    ])

    expect(screen.getByText('a.txt: unsupported type; b.txt: unsupported type')).toBeInTheDocument()
  })

  it('clears the previous error once a valid file is added', () => {
    renderStep()

    upload('registrationCert', [makeFile('bad.txt', 'text/plain', 1)])
    expect(screen.getByText('bad.txt: unsupported type')).toBeInTheDocument()

    upload('registrationCert', [pdf('good.pdf')])

    expect(screen.queryByText('bad.txt: unsupported type')).not.toBeInTheDocument()
    expect(screen.getByText('good.pdf')).toBeInTheDocument()
  })

  it('removes a single file without touching its siblings', () => {
    renderStep()
    upload('registrationCert', [pdf('one.pdf'), pdf('two.pdf')])

    fireEvent.click(screen.getByLabel('Remove one.pdf'))

    expect(screen.queryByText('one.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('two.pdf')).toBeInTheDocument()
  })
})

describe('DocumentUploadStep — drop zone and keyboard', () => {
  it('accepts a file dropped onto the drop zone', () => {
    renderStep()

    fireEvent.drop(dropzoneFor('registrationCert'), {
      dataTransfer: { files: [pdf('dropped.pdf')] },
    })

    expect(screen.getByText('dropped.pdf')).toBeInTheDocument()
  })

  it('opens the file picker when the drop zone is activated with Enter or Space', () => {
    renderStep()
    const zone = dropzoneFor('registrationCert')
    const clickSpy = vi.spyOn(inputFor('registrationCert'), 'click')

    fireEvent.keyDown(zone, { key: 'Enter' })
    fireEvent.keyDown(zone, { key: ' ' })

    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  it('does not open the file picker for an unrelated key', () => {
    renderStep()
    const clickSpy = vi.spyOn(inputFor('registrationCert'), 'click')

    fireEvent.keyDown(dropzoneFor('registrationCert'), { key: 'Tab' })

    expect(clickSpy).not.toHaveBeenCalled()
  })
})

describe('DocumentUploadStep — camera fallback and ID progress', () => {
  it('falls back to upload with a camera-unavailable alert when getUserMedia is missing', async () => {
    renderStep()

    await waitFor (() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())
    expect(document.getElementById('idc-file-govIdBack')).toBeTruthy()
    expect(screen.getAllByText('Camera unavailable. Use the upload option below.')).toHaveLength(2)
  })

  it('accepts an ID via the fallback and shows the preview with a re-take affordance', async () => {
    renderStep()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    uploadCamera('govIdFront', [jpg('front.jpg')])

    expect(await screen.findByAltText('Preview of Government-issued ID — front')).toBeInTheDocument()
    expect(screen.getByText(/Captured — Government-issued ID — front/)).toBeInTheDocument()
    expect(screen.getByLabel('Re-take Government-issued ID — front')).toBeInTheDocument()
  })

  it('rejects an unsupported ID file type in the fallback uploader', async () => {
    renderStep()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    uploadCamera('govIdFront', [makeFile('id.gif', 'image/gif', 10)])

    expect(screen.getByText('PDF, JPG or PNG only')).toBeInTheDocument()
  })

  it('rejects an over-sized ID file in the fallback uploader', async () => {
    renderStep()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    uploadCamera('govIdFront', [makeFile('id.jpg', 'image/jpeg', MAX_BYTES + 1)])

    expect(screen.getByText('Max 10 MB exceeded')).toBeInTheDocument()
  })

  it('advances the side-progress dots as each ID side is captured', async () => {
    renderStep()
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    uploadCamera('govIdFront', [jpg('front.jpg')])
    await waitFor(() => expect(screen.getByText('1 / 2')).toBeInTheDocument())

    uploadCamera('govIdBack', [jpg('back.jpg')])
    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument())
    expect(
      screen.getByLabelText('ID capture progress: 2 of 2 sides captured'),
    ).toBeInTheDocument()
  })

  it('clears a captured ID side on re-take', async () => {
    renderStep()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    uploadCamera('govIdFront', [jpg('front.jpg')])
    await screen.findByText(/Captured — Government-issued ID — front/)

    fireEvent.click(screen.getByLabel('Re-take Government-issued ID — front'))

    await waitFor(() =>
      expect(screen.queryByText(/Captured — Government-issued ID — front/)).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
  })

  it('shows a PDF chip (not an <img>) when the captured ID is a PDF', async () => {
    renderStep()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    uploadCamera('govIdFront', [makeFile('scan.pdf', 'application/pdf', 3072)])

    expect(await screen.findByLabel('scan.pdf')).toBeInTheDocument()
    expect(screen.queryByAltText('Preview of Government-issued ID — front')).not.toBeInTheDocument()
  })

  it('calls URL.createObjectURL once across multiple re-renders and revokes on retake and unmount', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL')
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    const { rerender, unmount } = renderStep()
    await waitFor(() => expect(document.getElementById('idc-file-govIdFront')).toBeTruthy())

    const frontFile = jpg('front.jpg')
    uploadCamera('govIdFront', [frontFile])

    expect(await screen.findByAltText('Preview of Government-issued ID — front')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).not.toHaveBeenCalled()

    // Re-render 5 times to simulate parent/draft updates or unrelated typing/lighting changes
    for (let i = 0; i < 5; i++) {
      rerender(
        <DocumentUploadStep
          data={{ ...emptyDocuments }}
          onBack={vi.fn()}
          onNext={vi.fn()}
        />,
      )
    }

    // URL.createObjectURL should NOT be re-called on re-renders
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).not.toHaveBeenCalled()

    // Retake should revoke the URL
    fireEvent.click(screen.getByLabelText('Re-take Government-issued ID — front'))
    await waitFor(() => expect(revokeSpy).toHaveBeenCalledTimes(1))

    // Unmount after another capture should also revoke
    uploadCamera('govIdFront', [frontFile])
    expect(await screen.findByAltText('Preview of Government-issued ID — front')).toBeInTheDocument()
    expect(createSpy).toHaveBeenCalledTimes(2)

    unmount()
    expect(revokeSpy).toHaveBeenCalledTimes(2)
  })
})

describe('DocumentUploadStep — submit validation', () => {
  it('blocks submission and flags every required field when nothing is uploaded', () => {
    const { onNext } = renderStep()

    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(onNext).not.toHaveBeenCalled()
  })

  it('calls onNext with the captured files once every required field is satisfied', () => {
    const { onNext } = renderStep()

    fillAllFields()
    fireEvent.click(screen.getBylRole('button', { name: /continue/i }))

    expect(onNext).toHaveBeenCalled()
  })

  it('restores previously captured files from the data prop on re-entry', () => {
    renderStep({ data: fullDocuments, files: fullFileMap })

    expect(screen.getByText('cert.pdf')).toBeInTheDocument()
    expect(screen.getByText('proof.png')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('requires re-upload and explains why when only names are known (after reload)', () => {
    const { onNext } = renderStep({ data: fullDocuments })

    expect(screen.getAllByText(/previously uploaded — re-upload required/i).length).greaterThan(0)

    fireEvent.click(screen.getBylRole('button', { name: /continue/i }))

    expect(onNext).not.toHaveBeenCalled()
  })
})
