import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import useBulkStore, {
  VALID_EXAM_TYPES,
  normaliseBulkCourseCode,
} from "../../store/bulkStore";

// Set pdfjs worker (unpkg CDN — no local worker bundle needed)
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@" +
  pdfjsLib.version +
  "/build/pdf.worker.min.mjs";

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
};

// ── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ record }) {
  const { uploadStatus, ocrStatus, isReady, thumbnailLoading } = record;

  if (uploadStatus === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        ✅ Done
      </span>
    );
  }
  if (uploadStatus === "uploading") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
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
        Uploading
      </span>
    );
  }
  if (uploadStatus === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
        ❌ Failed
      </span>
    );
  }
  if (uploadStatus === "skipped") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        ⊘ Duplicate
      </span>
    );
  }
  if (uploadStatus === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
        ⏳ Pending
      </span>
    );
  }
  // uploadStatus === null
  if (isReady) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        ✅ Ready
      </span>
    );
  }
  if (ocrStatus === "running" || ocrStatus === "queued" || thumbnailLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        <svg
          className="h-3 w-3 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
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
        Scanning
      </span>
    );
  }
  if (
    ocrStatus === "done" ||
    ocrStatus === "skipped" ||
    ocrStatus === "failed"
  ) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        ⚠ Review needed
      </span>
    );
  }
  // idle — still waiting to be scanned
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
      <svg
        className="h-3 w-3 animate-spin"
        viewBox="0 0 24 24"
        fill="none"
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
      Scanning
    </span>
  );
}

// ── OcrPill (inline, compact) ────────────────────────────────────────────────

function OcrPill({ value, onAccept, onDismiss }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-1">
      <span className="text-xs text-pyqp-accent">✨</span>
      <span className="text-xs bg-pyqp-accent/10 text-pyqp-accent px-1.5 py-0.5 rounded-full max-w-[120px] truncate">
        {value}
      </span>
      <button
        type="button"
        onClick={onAccept}
        aria-label={"Accept: " + value}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-200 text-xs font-bold"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs"
      >
        ✕
      </button>
    </div>
  );
}

// ── BulkQueueItem ────────────────────────────────────────────────────────────

/**
 * Props:
 *   fileId      string          ID from bulkStore
 *   onOpenSheet (id) => void    open BulkMetadataSheet for this file (mobile)
 */
export default function BulkQueueItem({ fileId, onOpenSheet }) {
  const record = useBulkStore((s) => s.files.find((f) => f.id === fileId));
  const setThumbnail = useBulkStore((s) => s.setThumbnail);
  const setThumbnailLoading = useBulkStore((s) => s.setThumbnailLoading);
  const setFileMetadata = useBulkStore((s) => s.setFileMetadata);
  const acceptOcrField = useBulkStore((s) => s.acceptOcrField);
  const dismissOcrField = useBulkStore((s) => s.dismissOcrField);
  const removeFile = useBulkStore((s) => s.removeFile);

  const rowRef = useRef(null);
  const canvasRef = useRef(null);
  const thumbnailStarted = useRef(false);

  // Detect mobile once on mount
  const [isMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  // ── Lazy thumbnail via IntersectionObserver ───────────────────────────────
  useEffect(() => {
    if (!record) return;
    if (thumbnailStarted.current) return;
    if (!record.thumbnailLoading && record.thumbnailDataUrl) return;

    const el = rowRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !thumbnailStarted.current) {
          thumbnailStarted.current = true;
          observer.disconnect();
          renderThumbnailRef.current();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const renderThumbnailRef = useRef(null);
  renderThumbnailRef.current = useCallback(async () => {
    if (!record) return;
    try {
      const arrayBuffer = await record.file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 72 / viewport.width;
      const scaled = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = 72;
      canvas.height = Math.round(scaled.height);
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: scaled }).promise;
      setThumbnail(record.id, canvas.toDataURL("image/jpeg", 0.8));
    } catch (err) {
      console.warn("[BulkQueueItem] thumbnail render failed:", err);
      setThumbnailLoading(record.id, false);
    }
  }, [record, setThumbnail, setThumbnailLoading]);

  const handleFieldBlur = useCallback(
    (field, value) => {
      if (!record) return;
      const stored =
        field === "courseCode" ? normaliseBulkCourseCode(value) : value;
      setFileMetadata(record.id, field, stored);
    },
    [record, setFileMetadata],
  );

  if (!record) return null;

  const meta = record.metadata;
  const suggestions = record.ocrSuggestions;
  const dismissed = record.ocrDismissed;
  const accepted = record.ocrAccepted;

  function showPill(field) {
    const s = suggestions?.[field];
    if (!s) return false;
    if (dismissed?.[field]) return false;
    if (accepted?.[field]) return false;
    if (meta[field] && meta[field] !== s) return false;
    return true;
  }

  const inputCls =
    "w-full rounded border border-pyqp-border bg-pyqp-bg px-2 py-1.5 text-xs text-pyqp-text focus:outline-none focus:ring-1 focus:ring-pyqp-accent/40 min-h-[36px] transition-colors";

  function formatBytes(n) {
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
  }

  return (
    <div
      ref={rowRef}
      className={[
        "bg-pyqp-card border border-pyqp-border rounded-xl overflow-hidden",
        isMobile ? "cursor-pointer active:bg-pyqp-bg" : "",
      ].join(" ")}
      onClick={isMobile ? () => onOpenSheet(fileId) : undefined}
    >
      {/* Hidden canvas used for thumbnail rendering */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      <div className="flex gap-3 p-3">
        {/* ── Thumbnail ───────────────────────────────────────────────────── */}
        <div className="shrink-0">
          {record.thumbnailDataUrl ? (
            <img
              src={record.thumbnailDataUrl}
              alt="First page preview"
              className="w-[72px] rounded object-cover border border-pyqp-border"
              style={{ height: "102px" }}
            />
          ) : (
            <div
              className="w-[72px] rounded bg-pyqp-bg border border-pyqp-border flex items-center justify-center"
              style={{ height: "102px" }}
            >
              {record.thumbnailLoading ? (
                <svg
                  className="h-5 w-5 text-pyqp-muted animate-spin"
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
              ) : (
                <svg
                  className="h-5 w-5 text-pyqp-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* ── File info + status + fields ─────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Top row: name + status + remove */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p
                className="text-sm font-medium text-pyqp-text truncate"
                title={record.name}
              >
                {record.name}
              </p>
              <p className="text-xs text-pyqp-muted mt-0.5">
                {formatBytes(record.size)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusBadge record={record} />
              {record.uploadStatus === null && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(record.id);
                  }}
                  aria-label={"Remove " + record.name}
                  className="flex items-center justify-center w-6 h-6 rounded-full text-pyqp-muted hover:text-red-600 hover:bg-red-50 transition-colors"
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
              )}
            </div>
          </div>

          {/* Desktop inline fields */}
          {!isMobile && (
            <div
              className="mt-2 space-y-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {/* Course Code */}
                <div>
                  {showPill("courseCode") && (
                    <OcrPill
                      value={suggestions.courseCode}
                      onAccept={() =>
                        acceptOcrField(
                          record.id,
                          "courseCode",
                          suggestions.courseCode,
                        )
                      }
                      onDismiss={() => dismissOcrField(record.id, "courseCode")}
                    />
                  )}
                  <input
                    type="text"
                    value={meta.courseCode}
                    onChange={(e) =>
                      setFileMetadata(record.id, "courseCode", e.target.value)
                    }
                    onBlur={(e) =>
                      handleFieldBlur("courseCode", e.target.value)
                    }
                    placeholder="Code (e.g. CS301)"
                    className={inputCls}
                    autoCapitalize="characters"
                  />
                  {record.validationErrors?.courseCode && (
                    <p className="text-xs text-red-600 mt-0.5">
                      {record.validationErrors.courseCode}
                    </p>
                  )}
                </div>

                {/* Year */}
                <div>
                  {showPill("year") && (
                    <OcrPill
                      value={suggestions.year}
                      onAccept={() =>
                        acceptOcrField(record.id, "year", suggestions.year)
                      }
                      onDismiss={() => dismissOcrField(record.id, "year")}
                    />
                  )}
                  <input
                    type="text"
                    value={meta.year}
                    onChange={(e) =>
                      setFileMetadata(record.id, "year", e.target.value)
                    }
                    placeholder="Year (e.g. 2023)"
                    maxLength={4}
                    className={inputCls}
                  />
                  {record.validationErrors?.year && (
                    <p className="text-xs text-red-600 mt-0.5">
                      {record.validationErrors.year}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {/* Exam Type */}
                <div>
                  {showPill("examType") && (
                    <OcrPill
                      value={suggestions.examType}
                      onAccept={() =>
                        acceptOcrField(
                          record.id,
                          "examType",
                          suggestions.examType,
                        )
                      }
                      onDismiss={() => dismissOcrField(record.id, "examType")}
                    />
                  )}
                  <select
                    value={meta.examType}
                    onChange={(e) =>
                      setFileMetadata(record.id, "examType", e.target.value)
                    }
                    className={inputCls}
                  >
                    <option value="">Exam type…</option>
                    {VALID_EXAM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EXAM_TYPE_LABELS[t] ?? t}
                      </option>
                    ))}
                  </select>
                  {record.validationErrors?.examType && (
                    <p className="text-xs text-red-600 mt-0.5">
                      {record.validationErrors.examType}
                    </p>
                  )}
                </div>

                {/* Semester */}
                <div>
                  <input
                    type="text"
                    value={meta.semester}
                    onChange={(e) =>
                      setFileMetadata(record.id, "semester", e.target.value)
                    }
                    placeholder="Semester (optional)"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Course Name */}
              <div>
                {showPill("courseName") && (
                  <OcrPill
                    value={suggestions.courseName}
                    onAccept={() =>
                      acceptOcrField(
                        record.id,
                        "courseName",
                        suggestions.courseName,
                      )
                    }
                    onDismiss={() => dismissOcrField(record.id, "courseName")}
                  />
                )}
                <input
                  type="text"
                  value={meta.courseName}
                  onChange={(e) =>
                    setFileMetadata(record.id, "courseName", e.target.value)
                  }
                  placeholder="Course name (optional)"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {/* Mobile tap hint */}
          {isMobile && !record.isReady && record.uploadStatus === null && (
            <p className="text-xs text-pyqp-muted mt-1.5">
              Tap to edit metadata →
            </p>
          )}

          {/* Post-upload status messages */}
          {record.uploadStatus === "done" && record.archiveUrl && (
            <a
              href={record.archiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-pyqp-accent hover:underline"
            >
              View on Archive.org ↗
            </a>
          )}
          {record.uploadStatus === "skipped" && (
            <p className="mt-1.5 text-xs text-amber-600">
              {record.duplicateUrl === "duplicate-in-batch" ? (
                "Duplicate of another file in this batch"
              ) : record.duplicateUrl ? (
                <a
                  href={record.duplicateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Already on Archive.org ↗
                </a>
              ) : (
                "Duplicate"
              )}
            </p>
          )}
          {record.uploadStatus === "failed" && record.uploadError && (
            <p className="mt-1.5 text-xs text-red-600">
              {record.uploadError === "session_expired"
                ? "Session expired — please sign in again"
                : "Upload failed: " + record.uploadError}
            </p>
          )}
        </div>
      </div>

      {/* Upload progress bar */}
      {record.uploadStatus === "uploading" && record.uploadProgress > 0 && (
        <div className="h-1 bg-pyqp-bg">
          <div
            className="h-1 bg-pyqp-accent transition-all"
            style={{ width: Math.round(record.uploadProgress * 100) + "%" }}
          />
        </div>
      )}
    </div>
  );
}
