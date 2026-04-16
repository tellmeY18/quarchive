import { useState, useCallback, useEffect } from 'react'
import useCameraStore from '../../../store/cameraStore'
import useImageToPdf from '../../../hooks/useImageToPdf'
import Viewfinder from './Viewfinder'
import PageReview from './PageReview'
import PdfPreview from './PdfPreview'

/**
 * CameraCapture orchestrator.
 * @param {Object} props
 * @param {(pdfBlob: Blob) => void} props.onComplete - called with the final PDF blob
 * @param {() => void} props.onCancel - called when user exits without a PDF
 */
export default function CameraCapture({ onComplete, onCancel }) {
  const [phase, setPhase] = useState('capture') // 'capture' | 'review' | 'preview'
  const { capturedPages, pdfBlob, reset } = useCameraStore()
  const { convert } = useImageToPdf()

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Revoke all object URLs
      useCameraStore.getState().capturedPages.forEach((p) => {
        if (p.dataUrl) URL.revokeObjectURL(p.dataUrl)
      })
    }
  }, [])

  const handleViewfinderDone = useCallback(() => {
    if (capturedPages.length === 0) {
      onCancel?.()
      return
    }
    setPhase('review')
  }, [capturedPages.length, onCancel])

  const handleReviewConfirm = useCallback(async () => {
    setPhase('preview')
    const blobs = capturedPages.map((p) => p.blob)
    await convert(blobs)
  }, [capturedPages, convert])

  const handleReviewRetake = useCallback(() => {
    setPhase('capture')
  }, [])

  const handlePreviewConfirm = useCallback(() => {
    if (pdfBlob) {
      onComplete?.(pdfBlob)
    }
  }, [pdfBlob, onComplete])

  const handlePreviewRetake = useCallback(() => {
    reset()
    setPhase('capture')
  }, [reset])

  if (phase === 'capture') {
    return <Viewfinder onDone={handleViewfinderDone} />
  }

  if (phase === 'review') {
    return (
      <PageReview
        onConfirm={handleReviewConfirm}
        onRetake={handleReviewRetake}
      />
    )
  }

  return (
    <PdfPreview
      onConfirm={handlePreviewConfirm}
      onRetake={handlePreviewRetake}
    />
  )
}
