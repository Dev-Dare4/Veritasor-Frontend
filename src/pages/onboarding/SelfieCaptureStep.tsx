import { useRef, useState, useCallback } from 'react'
import type { SelfieCapture } from '../../hooks/useOnboardingDraft'

type Props = {
  data: SelfieCapture
  file?: File | null
  onBack: () => void
  onNext: (data: SelfieCapture, file: File | null) => void
}

const OVAL_WIDTH_RATIO = 0.72
const OVAL_HEIGHT_RATIO = 0.58
const OVAL_TOP_RATIO = 0.2

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} `
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function SelfieCaptureStep({ data, file, onBack, onNext }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(file ?? null)
  const [error, setError] = useState<string | null>(null)
  const [lighting, setLighting] = useState<'good' | 'low' | 'bright' | null>(null)
  const [showUpload, setShowUpload] = useState(file ? false : false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const animationRef = useRef<number | null>(null)

  const analyzeLighting = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const ovalX = canvas.width * (1 - OVAL_WIDTH_RATIO) / 2
    const ovalY = canvas.height * OVAL_TOP_RATIO
    const ovalW = canvas.width * OVAL_WIDTH_RATIO
    const ovalH = canvas.height * OVAL_HEIGHT_RATIO

    const imageData = ctx.getImageData(ovalX, ovalY, ovalW, ovalH)
    const data = imageData.data
    let totalBrightness = 0
    let pixelCount = 0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      totalBrightness += (r + g + b) / 3
      pixelCount++
    }

    const avgBrightness = pixelCount > 0 ? totalBrightness / pixelCount : 0

    if (avgBrightness < 60) {
      setLighting('low')
    } else if (avgBrightness > 200) {
      setLighting('bright')
    } else {
      setLighting('good')
    }

    animationRef.current = requestAnimationFrame(analyzeLighting)
  }, [videoRef, canvasRef])

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: {ideal: 720 } },
        audio: false,
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        await videoRef.current.play()
        analyzeLighting()
      }
      setError(null)
    } catch (err) {
      console.error('Camera access denied:', err)
      setError('Unable to access camera. Please use the upload option below.')
      setShowUpload(true)
    }
  }, [analyzeLighting])

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [stream])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const ovalX = canvas.width * (1 - OVAL_WIDTH_RATIO) / 2
    const ovalY = canvas.height * OVAL_TOP_RATIO
    const ovalW = canvas.width * OVAL_WIDTH_RATIO
    const ovalH = canvas.height * OVAL_HEIGHT_RATIO

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = ovalW
    outputCanvas.height = ovalH
    const octx = outputCanvas.getContext('2d')
    if (!octx) return

    octx.drawImage(canvas, ovalX, ovalY, ovalW, ovalH, 0, 0, ovalW, ovalH)

    outputCanvas.toBlob(
      blob => {
        if (blob) {
          const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: 'image/jpeg' })
          setCapturedFile(file)
          stopCamera()
        }
      },
      'image/jpeg',
      0.9
    )
  }, [stopCamera])

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!['image/jpeg', 'image/png'].includes(file.type)) {
        setError('Please upload a JPG or PNG image')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10 MB')
        return
      }
      setUploadFile(file)
      setShowUpload(false)
      setError(null)
    },
    []
  )

  const retake = useCallback(() => {
    setCapturedFile(null)
    setUploadFile(null)
    setLighting(null)
    startCamera()
  }, [startCamera])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!capturedFile && !uploadFile) {
        setError('Please capture a selfie or upload a photo')
        return
      }
      const file = capturedFile || uploadFile
      onNext({ captured: true, fileName: file?.name ?? '' }, file)
    },
    [capturedFile, uploadFile, onNext]
  )

  const handleBack = useCallback(() => {
    stopCamera()
    onBack()
  }, [stopCamera, onBack])

  if (showUpload) {
    return (
      <form className="ob-form" onSubmit={handleSubmit} noValidate aria-label="Selfie verification">
        <div className="sc-upload-fallback" role="region" aria-label="Upload photo fallback">
          <h3 className="sc-fallback-heading">Upload a photo instead</h3>
          <p className="sc-fallback-desc">
            Position your face clearly in the frame. Ensure good lighting and a neutral expression.
          </p>
          <input
            id="sc-upload-input"
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleUpload}
            style={{ display: 'none' }}
            aria-label="Upload selfie photo"
          />
          <label htmlFor="sc-upload-input" className="ob-btn ob-btn-secondary" style={{ cursor: 'pointer' }}>
            Choose file
          </label>
          {uploadFile && <p className="sc-fallback-file">{uploadFile.name} · {formatBytes(uploadFile.size)}</p>}
          {error && <p className="sc-placeholder-error" role="alert">{error}</p>}
          <div className="ob-actions">
            <button type="button" className="ob-btn ob-btn-secondary" onClick={() => { setShowUpload(false); startCamera() }}>
              Try camera again
            </button>
            <button type="submit" className="ob-btn ob-btn-primary" disabled={!uploadFile}>
              Continue →
            </button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <form className="ob-form" onSubmit={handleSubmit} noValidate aria-label="Selfie verification">
      <div className="sc-viewfinder-wrap" role="region" aria-label="Camera viewfinder">
        {!stream && !capturedFile && !uploadFile ? (
          <div className="sc-placeholder">
            <span className="sc-placeholder-icon" aria-hidden="true">🷵</span>
            <p>Starting camera…</p>
          </div>
        ) : null}

        {error && !stream && (
          <div className="sc-placeholder sc-placeholder-error" role="alert">
            <span className="sc-placeholder-icon" aria-hidden="true">⚠</span>
            <p>{error}</p>
            <button type="button" className="ob-btn ob-btn-secondary" onClick={() => setShowUpload(true)}>
              Upload photo instead
            </button>
          </div>
        )}

        {stream && (
          <div className="sc-camera-container">
            <video
              ref={videoRef}
              className="sc-video"
              autoPlay
              playsInline
              muted
              aria-hidden="true"
            />
            <canvas ref={canvasRef} className="sc-hidden-canvas" aria-hidden="true" />
            <canvas
              ref={overlayRef}
              className="sc-oval-overlay"
              aria-hidden="true"
            />
            <div className={`sc-lighting ${lighting ? `sc-lighting-${lighting}` : ''}`} aria-live="polite" aria-atomic="true">
              {lighting === 'good' && (
                <>
                  <span className="sc-lighting-icon" aria-hidden="true">⬻</span>
                  <span>Good lighting</span>
                </>
              )}
              {lighting === 'low' && (
                <>
                  <span className="sc-lighting-icon" aria-hidden="true">◐</span>
                  <span>Low light — move to a brighter area</span>
                </>
              )}
              {lighting === 'bright' && (
                <>
                  <span className="sc-lighting-icon" aria-hidden="true">☀</span>
                  <span>Too bright — avoid direct light</span>
                </>
              )}
            </div>
            <div className="sc-capture-actions">
              <button
                type="button"
                className="sc-capture-btn"
                onClick={capturePhoto}
                aria-label="Capture selfie"
                disabled={!videoRef.current?.videoWidth}
              >
                <span className="sc-capture-btn-ring" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {capturedFile && (
          <div className="sc-preview-container">
            <img
              src={URL.createObjectURL(capturedFile)}
              alt="Captured selfie preview"
              className="sc-preview-img"
            />
            <p className="sc-preview-hint">Selfie captured ✓</p>
            <div className="sc-preview-actions">
              <button type="button" className="sc-switch-btn" onClick={retake}>
                Retake
              </button>
            </div>
          </div>
        )}

        {uploadFile && (
          <div className="sc-preview-container">
            <img
              src={URL.createObjectURL((uploadFile))}
              alt="Uploaded selfie preview"
              className="sc-preview-img"
            />
            <p className="sc-preview-hint">Photo uploaded ✓</p>
            <div className="sc-preview-actions">
              <button type="button" className="sc-switch-btn" onClick={() => { setUploadFile(null); setShowUpload(true) }}>
                Change photo
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sc-placeholder" style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button
          type="button"
          className="ob-btn-link sc-switch-btn"
          onClick={() => setShowUpload(true)}
        >
          Upload photo instead
        </button>
      </div>

      <div className="ob-actions">
        <button type="button" className="ob-btn ob-btn-secondary" onClick={handleBack}>
          ← Back
        </button>
        <button type="submit" className="ob-btn ob-btn-primary" disabled={!capturedFile && !uploadFile}>
          Continue →
        </button>
      </div>
    </form>
  )
}
