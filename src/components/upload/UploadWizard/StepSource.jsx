import { useNavigate } from 'react-router'

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-pyqp-border" />
      <span className="text-sm text-pyqp-muted">or</span>
      <div className="flex-1 h-px bg-pyqp-border" />
    </div>
  )
}

/**
 * StepSource — first screen of the upload wizard.
 *
 * Props:
 *   onSelectCamera()  — launch the camera capture flow
 *   onSelectPdf()     — switch wizard to the single-PDF file-upload flow
 *   onSelectBulk()    — (optional) navigate to the bulk-upload page.
 *                       When omitted, falls back to useNavigate('/upload/bulk').
 */
export default function StepSource({ onSelectCamera, onSelectPdf, onSelectBulk }) {
  const navigate = useNavigate()

  function handleBulkClick() {
    if (onSelectBulk) {
      onSelectBulk()
    } else {
      navigate('/upload/bulk')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Heading ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="font-heading text-xl font-semibold text-pyqp-text">
          Add a Question Paper
        </h2>
        <p className="text-sm text-pyqp-muted mt-1">
          Choose how you want to add your question paper.
        </p>
      </div>

      {/* ── PRIMARY: Scan with Camera ──────────────────────────────── */}
      <button
        type="button"
        onClick={onSelectCamera}
        className="w-full bg-pyqp-accent text-white rounded-xl p-5 text-left hover:bg-pyqp-accent-hover transition-colors cursor-pointer min-h-[80px]"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 shrink-0">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-lg">Scan with Camera</p>
            <p className="text-sm text-white/80 mt-0.5">
              Point your camera at the paper pages
            </p>
          </div>
        </div>
      </button>

      <Divider />

      {/* ── SECONDARY: Upload single PDF ──────────────────────────── */}
      <button
        type="button"
        onClick={onSelectPdf}
        className="w-full bg-pyqp-card border border-pyqp-border text-pyqp-text rounded-xl p-4 text-left hover:border-pyqp-accent/50 transition-colors cursor-pointer min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <svg
            className="h-6 w-6 text-pyqp-muted shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <span className="font-medium">Upload existing PDF</span>
        </div>
      </button>

      <Divider />

      {/* ── TERTIARY: Bulk upload PDFs ────────────────────────────── */}
      <button
        type="button"
        onClick={handleBulkClick}
        className="w-full bg-pyqp-card border border-dashed border-pyqp-border text-pyqp-text-light rounded-xl p-4 text-left hover:border-pyqp-accent/40 hover:text-pyqp-text transition-colors cursor-pointer min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none shrink-0" aria-hidden="true">
            📦
          </span>
          <div>
            <p className="font-medium text-sm">Bulk upload PDFs</p>
            <p className="text-xs text-pyqp-muted mt-0.5">
              Upload multiple PDFs at once
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}
