import useBulkStore from '../../store/bulkStore'

/**
 * StatusChip — small coloured pill showing a count + label.
 *
 * colorClass: full Tailwind class string for bg, text, and border.
 */
function StatusChip({ count, label, colorClass }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${colorClass}`}
    >
      <span className="font-semibold tabular-nums">{count}</span>
      <span>{label}</span>
    </span>
  )
}

/**
 * BulkUploadBar — sticky (desktop) / fixed (mobile) bottom action bar.
 *
 * Layout:
 *   Row 1  Summary chips
 *            nReady + nReview: always shown (muted when zero)
 *            nScanning / nUploading / nPending / nDone / nDuplicate / nFailed:
 *            shown only when > 0
 *   Row 2  "Upload N Ready files" CTA
 *            -or- "Uploading X / Y" progress line when isUploading is true
 *
 * Props:
 *   onUpload()  called when the user taps the CTA (ignored when disabled)
 */
export default function BulkUploadBar({ onUpload }) {
  const files      = useBulkStore((s) => s.files)
  const isUploading = useBulkStore((s) => s.isUploading)

  // ── Derived counts ─────────────────────────────────────────────────────────
  const nReady = files.filter(
    (f) => f.isReady && f.uploadStatus === null,
  ).length

  const nScanning = files.filter(
    (f) =>
      f.ocrStatus === 'running' ||
      f.ocrStatus === 'queued' ||
      f.thumbnailLoading,
  ).length

  const nReview = files.filter(
    (f) =>
      !f.isReady &&
      f.uploadStatus === null &&
      f.ocrStatus !== 'idle' &&
      f.ocrStatus !== 'running',
  ).length

  const nDuplicate = files.filter((f) => f.uploadStatus === 'skipped').length
  const nFailed    = files.filter((f) => f.uploadStatus === 'failed').length
  const nDone      = files.filter((f) => f.uploadStatus === 'done').length
  const nUploading = files.filter((f) => f.uploadStatus === 'uploading').length
  const nPending   = files.filter((f) => f.uploadStatus === 'pending').length

  // Total files that have entered the upload pipeline for the progress line
  const nTotal = files.filter(
    (f) =>
      f.uploadStatus === 'pending' ||
      f.uploadStatus === 'uploading' ||
      f.uploadStatus === 'done' ||
      f.uploadStatus === 'failed' ||
      f.uploadStatus === 'skipped',
  ).length

  const isDisabled = nReady === 0 || isUploading

  // ── Chip colour helpers ────────────────────────────────────────────────────
  // nReady and nReview are always visible; go muted when zero.
  const readyClass =
    nReady > 0
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-gray-100 text-gray-400 border-gray-200'

  const reviewClass =
    nReview > 0
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-gray-100 text-gray-400 border-gray-200'

  // ── Render ─────────────────────────────────────────────────────────────────
  /*
   * Positioning strategy:
   *   Mobile (base): fixed to the bottom of the viewport; above the system
   *     home bar via env(safe-area-inset-bottom).
   *   Desktop (md+): sticky within the page scroll container so it hugs the
   *     bottom without covering unrelated content.
   *
   * Tailwind emits responsive utilities after base utilities in the
   * compiled CSS, so md:sticky correctly overrides fixed at >= 768 px.
   * The left-0 / right-0 that were set for the fixed variant have no
   * effect on sticky positioning (sticky follows document flow for x).
   */
  return (
    <div
      className="
        fixed bottom-0 left-0 right-0 z-10 w-full
        md:sticky md:bottom-0 md:left-auto md:right-auto
        bg-pyqp-card border-t border-pyqp-border
      "
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="px-4 py-3 md:px-6 md:py-4 space-y-3">

        {/* ── Row 1: Summary chips ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5">

          {/* Always shown — nReady */}
          <StatusChip
            count={nReady}
            label="ready"
            colorClass={readyClass}
          />

          {/* Always shown — nReview */}
          <StatusChip
            count={nReview}
            label="review needed"
            colorClass={reviewClass}
          />

          {/* Shown only when > 0 */}
          {nScanning > 0 && (
            <StatusChip
              count={nScanning}
              label="scanning"
              colorClass="bg-blue-50 text-blue-700 border-blue-200"
            />
          )}

          {nUploading > 0 && (
            <StatusChip
              count={nUploading}
              label="uploading"
              colorClass="bg-blue-50 text-blue-700 border-blue-200"
            />
          )}

          {nPending > 0 && (
            <StatusChip
              count={nPending}
              label="pending"
              colorClass="bg-gray-100 text-gray-600 border-gray-200"
            />
          )}

          {nDone > 0 && (
            <StatusChip
              count={nDone}
              label="done"
              colorClass="bg-emerald-50 text-emerald-700 border-emerald-200"
            />
          )}

          {nDuplicate > 0 && (
            <StatusChip
              count={nDuplicate}
              label="duplicate"
              colorClass="bg-gray-100 text-gray-600 border-gray-200"
            />
          )}

          {nFailed > 0 && (
            <StatusChip
              count={nFailed}
              label="failed"
              colorClass="bg-red-50 text-red-700 border-red-200"
            />
          )}
        </div>

        {/* ── Row 2: CTA or in-progress status ──────────────────────────── */}
        {isUploading ? (
          /* Upload is running — show progress line instead of CTA */
          <div className="flex items-center gap-2 text-sm text-pyqp-muted">
            <svg
              className="h-4 w-4 text-pyqp-accent animate-spin shrink-0"
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
            <span>
              Uploading{' '}
              <span className="font-semibold text-pyqp-text tabular-nums">
                {nDone}
              </span>{' '}
              /{' '}
              <span className="tabular-nums">{nTotal}</span>{' '}
              {nTotal === 1 ? 'file' : 'files'}…
            </span>
          </div>
        ) : (
          /* Default — Upload CTA button, right-aligned on desktop */
          <div className="flex justify-end">
            <button
              type="button"
              onClick={isDisabled ? undefined : onUpload}
              disabled={isDisabled}
              className={[
                'inline-flex items-center gap-2 rounded-xl px-5 py-3',
                'font-medium text-sm min-h-[48px] transition-colors',
                'bg-pyqp-accent text-white',
                isDisabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-pyqp-accent-hover cursor-pointer',
              ].join(' ')}
            >
              <span aria-hidden="true">📤</span>
              <span>
                Upload {nReady} Ready{' '}
                {nReady === 1 ? 'file' : 'files'}
              </span>
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
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
