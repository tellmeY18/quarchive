import { useState, useCallback } from 'react'
import useAuthStore from '../store/authStore'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import LoginModal from '../components/auth/LoginModal'
import UploadWizard from '../components/upload/UploadWizard'

export default function Upload() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const handleLoginSuccess = useCallback(() => {
    setShowLoginModal(false)
  }, [])

  const handleCloseModal = useCallback(() => {
    setShowLoginModal(false)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="font-heading text-3xl font-bold text-pyqp-text">
            Upload a Question Paper
          </h1>
          <p className="text-pyqp-text-light mt-2">
            Contribute to the archive by uploading previous year exam papers.
          </p>

          <div className="mt-10">
            {isLoggedIn ? (
              <UploadWizard />
            ) : (
              <>
                {/* Login prompt card */}
                <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-10 text-center max-w-md mx-auto">
                  {/* Lock icon */}
                  <div className="mx-auto w-14 h-14 rounded-full bg-pyqp-accent/10 flex items-center justify-center mb-5">
                    <svg
                      className="w-7 h-7 text-pyqp-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                      />
                    </svg>
                  </div>

                  <h2 className="font-heading text-lg font-semibold text-pyqp-text">
                    Sign in to continue
                  </h2>
                  <p className="text-sm text-pyqp-muted mt-2">
                    You need an Internet Archive account to upload papers.
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-pyqp-accent text-white text-sm font-semibold rounded-lg hover:bg-pyqp-accent-hover transition-colors cursor-pointer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                      />
                    </svg>
                    Sign In
                  </button>

                  <p className="text-xs text-pyqp-muted mt-5">
                    Don’t have an account?{' '}
                    <a
                      href="https://archive.org/account/signup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pyqp-accent hover:text-pyqp-accent-hover font-medium underline underline-offset-2 transition-colors"
                    >
                      Sign up at archive.org ↗
                    </a>
                  </p>
                </div>

                <LoginModal
                  isOpen={showLoginModal}
                  onClose={handleCloseModal}
                  onLoginSuccess={handleLoginSuccess}
                />
              </>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
