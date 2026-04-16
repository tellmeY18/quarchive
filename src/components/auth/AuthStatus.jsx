import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import useAuthStore from '../../store/authStore'
import useArchiveAuth from '../../hooks/useArchiveAuth'
import LoginModal from './LoginModal'

export default function AuthStatus() {
  const navigate = useNavigate()
  const { isLoggedIn, screenname } = useAuthStore()
  const { logout } = useArchiveAuth()

  const [showModal, setShowModal] = useState(false)
  const [pendingUpload, setPendingUpload] = useState(false)

  const handleSignInClick = useCallback(() => {
    setPendingUpload(false)
    setShowModal(true)
  }, [])

  const handleUploadClick = useCallback(() => {
    if (isLoggedIn) {
      navigate('/upload')
    } else {
      setPendingUpload(true)
      setShowModal(true)
    }
  }, [isLoggedIn, navigate])

  const handleLoginSuccess = useCallback(() => {
    setShowModal(false)
    if (pendingUpload) {
      setPendingUpload(false)
      navigate('/upload')
    }
  }, [pendingUpload, navigate])

  const handleCloseModal = useCallback(() => {
    setShowModal(false)
    setPendingUpload(false)
  }, [])

  const handleLogout = useCallback(() => {
    logout()
  }, [logout])

  return (
    <>
      <div className="flex items-center gap-3">
        {isLoggedIn ? (
          <>
            {/* Screenname link */}
            <a
              href={`https://archive.org/details/@${screenname}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium text-pyqp-text-light hover:text-pyqp-text transition-colors"
            >
              <span className="text-green-500 text-xs">{'\u25CF'}</span>
              {screenname}
            </a>

            {/* Upload button */}
            <button
              type="button"
              onClick={handleUploadClick}
              className="bg-pyqp-accent text-white hover:bg-pyqp-accent-hover rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              {'\u2191'} Upload
            </button>

            {/* Sign Out button */}
            <button
              type="button"
              onClick={handleLogout}
              className="border border-pyqp-border text-pyqp-text-light hover:text-pyqp-text hover:bg-pyqp-border/50 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            {/* Sign In button */}
            <button
              type="button"
              onClick={handleSignInClick}
              className="border border-pyqp-border text-pyqp-text hover:bg-pyqp-border/50 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              Sign In
            </button>

            {/* Upload button */}
            <button
              type="button"
              onClick={handleUploadClick}
              className="bg-pyqp-accent text-white hover:bg-pyqp-accent-hover rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              {'\u2191'} Upload
            </button>
          </>
        )}
      </div>

      <LoginModal
        isOpen={showModal}
        onClose={handleCloseModal}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  )
}
