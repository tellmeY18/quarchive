import { useCallback } from 'react'
import useAuthStore from '../store/authStore'
import useWizardStore from '../store/wizardStore'
import { buildMetaHeaders } from '../lib/metadata'

/**
 * Upload orchestration hook.
 *
 * Reads auth credentials and wizard state, builds the upload payload,
 * POSTs to the Cloudflare Worker proxy, and updates wizard status.
 *
 * @returns {{ startUpload: () => Promise<void> }}
 */
export default function useUpload() {
  const startUpload = useCallback(async () => {
    const { accessKey, secretKey } = useAuthStore.getState()
    const { file, fileHash, identifier, metadata } = useWizardStore.getState()
    const { setUploadStatus, setUploadError } = useWizardStore.getState()

    setUploadStatus('uploading')
    setUploadError(null)

    try {
      // Build Archive.org metadata from wizard state
      const meta = buildMetaHeaders(metadata, fileHash)

      // Assemble FormData payload for the Worker proxy
      const formData = new FormData()
      formData.append('accessKey', accessKey)
      formData.append('secretKey', secretKey)
      formData.append('identifier', identifier)
      formData.append('file', file)
      formData.append('meta', JSON.stringify(meta))

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        setUploadStatus('success')
        return
      }

      // Map HTTP status to specific error codes
      if (res.status === 401) {
        setUploadError('session_expired')
      } else if (res.status === 503) {
        setUploadError('slow_down')
      } else {
        setUploadError('rejected')
      }
      setUploadStatus('error')
    } catch {
      // Network failure — fetch itself threw (offline, DNS, etc.)
      setUploadError('network')
      setUploadStatus('error')
    }
  }, [])

  return { startUpload }
}
