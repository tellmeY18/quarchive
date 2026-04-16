import { useRef, useCallback, useEffect } from 'react'
import useCameraStore from '../store/cameraStore'

export default function useCamera() {
  const streamRef = useRef(null)
  const videoRef = useRef(null)

  const setCameraError = useCameraStore((s) => s.setCameraError)

  const startCamera = useCallback(
    async (videoElement) => {
      videoRef.current = videoElement

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        streamRef.current = stream
        if (videoElement) {
          videoElement.srcObject = stream
        }
        setCameraError(null)
        return stream
      } catch (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError('permission_denied')
        } else {
          setCameraError('not_supported')
        }
        throw err
      }
    },
    [setCameraError],
  )

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0)

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92)
    })
  }, [])

  const toggleTorch = useCallback(async (on) => {
    const stream = streamRef.current
    if (!stream) return false

    const track = stream.getVideoTracks()[0]
    if (!track) return false

    try {
      await track.applyConstraints({ advanced: [{ torch: on }] })
      return true
    } catch {
      return false
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Always stop on unmount — invariant from CLAUDE.md
  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  return { startCamera, captureFrame, toggleTorch, stopCamera }
}
