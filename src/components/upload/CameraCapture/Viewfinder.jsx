import { useRef, useEffect, useState, useCallback } from 'react'
import useCamera from '../../../hooks/useCamera'
import useCameraStore from '../../../store/cameraStore'

export default function Viewfinder({ onDone }) {
  const videoRef = useRef(null)
  const { startCamera, captureFrame, toggleTorch, stopCamera } = useCamera()
  const { capturedPages, addPage } = useCameraStore()
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const stream = await startCamera(videoRef.current)
        if (cancelled) return
        // Check torch support
        const track = stream?.getVideoTracks()[0]
        const caps = track?.getCapabilities?.()
        if (caps?.torch) setTorchSupported(true)
      } catch {
        // Error handled by cameraStore
      }
    }

    init()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [startCamera, stopCamera])

  const handleCapture = useCallback(async () => {
    if (capturing) return
    setCapturing(true)
    try {
      const blob = await captureFrame()
      if (blob) {
        const dataUrl = URL.createObjectURL(blob)
        addPage({
          id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
          blob,
          dataUrl,
          timestamp: Date.now(),
        })
      }
    } finally {
      setCapturing(false)
    }
  }, [capturing, captureFrame, addPage])

  const handleTorch = useCallback(async () => {
    const next = !torchOn
    const ok = await toggleTorch(next)
    if (ok) setTorchOn(next)
  }, [torchOn, toggleTorch])

  const handleDone = useCallback(() => {
    stopCamera()
    onDone?.()
  }, [stopCamera, onDone])

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 text-white z-10">
        <button
          type="button"
          onClick={handleDone}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center"
          aria-label="Close camera"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-sm font-medium">Scan Question Paper</span>
        {torchSupported ? (
          <button
            type="button"
            onClick={handleTorch}
            className="min-h-[48px] min-w-[48px] flex items-center justify-center"
            aria-label={torchOn ? 'Turn off flash' : 'Turn on flash'}
          >
            <svg className={`h-6 w-6 ${torchOn ? 'text-yellow-400' : 'text-white/60'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </button>
        ) : (
          <div className="w-12" />
        )}
      </div>

      {/* Video feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Guide overlay */}
        <div className="absolute inset-8 border-2 border-white/30 rounded-lg pointer-events-none" />
        <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 text-sm font-medium pointer-events-none">
          Position paper in frame
        </p>
      </div>

      {/* Thumbnail tray */}
      {capturedPages.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-black/60 overflow-x-auto scrollbar-hide">
          {capturedPages.map((page, i) => (
            <img
              key={page.id}
              src={page.dataUrl}
              alt={`Page ${i + 1}`}
              className="h-12 w-9 object-cover rounded border border-white/30 flex-shrink-0"
            />
          ))}
          <span className="text-white/60 text-xs ml-1 whitespace-nowrap">
            {capturedPages.length} page{capturedPages.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/80">
        <div className="w-20" />

        {/* Shutter button */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={capturing}
          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50"
          aria-label="Capture page"
        >
          <div className={`w-12 h-12 rounded-full bg-white ${capturing ? 'scale-90' : ''} transition-transform`} />
        </button>

        {/* Done button */}
        {capturedPages.length > 0 ? (
          <button
            type="button"
            onClick={handleDone}
            className="min-w-[80px] min-h-[48px] bg-pyqp-accent text-white text-sm font-semibold rounded-lg px-4 py-2"
          >
            Done ({capturedPages.length})
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  )
}
