import { useState, useRef, useCallback } from 'react'

/**
 * BulkFilePicker — drag-and-drop zone for selecting multiple PDFs.
 *
 * Props:
 *   onFilesSelected(validFiles: File[], rejectedFiles: { file: File, reason: string }[])
 *
 * Invariant (CLAUDE.md §21 rule 21): validates MIME type AND %PDF magic bytes.
 * No Zustand import — pure callback component.
 */
export default function BulkFilePicker({ onFilesSelected }) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [rejections, setRejections] = useState([]) // Array<{ id, file, reason }>

  const inputRef = useRef(null)

  // Counts nested drag-enter/leave events so the indicator doesn't flicker
  // when the pointer moves over a child element inside the drop zone.
  const dragCounter = useRef(0)

  // ── Core validation ──────────────────────────────────────────────────────
  // Async because the magic-bytes check slices a File and reads it.
  const validateAndRoute = useCallback(
    async (fileList) => {
      if (!fileList || fileList.length === 0) return

      setIsChecking(true)

      const valid = []
      const rejected = []

      await Promise.all(
        Array.from(fileList).map(async (file) => {
          // 1. MIME type
          if (file.type !== 'application/pdf') {
            rejected.push({ file, reason: 'Not a PDF file' })
            return
          }

          // 2. Size (50 MB hard cap — CLAUDE.md §5C)
          if (file.size > 50 * 1024 * 1024) {
            rejected.push({ file, reason: 'File too large (max 50 MB)' })
            return
          }

          // 3. Magic bytes — first 4 bytes must be %PDF → 0x25 0x50 0x44 0x46
          try {
            const buf = await file.slice(0, 4).arrayBuffer()
            const bytes = new Uint8Array(buf)
            const isPdf =
              bytes[0] === 0x25 &&
              bytes[1] === 0x50 &&
              bytes[2] === 0x44 &&
              bytes[3] === 0x46
            if (!isPdf) {
              rejected.push({
                file,
                reason: 'File does not appear to be a valid PDF',
              })
              return
            }
          } catch {
            rejected.push({ file, reason: 'Could not read file' })
            return
          }

          valid.push(file)
        }),
      )

      setIsChecking(false)

      // Append new rejections to the inline display list with stable IDs
      if (rejected.length > 0) {
        const ts = Date.now()
        setRejections((prev) => [
          ...prev,
          ...rejected.map((r, i) => ({
            id: `${ts}-${i}`,
            file: r.file,
            reason: r.reason,
          })),
        ])
      }

      // Reset the input value so the same file can be re-selected after removal
      if (inputRef.current) {
        inputRef.current.value = ''
      }

      onFilesSelected(valid, rejected)
    },
    [onFilesSelected],
  )

  // ── Drag-and-drop handlers ───────────────────────────────────────────────
  function handleDragEnter(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current += 1
    setIsDragOver(true)
  }

  function handleDragOver(e) {
    // Must call preventDefault to signal the browser this target accepts drops
    e.preventDefault()
    e.stopPropagation()
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current = 0
    setIsDragOver(false)
    validateAndRoute(e.dataTransfer.files)
  }

  // ── File <input> handler ─────────────────────────────────────────────────
  function handleInputChange(e) {
    validateAndRoute(e.target.files)
  }

  // ── Dismiss a rejection from the inline list ─────────────────────────────
  function dismissRejection(id) {
    setRejections((prev) => prev.filter((r) => r.id !== id))
  }

  function openPicker() {
    if (!isChecking) inputRef.current?.click()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Drop zone ───────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop PDF files here or press Enter to open file picker"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openPicker}
        onKeyDown={(e) =>
          (e.key === 'Enter' || e.key === ' ') && openPicker()
        }
        className={[
          'border-2 border-dashed rounded-2xl px-8 py-16',
          'flex flex-col items-center justify-center gap-5',
          'transition-colors duration-150 outline-none select-none',
          'focus-visible:ring-2 focus-visible:ring-pyqp-accent/50 focus-visible:ring-offset-2',
          isChecking
            ? 'border-pyqp-border bg-pyqp-bg opacity-70 cursor-wait'
            : isDragOver
              ? 'border-pyqp-accent bg-pyqp-accent/5 cursor-copy'
              : 'border-pyqp-border bg-pyqp-card hover:border-pyqp-accent/60 hover:bg-pyqp-accent/[0.025] cursor-pointer',
        ].join(' ')}
      >
        {/* Icon circle */}
        <div
          className={[
            'flex items-center justify-center w-16 h-16 rounded-full transition-colors',
            isDragOver ? 'bg-pyqp-accent/10' : 'bg-pyqp-bg',
          ].join(' ')}
        >
          {isChecking ? (
            /* Spinner while validating */
            <svg
              className="h-8 w-8 text-pyqp-accent animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          ) : isDragOver ? (
            /* Down-arrow when dragging over */
            <svg
              className="h-8 w-8 text-pyqp-accent"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
              />
            </svg>
          ) : (
            /* Default: multi-document icon */
            <svg
              className="h-8 w-8 text-pyqp-muted"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
          )}
        </div>

        {/* Label text */}
        <div className="text-center">
          {isChecking ? (
            <p className="text-sm font-medium text-pyqp-text">
              Checking files…
            </p>
          ) : isDragOver ? (
            <p className="text-sm font-semibold text-pyqp-accent">
              Drop PDFs here
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-pyqp-text">
                Drop PDFs here or click to select
              </p>
              <p className="text-xs text-pyqp-muted mt-1.5">
                PDF files only · max 50 MB each
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Hidden file input ────────────────────────────────────────────── */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={handleInputChange}
      />

      {/* ── "Select PDFs" pill button ────────────────────────────────────── */}
      <div className="flex justify-center">
        <button
          type="button"
          disabled={isChecking}
          onClick={openPicker}
          className={[
            'inline-flex items-center gap-2 px-6 py-3 rounded-full',
            'font-medium text-sm min-h-[48px] transition-colors',
            'bg-pyqp-accent text-white',
            isChecking
              ? 'opacity-50 cursor-wait'
              : 'hover:bg-pyqp-accent-hover cursor-pointer',
          ].join(' ')}
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          Select PDFs
        </button>
      </div>

      {/* ── Rejected files ───────────────────────────────────────────────── */}
      {rejections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-pyqp-muted uppercase tracking-wide px-1">
            Rejected files
          </p>
          {rejections.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
            >
              <span className="shrink-0 text-amber-500 mt-0.5 text-sm" aria-hidden="true">
                ⚠
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 truncate">
                  {r.file.name}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">{r.reason}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissRejection(r.id)}
                aria-label={`Dismiss: ${r.file.name}`}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-amber-400 hover:text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
