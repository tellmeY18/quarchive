import { useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import useBulkStore, {
  normaliseBulkCourseCode,
  computeIdentifier,
  VALID_EXAM_TYPES,
} from "../../store/bulkStore"
import InstitutionSearch from "../upload/InstitutionSearch"

const CURRENT_YEAR = new Date().getFullYear()

const YEARS = Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => CURRENT_YEAR - i)

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const EXAM_TYPE_LABELS = {
  main: "Main",
  supplementary: "Supplementary",
  model: "Model",
  improvement: "Improvement",
  "end-semester": "End Semester",
  midsemester: "Midsemester",
  "make-up": "Make Up",
  "re-exam": "Re-Exam",
  "save-a-year": "Save A Year",
}

const SEMESTERS = [
  { value: "1", label: "S1" },
  { value: "2", label: "S2" },
  { value: "3", label: "S3" },
  { value: "4", label: "S4" },
  { value: "5", label: "S5" },
  { value: "6", label: "S6" },
  { value: "7", label: "S7" },
  { value: "8", label: "S8" },
  { value: "annual", label: "Annual" },
]

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ml", label: "Malayalam" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
]

/**
 * OcrPill — a single suggestion pill shown above a form field.
 * Props: fieldName, value, onAccept, onDismiss
 */
function OcrPill({ value, onAccept, onDismiss }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
      <span className="text-xs text-pyqp-accent font-medium">✨ Suggested:</span>
      <span className="text-xs bg-pyqp-accent/10 text-pyqp-accent px-2 py-0.5 rounded-full font-medium max-w-[160px] truncate">
        {value}
      </span>
      <button
        type="button"
        onClick={onAccept}
        aria-label={"Accept suggestion: " + value}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors text-xs font-bold"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss suggestion"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors text-xs"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * BulkMetadataSheet — mobile bottom sheet (md:hidden) with full per-file
 * metadata form and OCR suggestion pills.
 *
 * Props:
 *   fileId   string | null   ID of BulkFileRecord to edit. null = closed.
 *   onClose  () => void
 */
export default function BulkMetadataSheet({ fileId, onClose }) {
  const isOpen = Boolean(fileId)

  const fileRecord = useBulkStore((s) => s.files.find((f) => f.id === fileId) ?? null)
  const institution = useBulkStore((s) => s.institution)
  const setFileMetadata = useBulkStore((s) => s.setFileMetadata)
  const acceptOcrField = useBulkStore((s) => s.acceptOcrField)
  const dismissOcrField = useBulkStore((s) => s.dismissOcrField)
  const setInstitutionAndRevalidate = useBulkStore((s) => s.setInstitutionAndRevalidate)

  // Body scroll lock
  useEffect(() => {
    if (isOpen) document.body.classList.add("overflow-hidden")
    else document.body.classList.remove("overflow-hidden")
    return () => document.body.classList.remove("overflow-hidden")
  }, [isOpen])

  // Escape key dismissal
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, onClose])

  // Field change — normalises courseCode (invariant #15)
  const handleField = useCallback((field, value) => {
    if (!fileId) return
    const stored = field === "courseCode" ? normaliseBulkCourseCode(value) : value
    setFileMetadata(fileId, field, stored)
  }, [fileId, setFileMetadata])

  if (!isOpen || !fileRecord) return null

  const meta = fileRecord.metadata
  const suggestions = fileRecord.ocrSuggestions
  const dismissed = fileRecord.ocrDismissed
  const validationErrors = fileRecord.validationErrors ?? {}
  const identifierPreview = computeIdentifier(meta, institution)

  // showPill: non-null suggestion, not dismissed, not accepted, field empty or equals suggestion
  function showPill(field) {
    const s = suggestions?.[field]
    if (!s) return false
    if (dismissed?.[field]) return false
    if (fileRecord.ocrAccepted?.[field]) return false
    if (meta[field] && meta[field] !== s) return false
    return true
  }

  const inputCls = "w-full rounded-lg border border-pyqp-border bg-pyqp-bg px-3 py-2.5 text-sm text-pyqp-text placeholder:text-pyqp-muted focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent transition-colors min-h-[44px]"
  const labelCls = "block text-xs font-semibold text-pyqp-text-light uppercase tracking-wide mb-1"
  const errorCls = "mt-1 text-xs text-red-600"

  return createPortal(
    <>
      {/* Backdrop — md:hidden so it never shows on desktop */}
      <div
        className="fixed inset-0 bg-black/40 z-[70] md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — slides up from bottom, only visible on mobile */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={"Edit metadata for " + fileRecord.name}
        className="fixed bottom-0 left-0 right-0 z-[80] bg-pyqp-card rounded-t-2xl shadow-xl max-h-[90vh] overflow-y-auto md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 1rem)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-pyqp-border" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-2 pb-4 border-b border-pyqp-border">
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-base font-semibold text-pyqp-text">Edit Paper Details</h2>
            <p className="text-xs text-pyqp-muted mt-0.5 truncate">{fileRecord.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-pyqp-bg text-pyqp-muted hover:text-pyqp-text transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-4 py-4 space-y-4">

          {/* Institution (shared) */}
          <div>
            <label className={labelCls}>
              Institution{" "}
              <span className="ml-1 font-normal text-pyqp-muted normal-case tracking-normal">(shared for all files)</span>
            </label>
            <InstitutionSearch value={institution} onChange={setInstitutionAndRevalidate} />
          </div>

          {/* Course Code */}
          <div>
            <label className={labelCls}>Course Code <span className="text-red-500">*</span></label>
            {showPill("courseCode") && (
              <OcrPill
                value={suggestions.courseCode}
                onAccept={() => acceptOcrField(fileId, "courseCode", suggestions.courseCode)}
                onDismiss={() => dismissOcrField(fileId, "courseCode")}
              />
            )}
            <input
              type="text"
              value={meta.courseCode}
              onChange={(e) => setFileMetadata(fileId, "courseCode", e.target.value)}
              onBlur={(e) => handleField("courseCode", e.target.value)}
              placeholder="e.g. CS301"
              className={inputCls}
              autoCapitalize="characters"
            />
            {validationErrors.courseCode && <p className={errorCls}>{validationErrors.courseCode}</p>}
          </div>

          {/* Course Name */}
          <div>
            <label className={labelCls}>Course Name</label>
            {showPill("courseName") && (
              <OcrPill
                value={suggestions.courseName}
                onAccept={() => acceptOcrField(fileId, "courseName", suggestions.courseName)}
                onDismiss={() => dismissOcrField(fileId, "courseName")}
              />
            )}
            <input
              type="text"
              value={meta.courseName}
              onChange={(e) => setFileMetadata(fileId, "courseName", e.target.value)}
              placeholder="e.g. Data Structures"
              className={inputCls}
            />
          </div>

          {/* Year */}
          <div>
            <label className={labelCls}>Year <span className="text-red-500">*</span></label>
            {showPill("year") && (
              <OcrPill
                value={suggestions.year}
                onAccept={() => acceptOcrField(fileId, "year", suggestions.year)}
                onDismiss={() => dismissOcrField(fileId, "year")}
              />
            )}
            <select
              value={meta.year}
              onChange={(e) => setFileMetadata(fileId, "year", e.target.value)}
              className={inputCls}
            >
              <option value="">Select year…</option>
              {YEARS.map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            {validationErrors.year && <p className={errorCls}>{validationErrors.year}</p>}
          </div>

          {/* Exam Type */}
          <div>
            <label className={labelCls}>Exam Type <span className="text-red-500">*</span></label>
            {showPill("examType") && (
              <OcrPill
                value={suggestions.examType}
                onAccept={() => acceptOcrField(fileId, "examType", suggestions.examType)}
                onDismiss={() => dismissOcrField(fileId, "examType")}
              />
            )}
            <div className="grid grid-cols-3 gap-1.5">
              {VALID_EXAM_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFileMetadata(fileId, "examType", type)}
                  className={[
                    "px-2 py-2 rounded-lg text-xs font-medium border transition-colors min-h-[44px]",
                    meta.examType === type
                      ? "bg-pyqp-accent text-white border-pyqp-accent"
                      : "bg-pyqp-bg text-pyqp-text border-pyqp-border hover:border-pyqp-accent/60",
                  ].join(" ")}
                >
                  {EXAM_TYPE_LABELS[type] ?? type}
                </button>
              ))}
            </div>
            {validationErrors.examType && <p className={errorCls}>{validationErrors.examType}</p>}
          </div>

          {/* Semester */}
          <div>
            <label className={labelCls}>
              Semester{" "}
              <span className="font-normal text-pyqp-muted normal-case tracking-normal">(optional)</span>
            </label>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {SEMESTERS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setFileMetadata(fileId, "semester", meta.semester === s.value ? "" : s.value)}
                  className={[
                    "shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors min-h-[44px]",
                    meta.semester === s.value
                      ? "bg-pyqp-accent text-white border-pyqp-accent"
                      : "bg-pyqp-bg text-pyqp-text border-pyqp-border hover:border-pyqp-accent/60",
                  ].join(" ")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Month */}
          <div>
            <label className={labelCls}>
              Month{" "}
              <span className="font-normal text-pyqp-muted normal-case tracking-normal">(optional)</span>
            </label>
            {showPill("month") && (
              <OcrPill
                value={suggestions.month}
                onAccept={() => acceptOcrField(fileId, "month", suggestions.month)}
                onDismiss={() => dismissOcrField(fileId, "month")}
              />
            )}
            <select
              value={meta.month}
              onChange={(e) => setFileMetadata(fileId, "month", e.target.value)}
              className={inputCls}
            >
              <option value="">Select month…</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Program */}
          <div>
            <label className={labelCls}>
              Program{" "}
              <span className="font-normal text-pyqp-muted normal-case tracking-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={meta.program}
              onChange={(e) => setFileMetadata(fileId, "program", e.target.value)}
              placeholder="e.g. B.Tech Computer Science"
              className={inputCls}
            />
          </div>

          {/* Language */}
          <div>
            <label className={labelCls}>Language</label>
            <select
              value={meta.language}
              onChange={(e) => setFileMetadata(fileId, "language", e.target.value)}
              className={inputCls}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          {/* Identifier preview */}
          {identifierPreview && (
            <div className="rounded-lg bg-pyqp-bg border border-pyqp-border px-3 py-2.5">
              <p className="text-xs text-pyqp-muted mb-1">Identifier preview</p>
              <p className="text-xs font-mono text-pyqp-text break-all">{identifierPreview}</p>
            </div>
          )}

          {/* Done button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium text-sm min-h-[48px] bg-pyqp-accent text-white hover:bg-pyqp-accent-hover transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
