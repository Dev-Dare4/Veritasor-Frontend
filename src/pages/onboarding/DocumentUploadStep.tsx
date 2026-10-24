/**
 * DocumentUploadStep — Issue #228
 *
 * KYC ID document capture screen with:
 * - Rectangular edge-detection overlay (canvas) for govId front/back
 * - Glare / brightness warning (mirrors SelfieCaptureStep pattern)
 * - Front / back sequencing with per-side progress dots
 * - Preview-before-submit with re-take affordance
 * - Standard file-upload fallback for non-camera flows
 * - WCAG 2.1 AA: roles, live regions, focus management, 44 px touch targets
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DocumentUpload } from '../../hooks/useOnboardingDraft'
import { useObjectUrl } from '../../hooks/useObjectUrl'

// ─── Public types ──────────────────────────────────────────────────────────────

export type FileMap = {
  registrationCert: File[]
  govIdFront: File[]
  govIdBack: File[]
  proofOfAddress: File[]
}

type DocField = keyof FileMap

type Props = {
  data: DocumentUpload
  onBack: () => void
  onNext: (data: DocumentUpload, files: FileMap) => void
  rejections?: Partial<Record<DocField, { reason: string }>>
  files?: FileMap
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const ACCEPT = '.pdf,.jpg,.jpeg,.png'
const MAX_MB = 10
const MAX_BYTES = MAX_MB * 1024 * 1024

/** Fields that use the camera-capture flow (govId front + back) */
const CAMERA_FIELDS = new Set<DocField>(['govIdFront', 'govIdBack'])

/** Ordered field definitions */
const FIELDS: {
  key: DocField
  label: string
  hint: string
  required: boolean
  multiple: boolean
  cameraLabel?: string
}[] = [
  {
    key: 'registrationCert',
    label: 'Business registration certificate',
    hint: 'Official certificate of incorporation',
    required: true,
    multiple: false,
  },
  {
    key: 'govIdFront',
    label: 'Government-issued ID — front',
    hint: "Passport, national ID, or driver's licence (front)",
    required: true,
    multiple: false,
    cameraLabel: 'Front side',
  },
  {
    key: 'govIdBack',
    label: 'Government-issued ID — back',
    hint: 'Back side of the same document',
    required: true,
    multiple: false,
    cameraLabel: 'Back side',
  },
  {
    key: 'proofOfAddress',
    label: 'Proof of address',
    hint: 'Utility bill or bank statement dated within 3 months',
    required: true,
    multiple: false,
  },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function analyzeGlare(canvas: HTMLCanvasElement, video: HTMLVideoElement): 'good' | 'glare' | 'dark' {
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'good'
  canvas.width = video.videoWidth || 640
  canvas.height = video.videoHeight || 360
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

  // Sample the rectangular guide region (central 80 % × 60 %)
  const rx = canvas.width * 0.1
  const ry = canvas.height * 0.2
  const rw = canvas.width * 0.8
  const rh = canvas.height * 0.6
  const imgData = ctx.getImageData(rx, ry, rw, rh)
  const d = imgData.data
  let total = 0
  let glarePixels = 0
  const count = d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    const brightness = (d[i] + d[i + 1] + d[i + 2]) / 3
    total += brightness
    if (brightness > 230) glarePixels++
  }
  const avg = total / count
  if (glarePixels / count > 0.08) return 'glare'
  if (avg < 55) return 'dark'
  return 'good'
}

// ─── ID Capture sub-component ──────────────────────────────────────────────────

type IdSide = 'front' | 'back'

interface IdCaptureProps {
  fieldKey: DocField
  label: string
  hint: string
  capturedFile: File | null
  onCapture: (file: File) => void
  onRetake: () => void
}

function IdCaptureCard({ fieldKey, label, hint, capturedFile, onCapture, onRetake }: IdCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const animRef = useRef<number | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [glare, setGlare] = useState<'good' | 'glare' | 'dark' | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null }
    stream?.getTracks().forEach(t => t.stop())
    setStream(null)
  }, [stream])

  const analyzeLoop = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const result = analyzeGlare(canvasRef.current, videoRef.current)
    setGlare(result)
    animRef.current = requestAnimationFrame(analyzeLoop)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      setStream(ms)
      if (videoRef.current) {
        videoRef.current.srcObject = ms
        await videoRef.current.play()
        analyzeLoop()
      }
    } catch {
      setCameraError('Camera unavailable. Use the upload option below.')
      setShowUpload(true)
    }
  }, [analyzeLoop])

  // Auto-start camera when no file captured yet
  useEffect(() => {
    if (!capturedFile && !showUpload) { startCamera() }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      stream?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], `id-${fieldKey}-${Date.now()}.jpg`, { type: 'image/jpeg' })
        stopCamera()
        onCapture(file)
      }
    }, 'image/jpeg', 0.92)
  }, [fieldKey, onCapture, stopCamera])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) {
      setFileError('PDF, JPG or PNG only')
      return
    }
    if (f.size > MAX_BYTES) {
      setFileError(`Max ${MAX_MB} MB exceeded`)
      return
    }
    setFileError(null)
    stopCamera()
    onCapture(f)
  }, [onCapture, stopCamera])

  const handleRetake = useCallback(() => {
    onRetake()
    setShowUpload(false)
    setGlare(null)
    startCamera()
  }, [onRetake, startCamera])

  const isImage = capturedFile?.type.startsWith('image/') ?? false
  const previewUrl = useObjectUrl(isImage ? capturedFile : null)

  // ── Preview state ──────────────────────────────────────────────────────────
  if (capturedFile) {
    return (
      <div className="idc-preview" role="region" aria-label={`${label} preview`}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={`Preview of ${label}`}
            className="idc-preview-img"
          />
        ) : (
          <div className="idc-preview-pdf" aria-label={capturedFile.name}>
            <span aria-hidden="true" className="idc-preview-pdf-icon">📄</span>
            <span className="idc-preview-pdf-name">{capturedFile.name}</span>
            <span className="idc-preview-pdf-size">{formatBytes(capturedFile.size)}</span>
          </div>
        )}
        <p className="idc-preview-check" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span> Captured — {label}
        </p>
        <button
          type="button"
          className="ob-btn ob-btn-secondary idc-retake-btn"
          onClick={handleRetake}
          aria-label={`Re-take ${label}`}
        >
          ↩ Re-take
        </button>
      </div>
    )
  }

  // ── Upload fallback ────────────────────────────────────────────────────────
  if (showUpload) {
    return (
      <div className="idc-upload-fallback" role="region" aria-label={`Upload ${label}`}>
        {cameraError && (
          <p className="idc-warning idc-warning-error" role="alert">{cameraError}</p>
        )}
        <p className="idc-hint">{hint}</p>
        <input
          ref={fileInputRef}
          id={`idc-file-${fieldKey}`}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          aria-label={`Upload ${label}`}
          onChange={handleFileChange}
        />
        <label htmlFor={`idc-file-${fieldKey}`} className="ob-btn ob-btn-secondary idc-upload-label">
          Choose file
        </label>
        {fileError && <p className="idc-warning idc-warning-error" role="alert">{fileError}</p>}
        {!cameraError && (
          <button
            type="button"
            className="ob-btn-link"
            onClick={() => { setShowUpload(false); startCamera() }}
          >
            Try camera instead
          </button>
        )}
      </div>
    )
  }

  // ── Camera viewfinder ──────────────────────────────────────────────────────
  return (
    <div className="idc-viewfinder" role="region" aria-label={`Camera viewfinder for ${label}`}>
      {/* Live video */}
      <video
        ref={videoRef}
        className="idc-video"
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />
      {/* Hidden canvas for glare analysis */}
      <canvas ref={canvasRef} className="idc-hidden-canvas" aria-hidden="true" />

      {/* Rectangular edge-detection overlay */}
      <div className="idc-rect-overlay" aria-hidden="true">
        {/* Corner brackets */}
        <span className="idc-corner idc-corner-tl" />
        <span className="idc-corner idc-corner-tr" />
        <span className="idc-corner idc-corner-bl" />
        <span className="idc-corner idc-corner-br" />
        <span className="idc-overlay-label">{hint}</span>
      </div>

      {/* Glare / lighting status */}
      {glare && glare !== 'good' && (
        <div
          className={`idc-glare-warning idc-glare-${glare}`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          {glare === 'glare' ? (
            <><span aria-hidden="true">☀</span> Glare detected — reduce direct light</>
          ) : (
            <><span aria-hidden="true">◐</span> Low light — move to a brighter area</>
          )}
        </div>
      )}
      {glare === 'good' && (
        <div className="idc-glare-ok" role="status" aria-live="polite" aria-atomic="true">
          <span aria-hidden="true">✦</span> Good lighting
        </div>
      )}

      {/* Capture button */}
      <div className="idc-capture-row">
        <button
          type="button"
          className="sc-capture-btn"
          onClick={captureFrame}
          aria-label={`Capture ${label}`}
          disabled={!videoRef.current?.videoWidth}
        >
          <span className="sc-capture-btn-ring" aria-hidden="true" />
        </button>
      </div>

      {/* Escape hatch */}
      <button
        type="button"
        className="ob-btn-link idc-upload-link"
        onClick={() => { stopCamera(); setShowUpload(true) }}
      >
        Upload file instead
      </button>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DocumentUploadStep({ data, onBack, onNext, rejections, files: initialFiles }: Props) {
  const [files, setFiles] = useState<FileMap>(() => ({
    registrationCert: initialFiles?.registrationCert ?? [],
    govIdFront: initialFiles?.govIdFront ?? [],
    govIdBack: initialFiles?.govIdBack ?? [],
    proofOfAddress: initialFiles?.proofOfAddress ?? [],
  }))

  // Sync wizard-level files back into local state on re-entry (Back navigation).
  // The wizard lifts captured File objects into a ref and passes them back here;
  // if the step stays mounted across navigation, the initializer above won't
  // re-run, so mirror the prop into state whenever it changes.
  useEffect(() => {
    if (!initialFiles) return
    setFiles({
      registrationCert: initialFiles.registrationCert ?? [],
      govIdFront: initialFiles.govIdFront ?? [],
      govIdBack: initialFiles.govIdBack ?? [],
      proofOfAddress: initialFiles.proofOfAddress ?? [],
    })
  }, [initialFiles])

  // Names remembered by the wizard (survive Back navigation and reloads).
  // When a name exists but no File object is in memory (e.g. after a reload),
  // the requirement is treated as unmet and the user is told to re-upload.
  const knownNames: Record<DocField, string[]> = {
    registrationCert: data?.registrationCert ?? [],
    govIdFront: data?.govIdFront ?? [],
    govIdBack: data?.govIdBack ?? [],
    proofOfAddress: data?.proofOfAddress ?? [],
  }

  const hasStaleFile = useCallback(
    (field: DocField) => files[field].length === 0 && knownNames[field].length > 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, data],
  )

  const [errors, setErrors] = useState<Partial<Record<DocField, string>>>({})
  const [dragOver, setDragOver] = useState<DocField | null>(null)
  const inputRefs = useRef<Partial<Record<DocField, HTMLInputElement>>>({})

  // ── Standard upload helpers (non-camera fields) ──────────────────────────

  function addFiles(field: DocField, incoming: FileList | null) {
    if (!incoming) return
    const valid: File[] = []
    const fieldErrors: string[] = []
    Array.from(incoming).forEach(f => {
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(f.type)) {
        fieldErrors.push(`${f.name}: unsupported type`)
        return
      }
      if (f.size > MAX_BYTES) {
        fieldErrors.push(`${f.name}: exceeds ${MAX_MB} MB`)
        return
      }
      valid.push(f)
    })
    setFiles(prev => ({ ...prev, [field]: [...prev[field], ...valid] }))
    setErrors(prev => ({ ...prev, [field]: fieldErrors.length ? fieldErrors.join('; ') : undefined }))
  }

  function removeFile(field: DocField, index: number) {
    setFiles(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }))
  }

  // ── Camera capture helpers ───────────────────────────────────────────────

  const handleIdCapture = useCallback((field: DocField, file: File) => {
    setFiles(prev => ({ ...prev, [field]: [file] }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }, [])

  const handleIdRetake = useCallback((field: DocField) => {
    setFiles(prev => ({ ...prev, [field]: [] }))
  }, [])

  // ── govId side dots: 0 = none, 1 = front done, 2 = both done ────────────
  const govIdProgress = (files.govIdFront.length > 0 ? 1 : 0) + (files.govIdBack.length > 0 ? 1 : 0)

  // ── Submit ───────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs: Partial<Record<DocField, string>> = {}
    FIELDS.forEach(({ key, required }) => {
      if (required && files[key].length === 0) errs[key] = 'This document is required — please re-upload'
    })
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    const names: DocumentUpload = {
      registrationCert: files.registrationCert.map(f => f.name),
      govIdFront: files.govIdFront.map(f => f.name),
      govIdBack: files.govIdBack.map(f => f.name),
      proofOfAddress: files.proofOfAddress.map(f => f.name),
    }
    onNext(names, files)
  }

  return (
    <form className="ob-form" onSubmit={handleSubmit} noValidate aria-label="Document upload">

      {/* ── govId side-progress ─────────────────────────────────────────── */}
      <div className="idc-side-progress" aria-label={`ID capture progress: ${govIdProgress} of 2 sides captured`}>
        <span className="idc-side-progress-label">ID capture</span>
        <div className="idc-side-dots" role="list" aria-hidden="true">
          {(['front', 'back'] as IdSide[]).map((side, i) => (
            <span
              key={side}
              role="listitem"
              className={`idc-side-dot${(i === 0 ? files.govIdFront : files.govIdBack).length > 0 ? ' idc-side-dot-done' : ''}`}
              title={`${side === 'front' ? 'Front' : 'Back'} side`}
            />
          ))}
        </div>
        <span className="idc-side-progress-count" aria-live="polite">{govIdProgress} / 2</span>
      </div>

      {FIELDS.map(({ key, label, hint, required }) => {
        const isCamera = CAMERA_FIELDS.has(key)
        const capturedFile = isCamera ? (files[key][0] ?? null) : null

        return (
          <div key={key} className="ob-field">
            <label
              className={`ob-label${required ? ' ob-label-required' : ''}`}
              htmlFor={isCamera ? undefined : `ob-drop-${key}`}
              id={`doc-label-${key}`}
            >
              {label}
            </label>
            <span className="ob-hint" id={`doc-hint-${key}`}>{hint}</span>

            {/* ── Stale-file notice (names known, File objects lost) ────── */}
            {hasStaleFile(key) && (
              <p className="ob-hint ob-stale-notice" role="status" aria-live="polite">
                <span aria-hidden="true">↻</span>{' '}
                Previously uploaded: <strong>{knownNames[key].join(', ')}</strong> — re-upload required.
              </p>
            )}

            {/* ── Rejection card ───────────────────────────────────────── */}
            {rejections?.[key] && files[key].length === 0 ? (
              <div
                className="ob-rejection-card"
                role="alert"
                style={{
                  background: 'var(--danger-soft)',
                  border: '1px solid var(--danger)',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  marginTop: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" aria-hidden="true" style={{ marginTop: '0.1rem', flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <div>
                    <h3 style={{ color: 'var(--danger)', margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Action Required</h3>
                    <p style={{ margin: '0 0 1rem', color: 'var(--text)', fontSize: '0.95rem' }}>
                      <strong>Reason:</strong> {rejections[key]!.reason}
                    </p>
                    {isCamera ? (
                      <button
                        type="button"
                        className="ob-btn ob-btn-secondary"
                        onClick={() => handleIdRetake(key)}
                      >
                        Re-capture document
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ob-btn ob-btn-secondary"
                        onClick={() => inputRefs.current[key]?.click()}
                      >
                        Re-upload document
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : isCamera ? (
              /* ── Camera capture card ─────────────────────────────────── */
              <IdCaptureCard
                fieldKey={key}
                label={label}
                hint={hint}
                capturedFile={capturedFile}
                onCapture={file => handleIdCapture(key, file)}
                onRetake={() => handleIdRetake(key)}
              />
            ) : (
              /* ── Standard drop-zone ──────────────────────────────────── */
              <>
                <input
                  ref={el => { if (el) inputRefs.current[key] = el }}
                  id={`ob-drop-${key}`}
                  type="file"
                  accept={ACCEPT}
                  style={{ display: 'none' }}
                  aria-labelledby={`doc-label-${key}`}
                  aria-describedby={`doc-hint-${key}`}
                  onChange={e => addFiles(key, e.target.files)}
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-labelledby={`doc-label-${key}`}
                  aria-describedby={`doc-hint-${key}`}
                  className={`ob-dropzone${dragOver === key ? ' ob-dropzone-active' : ''}`}
                  onClick={() => inputRefs.current[key]?.click()}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRefs.current[key]?.click() } }}
                  onDragOver={e => { e.preventDefault(); setDragOver(key) }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => { e.preventDefault(); setDragOver(null); addFiles(key, e.dataTransfer.files) }}
                >
                  <span className="ob-dropzone-icon" aria-hidden="true">📎</span>
                  <span className="ob-dropzone-label"><strong>Click to upload</strong> or drag and drop</span>
                  <span className="ob-dropzone-meta">PDF, JPG, PNG · max {MAX_MB} MB</span>
                </div>
              </>
            )}

            {/* ── File list (all fields) ────────────────────────────────── */}
            {files[key].length > 0 && !isCamera && (
              <ul className="ob-file-list" aria-label={`Uploaded files for ${label}`}>
                {files[key].map((f, i) => (
                  <li key={i} className="ob-file-item">
                    <span className="ob-file-name">{f.name}</span>
                    <span className="ob-file-size">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      className="ob-file-remove"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => removeFile(key, i)}
                    >×</button>
                  </li>
                ))}
              </ul>
            )}

            {errors[key] && (
              <span className="ob-error" role="alert">{errors[key]}</span>
            )}

            {/* ── Stale-file error (submit attempted without re-upload) ─── */}
            {hasStaleFile(key) && errors[key] && (
              <span className="ob-error" role="alert">
                {errors[key]}
              </span>
            )}
          </div>
        )
      })}

      <div className="ob-actions">
        <button type="button" className="ob-btn ob-btn-secondary" onClick={onBack}>← Back</button>
        <button type="submit" className="ob-btn ob-btn-primary">Continue →</button>
      </div>
    </form>
  )
}
