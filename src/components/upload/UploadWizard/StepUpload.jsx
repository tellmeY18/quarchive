import { useEffect, useCallback, useRef } from 'react'
import useWizardStore from '../../../store/wizardStore'
import useAuthStore from '../../../store/authStore'
import { buildItemUrl } from '../../../lib/archiveOrg'
import { buildMetaHeaders } from '../../../lib/metadata'

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}


const ERROR_MESSAGES = {
  session_expired: {
    title: 'Session Expired',
    message: 'Your Archive.org session expired. Please sign in again.',
    icon: 'lock',
  },
  slow_down: {
    title: 'Server Busy',
    message: 'Archive.org is busy. Please wait a moment and try again.',
    icon: 'clock',
  },
  network: {
    title: 'Connection Failed',
    message: 'Connection failed. Check your internet and try again.',
    icon: 'wifi',
  },
  rejected: {
    title: 'File Rejected',
    message: 'Archive.org rejected this file. Ensure it is a valid PDF and try again.',
    icon: 'alert',
  },
}

export default function StepUpload() {
  const {
    file,
    fileHash,
    identifier,
    metadata,
    uploadStatus,
    uploadError,
    setUploadStatus,
    setUploadError,
    setStep,
    resetWizard,
  } = useWizardStore()

  const { accessKey, secretKey } = useAuthStore()

  // Prevent double-upload in React strict mode
  const hasStarted = useRef(false)

  const doUpload = useCallback(async () => {
    setUploadStatus('uploading')
    setUploadError(null)

    try {
      const meta = buildMetaHeaders(metadata, fileHash)

      const formData = new FormData()
      formData.append('accessKey', accessKey)
      formData.append('secretKey', secretKey)
      formData.append('identifier', identifier)
      formData.append('file', file)
      formData.append('meta', JSON.stringify(meta))

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setUploadStatus('success')
      } else if (response.status === 401) {
        setUploadError('session_expired')
        setUploadStatus('error')
      } else if (response.status === 503) {
        setUploadError('slow_down')
        setUploadStatus('error')
      } else {
        setUploadError('rejected')
        setUploadStatus('error')
      }
    } catch {
      setUploadError('network')
      setUploadStatus('error')
    }
  }, [file, fileHash, identifier, metadata, accessKey, secretKey, setUploadStatus, setUploadError])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    doUpload()
  }, [doUpload])

  const handleRetry = () => {
    doUpload()
  }

  // --- Uploading state ---
  if (uploadStatus === 'uploading') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-xl font-semibold text-pyqp-text">
            Uploading to Internet Archive...
          </h2>
        </div>

        <div className="bg-pyqp-card rounded-xl border border-pyqp-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg
              className="h-5 w-5 text-pyqp-muted shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z"
              />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-pyqp-text truncate">
                {file?.name || 'document.pdf'}
              </p>
              <p className="text-xs text-pyqp-muted">
                {file ? formatFileSize(file.size) : ''}
              </p>
            </div>
          </div>

          {/* Indeterminate progress bar */}
          <div className="w-full h-2 bg-pyqp-border rounded-full overflow-hidden">
            <div className="h-full bg-pyqp-accent rounded-full animate-pulse w-3/4" />
          </div>

          <p className="text-sm text-pyqp-muted mt-4">
            This may take a moment depending on file size.
          </p>
        </div>
      </div>
    )
  }

  // --- Success state ---
  if (uploadStatus === 'success') {
    const itemUrl = buildItemUrl(identifier)

    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg
              className="h-6 w-6 text-green-600 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="font-heading text-xl font-semibold text-green-800">
              Paper archived successfully!
            </h2>
          </div>

          <p className="text-sm text-green-700 mb-1">
            Permanently available at:
          </p>
          <a
            href={itemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-pyqp-accent hover:text-pyqp-accent-hover break-all transition-colors"
          >
            {itemUrl}
          </a>

          <div className="flex flex-wrap gap-3 mt-6">
            <a
              href={itemUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-pyqp-accent hover:bg-pyqp-accent-hover rounded-lg transition-colors"
            >
              View Paper
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 11-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
            <button
              type="button"
              onClick={resetWizard}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-pyqp-text bg-pyqp-card border border-pyqp-border hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
            >
              Upload Another
            </button>
          </div>

          <p className="text-xs text-green-600 mt-5">
            Archive.org will process the PDF for full-text search and page-by-page preview within a few hours.
          </p>
        </div>
      </div>
    )
  }

  // --- Error state ---
  if (uploadStatus === 'error') {
    const errorInfo = ERROR_MESSAGES[uploadError] || ERROR_MESSAGES.rejected
    const canRetry = uploadError === 'slow_down' || uploadError === 'network'

    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="h-6 w-6 text-red-500 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="font-heading text-lg font-semibold text-red-800">
              {errorInfo.title}
            </h2>
          </div>

          <p className="text-sm text-red-700">
            {errorInfo.message}
          </p>

          <div className="flex flex-wrap gap-3 mt-5">
            {canRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-pyqp-accent hover:bg-pyqp-accent-hover rounded-lg transition-colors cursor-pointer"
              >
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H4.598a.75.75 0 00-.75.75v3.634a.75.75 0 001.5 0v-2.033l.312.311a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm-11.073-3.96a.75.75 0 00-1.449-.39A7 7 0 0014.501 10.2l.312.311v-2.033a.75.75 0 011.5 0v3.634a.75.75 0 01-.75.75h-3.634a.75.75 0 010-1.5h2.433l-.312-.311a5.5 5.5 0 00-9.201-2.466.75.75 0 01-1.11-1.11z"
                    clipRule="evenodd"
                  />
                </svg>
                Retry
              </button>
            )}

            {uploadError === 'rejected' && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-pyqp-text bg-pyqp-card border border-pyqp-border hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
              >
                <svg
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                    clipRule="evenodd"
                  />
                </svg>
                Edit Details
              </button>
            )}

            {uploadError === 'session_expired' && (
              <p className="text-sm text-red-600 self-center">
                Please close this wizard and sign in again.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Fallback (should not reach here)
  return null
}
