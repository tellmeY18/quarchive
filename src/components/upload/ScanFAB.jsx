import { useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router'
import useAuthStore from '../../store/authStore'
import LoginModal from '../auth/LoginModal'

const VISIBLE_PATHS = ['/', '/browse']

export default function ScanFAB() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [showLogin, setShowLogin] = useState(false)

  const isVisible = VISIBLE_PATHS.includes(location.pathname)

  const handleClick = useCallback(() => {
    if (isLoggedIn) {
      navigate('/upload')
    } else {
      setShowLogin(true)
    }
  }, [isLoggedIn, navigate])

  const handleLoginSuccess = useCallback(() => {
    setShowLogin(false)
    navigate('/upload')
  }, [navigate])

  if (!isVisible) return null

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-pyqp-accent text-white shadow-lg flex items-center justify-center hover:bg-pyqp-accent-hover transition-colors"
        style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Scan question paper"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
        </svg>
      </button>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  )
}
