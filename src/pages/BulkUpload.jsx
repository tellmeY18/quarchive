import { useState, useCallback, useRef } from "react"
import { Link } from "react-router"
import useAuthStore from "../store/authStore"
import useBulkStore from "../store/bulkStore"
import useBulkOcr from "../hooks/useBulkOcr"
import useBulkUpload from "../hooks/useBulkUpload"
import BulkFilePicker from "../components/bulk/BulkFilePicker"
import BulkQueue from "../components/bulk/BulkQueue"
import BulkUploadBar from "../components/bulk/BulkUploadBar"
import BulkMetadataSheet from "../components/bulk/BulkMetadataSheet"
import InstitutionSearch from "../components/upload/InstitutionSearch"
import LoginModal from "../components/auth/LoginModal"

const DESKTOP_BANNER_KEY = "quarchive.bulk.desktop-banner-dismissed"
const SOFT_LIMIT = 30
const HARD_LIMIT = 50

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 768
}

// ── Auth gate (not-logged-in state) ──────────────────────────────────────────

function AuthGate({ onSignIn }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <div className="mb-6">
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 text-sm text-pyqp-muted hover:text-pyqp-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
      </div>
      <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-8 md:p-10 text-center max-w-md mx-auto">
        <div className="mx-auto w-14 h-14 rounded-full bg-pyqp-accent/10 flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-pyqp-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="font-heading text-lg font-semibold text-pyqp-text">Sign in to continue</h2>
        <p className="text-sm text-pyqp-muted mt-2">You need an Internet Archive account to upload papers.</p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-pyqp-accent text-white text-sm font-semibold rounded-lg hover:bg-pyqp-accent-hover transition-colors cursor-pointer min-h-[48px]"
        >
          Sign In
        </button>
        <p className="text-xs text-pyqp-muted mt-5">
          {"Don't have an account? "}
          <a
            href="https://archive.org/account/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-pyqp-accent hover:text-pyqp-accent-hover font-medium underline underline-offset-2"
          >
            Sign up at archive.org
          </a>
        </p>
      </div>
    </div>
  )
}

// ── BulkUpload page ───────────────────────────────────────────────────────────

export default function BulkUpload() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const files = useBulkStore((s) => s.files)
  const institution = useBulkStore((s) => s.institution)
  const setInstitutionAndRevalidate = useBulkStore((s) => s.setInstitutionAndRevalidate)
  const addFiles = useBulkStore((s) => s.addFiles)

  const [sheetFileId, setSheetFileId] = useState(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(DESKTOP_BANNER_KEY) === "1",
  )
  const [isMobile] = useState(() => isMobileViewport())

  // Hidden <input> used by "Add more" button
  const addMoreInputRef = useRef(null)

  // Side-effects: serial OCR over queue
  useBulkOcr()

  // Upload engine
  const { startUpload } = useBulkUpload()

  // ── File selection ──────────────────────────────────────────────────────
  const handleFilesSelected = useCallback((validFiles) => {
    if (validFiles.length > 0) addFiles(validFiles)
  }, [addFiles])

  const handleAddMore = useCallback(() => {
    addMoreInputRef.current?.click()
  }, [])

  const handleAddMoreInput = useCallback((e) => {
    if (!e.target.files) return
    const arr = Array.from(e.target.files).filter(
      (f) => f.type === "application/pdf" && f.size <= 50 * 1024 * 1024,
    )
    if (arr.length > 0) addFiles(arr)
    e.target.value = ""
  }, [addFiles])

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true)
    try { localStorage.setItem(DESKTOP_BANNER_KEY, "1") } catch { /* ignore */ }
  }, [])

  // ── Auth guard ──────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <>
        <AuthGate onSignIn={() => setShowLoginModal(true)} />
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => setShowLoginModal(false)}
        />
      </>
    )
  }

  const overSoftLimit = files.length > SOFT_LIMIT
  const atHardLimit = files.length >= HARD_LIMIT
  const canAddMore = !atHardLimit

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10 pb-32 md:pb-0">
      {/* Hidden file input for "Add more" */}
      <input
        ref={addMoreInputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={handleAddMoreInput}
      />

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 text-sm text-pyqp-muted hover:text-pyqp-text transition-colors mb-3"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-pyqp-text">Bulk Upload</h1>
        <p className="text-pyqp-text-light mt-1.5 text-sm md:text-base">
          Upload multiple PDFs at once. OCR will suggest metadata for each file.
        </p>
      </div>

      {/* ── Mobile banner ─────────────────────────────────────────────────── */}
      {isMobile && !bannerDismissed && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="shrink-0 text-amber-500 mt-0.5" aria-hidden="true">💻</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">Works best on a computer</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Bulk upload is designed for desktop. You can still proceed on mobile.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-amber-400 hover:text-amber-700 hover:bg-amber-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Soft-limit warning ────────────────────────────────────────────── */}
      {overSoftLimit && !atHardLimit && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Large batch:</span> {files.length} files selected. Upload may take a while.
        </div>
      )}

      {/* ── Hard-limit error ──────────────────────────────────────────────── */}
      {atHardLimit && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="font-semibold">50-file limit reached.</span> Remove some files before adding more.
        </div>
      )}

      {/* ── Institution picker (visible once files exist) ─────────────────── */}
      {files.length > 0 && (
        <div className="mb-5 bg-pyqp-card border border-pyqp-border rounded-xl p-4">
          <label className="block text-xs font-semibold text-pyqp-text-light uppercase tracking-wide mb-1.5">
            Institution <span className="text-red-500">*</span>
            <span className="ml-1.5 font-normal text-pyqp-muted normal-case tracking-normal">(shared for all files)</span>
          </label>
          <InstitutionSearch value={institution} onChange={setInstitutionAndRevalidate} />
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────────────────── */}
      {files.length === 0 ? (
        <BulkFilePicker onFilesSelected={handleFilesSelected} />
      ) : (
        <>
          <BulkQueue
            onOpenSheet={setSheetFileId}
            onAddMore={canAddMore ? handleAddMore : undefined}
          />
          <BulkUploadBar onUpload={startUpload} />
        </>
      )}

      {/* ── Mobile metadata sheet ─────────────────────────────────────────── */}
      <BulkMetadataSheet
        fileId={sheetFileId}
        onClose={() => setSheetFileId(null)}
      />
    </div>
  )
}
