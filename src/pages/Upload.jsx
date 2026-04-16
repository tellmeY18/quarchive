import { useState, useCallback } from 'react'
import useAuthStore from '../store/authStore'
import useWizardStore from '../store/wizardStore'
import useCameraStore from '../store/cameraStore'
import LoginModal from '../components/auth/LoginModal'
import UploadWizard from '../components/upload/UploadWizard'
import CameraCapture from '../components/upload/CameraCapture'

function hasCamera() {
  return typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
}

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export default function Upload() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const setFile = useWizardStore((s) => s.setFile)
  const setSource = useWizardStore((s) => s.setSource)

  const [cameraAvailable] = useState(() => hasCamera())
  const [mobile] = useState(() => isMobile())
  const [showCamera, setShowCamera] = useState(
    () => isLoggedIn && cameraAvailable && mobile,
  )
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleLoginSuccess = useCallback(() => {
    setShowLoginModal(false)
  }, [])

  const handleCameraComplete = useCallback((pdfBlob) => {
    // Convert blob to File for upload
    const file = new File([pdfBlob], 'scanned-paper.pdf', { type: 'application/pdf' })
    setFile(file)
    setSource('camera')
    setShowCamera(false)
    useCameraStore.getState().reset()
  }, [setFile, setSource])

  const handleCameraCancel = useCallback(() => {
    setShowCamera(false)
    useCameraStore.getState().reset()
  }, [])

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-pyqp-text">
          Upload a Question Paper
        </h1>
        <p className="text-pyqp-text-light mt-2">
          Contribute to the archive by uploading previous year exam papers.
        </p>

        <div className="mt-8 md:mt-10">
          <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-8 md:p-10 text-center max-w-md mx-auto">
            <div className="mx-auto w-14 h-14 rounded-full bg-pyqp-accent/10 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-pyqp-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <h2 className="font-heading text-lg font-semibold text-pyqp-text">Sign in to continue</h2>
            <p className="text-sm text-pyqp-muted mt-2">You need an Internet Archive account to upload papers.</p>
            <button
              type="button"
              onClick={() => setShowLoginModal(true)}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-pyqp-accent text-white text-sm font-semibold rounded-lg hover:bg-pyqp-accent-hover transition-colors cursor-pointer min-h-[48px]"
            >
              Sign In
            </button>
            <p className="text-xs text-pyqp-muted mt-5">
              {"Don't have an account? "}
              <a href="https://archive.org/account/signup" target="_blank" rel="noopener noreferrer" className="text-pyqp-accent hover:text-pyqp-accent-hover font-medium underline underline-offset-2">
                Sign up at archive.org
              </a>
            </p>
          </div>
          <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    )
  }

  // Camera capture mode
  if (showCamera) {
    return (
      <CameraCapture
        onComplete={handleCameraComplete}
        onCancel={handleCameraCancel}
      />
    )
  }

  // Logged in — show wizard
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="font-heading text-2xl md:text-3xl font-bold text-pyqp-text">
        Upload a Question Paper
      </h1>
      <p className="text-pyqp-text-light mt-2">
        Contribute to the archive by uploading previous year exam papers.
      </p>
      <div className="mt-8 md:mt-10">
        <UploadWizard
          onOpenCamera={() => setShowCamera(true)}
          cameraAvailable={cameraAvailable}
        />
      </div>
    </div>
  )
}
