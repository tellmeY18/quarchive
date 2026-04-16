import { useCallback } from 'react'
import useCameraStore from '../store/cameraStore'

export default function useImageToPdf() {
  const setConverting = useCameraStore((s) => s.setConverting)
  const setConvertProgress = useCameraStore((s) => s.setConvertProgress)
  const setPdfBlob = useCameraStore((s) => s.setPdfBlob)

  const convert = useCallback(
    async (imageBlobs) => {
      setConverting(true)
      setConvertProgress(0)

      try {
        const { imagesToPdf } = await import('../lib/imageToPdf')
        const blob = await imagesToPdf(imageBlobs, (progress) => {
          setConvertProgress(progress)
        })
        setPdfBlob(blob)
        return blob
      } finally {
        setConverting(false)
      }
    },
    [setConverting, setConvertProgress, setPdfBlob],
  )

  return { convert }
}
