import useBulkStore from "../../store/bulkStore"
import BulkQueueItem from "./BulkQueueItem"

/**
 * BulkQueue — scrollable list of BulkQueueItem rows.
 *
 * Props:
 *   onOpenSheet  (fileId: string) => void  — open the BulkMetadataSheet for a file
 *   onAddMore    () => void | undefined    — open the file picker to add more files
 *                                           (undefined when at hard limit)
 */
export default function BulkQueue({ onOpenSheet, onAddMore }) {
  const files = useBulkStore((s) => s.files)
  const isUploading = useBulkStore((s) => s.isUploading)
  const clearAll = useBulkStore((s) => s.clearAll)

  if (files.length === 0) return null

  return (
    <div className="space-y-3">
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium text-pyqp-text">
          {files.length} {files.length === 1 ? "file" : "files"} selected
        </p>
        {!isUploading && (
          <div className="flex items-center gap-2">
            {onAddMore && (
              <button
                type="button"
                onClick={onAddMore}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-pyqp-border text-pyqp-text hover:border-pyqp-accent/60 transition-colors min-h-[36px]"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add more
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-pyqp-border text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors min-h-[36px]"
            >
              ✕ Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── File rows ────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {files.map((f) => (
          <BulkQueueItem key={f.id} fileId={f.id} onOpenSheet={onOpenSheet} />
        ))}
      </div>
    </div>
  )
}
