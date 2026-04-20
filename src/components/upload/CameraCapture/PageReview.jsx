import { useState, useCallback } from "react";
import useCameraStore from "../../../store/cameraStore";
import CropEditor from "./CropEditor";

/**
 * PageReview — Phase 8
 *
 * Per-page review screen shown between the viewfinder and the final
 * PDF assembly. Phase 8 adds two new capabilities on top of the
 * pre-existing reorder / delete / swipe controls:
 *
 *   1. "Adjust edges" button → opens `CropEditor` for manual crop
 *      correction when auto-detection was wrong or refused
 *      (CLAUDE.md §5A "Manual Crop").
 *   2. Enhancement-mode toggle (Auto / B&W / Colour original) — lets
 *      the user switch the visual treatment of a page without
 *      re-capturing, per invariant #17 ("enhancement is reversible
 *      per page").
 *
 * Both features load their heavy dependencies (capturePipeline.js and
 * its downstream detect / warp / enhance modules) via dynamic import
 * so the main bundle stays lean.
 */
export default function PageReview({ onConfirm, onRetake }) {
  const {
    capturedPages,
    removePage,
    reorderPages,
    updatePage,
    cropEditing,
    setCropEditing,
  } = useCameraStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  // Per-page re-enhance / re-warp state, keyed by page id, so a slow
  // operation on one page doesn't block the whole UI.
  const [reprocessing, setReprocessing] = useState({});
  // The ImageBitmap passed to CropEditor when the user taps "Adjust
  // edges". Loaded lazily from the page's `rawBlob` so we only spend
  // decode time when the editor actually opens.
  const [editorBitmap, setEditorBitmap] = useState(null);

  const total = capturedPages.length;
  const current = capturedPages[currentIndex];

  const handleDelete = useCallback(() => {
    if (!current) return;
    removePage(current.id);
    if (currentIndex >= total - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [current, currentIndex, total, removePage]);

  const handleMoveUp = useCallback(() => {
    if (currentIndex <= 0) return;
    const pages = [...capturedPages];
    const temp = pages[currentIndex - 1];
    pages[currentIndex - 1] = pages[currentIndex];
    pages[currentIndex] = temp;
    reorderPages(pages);
    setCurrentIndex(currentIndex - 1);
  }, [currentIndex, capturedPages, reorderPages]);

  const handleMoveDown = useCallback(() => {
    if (currentIndex >= total - 1) return;
    const pages = [...capturedPages];
    const temp = pages[currentIndex + 1];
    pages[currentIndex + 1] = pages[currentIndex];
    pages[currentIndex] = temp;
    reorderPages(pages);
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, total, capturedPages, reorderPages]);

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () =>
    setCurrentIndex((i) => Math.min(total - 1, i + 1));

  /**
   * Re-run enhancement on the current page with a different mode.
   * Keeps the cached `baseBlob` intact so the user can flip between
   * modes as many times as they like — detection + warp are never
   * re-run (invariant #17).
   */
  const handleEnhanceMode = useCallback(
    async (mode) => {
      if (!current || current.enhanceMode === mode) return;
      // Without a baseBlob (legacy captures from before Phase 8 wiring)
      // we can still flip the stored mode; it will take effect on the
      // next fresh capture.
      if (!current.baseBlob) {
        updatePage(current.id, { enhanceMode: mode });
        return;
      }
      setReprocessing((r) => ({ ...r, [current.id]: true }));
      try {
        const { reprocessPage } = await import(
          "../../../lib/capturePipeline"
        );
        const result = await reprocessPage(current.baseBlob, mode);
        // Free the old thumbnail URL before overwriting it.
        if (current.dataUrl && current.dataUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(current.dataUrl);
          } catch {
            // Best-effort cleanup.
          }
        }
        updatePage(current.id, {
          blob: result.blob,
          dataUrl: result.dataUrl,
          width: result.width,
          height: result.height,
          enhanceMode: mode,
        });
      } catch (err) {
        console.warn("[PageReview] reprocess failed:", err);
        // Still flip the stored mode so the UI reflects intent.
        updatePage(current.id, { enhanceMode: mode });
      } finally {
        setReprocessing((r) => {
          const next = { ...r };
          delete next[current.id];
          return next;
        });
      }
    },
    [current, updatePage],
  );

  /**
   * Open the CropEditor for the current page. Decodes the page's raw
   * (pre-warp) blob into an ImageBitmap; CropEditor needs this to
   * render the source image with draggable corner handles.
   */
  const handleOpenEditor = useCallback(async () => {
    if (!current) return;
    const source = current.rawBlob || current.baseBlob || current.blob;
    if (!source) return;
    try {
      const bitmap = await createImageBitmap(source);
      setEditorBitmap(bitmap);
      setCropEditing(current.id);
    } catch (err) {
      console.warn("[PageReview] couldn't open crop editor:", err);
    }
  }, [current, setCropEditing]);

  const handleCloseEditor = useCallback(() => {
    setCropEditing(null);
    if (editorBitmap && typeof editorBitmap.close === "function") {
      try {
        editorBitmap.close();
      } catch {
        // Best-effort cleanup.
      }
    }
    setEditorBitmap(null);
  }, [editorBitmap, setCropEditing]);

  /**
   * User saved new corners in CropEditor. Re-warp the original raw
   * frame against those corners, re-enhance with the page's current
   * mode, and persist the new blob + crop state.
   */
  const handleSaveCorners = useCallback(
    async (corners) => {
      if (!current) {
        handleCloseEditor();
        return;
      }
      const source = current.rawBlob || current.baseBlob;
      if (!source) {
        handleCloseEditor();
        return;
      }
      setReprocessing((r) => ({ ...r, [current.id]: true }));
      try {
        const { reprocessWithCorners } = await import(
          "../../../lib/capturePipeline"
        );
        const result = await reprocessWithCorners(
          source,
          corners,
          current.enhanceMode || "auto",
        );
        if (current.dataUrl && current.dataUrl.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(current.dataUrl);
          } catch {
            // Best-effort cleanup.
          }
        }
        updatePage(current.id, {
          blob: result.blob,
          dataUrl: result.dataUrl,
          baseBlob: result.baseBlob,
          crop: result.crop,
          width: result.width,
          height: result.height,
        });
      } catch (err) {
        console.warn("[PageReview] save corners failed:", err);
      } finally {
        setReprocessing((r) => {
          const next = { ...r };
          delete next[current.id];
          return next;
        });
        handleCloseEditor();
      }
    },
    [current, updatePage, handleCloseEditor],
  );

  if (total === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-pyqp-muted mb-4">No pages captured</p>
        <button
          type="button"
          onClick={onRetake}
          className="px-5 py-3 bg-pyqp-accent text-white rounded-lg font-medium min-h-[48px]"
        >
          Open Camera
        </button>
      </div>
    );
  }

  const isEditing = cropEditing === current?.id && !!editorBitmap;
  const isBusy = current ? !!reprocessing[current.id] : false;
  const enhanceMode = current?.enhanceMode || "auto";
  const canAdjust = !!(current && (current.rawBlob || current.baseBlob));

  // ── CropEditor overlay ────────────────────────────────────────────
  // Rendered in place of the regular review UI when the user taps
  // "Adjust edges". Full-screen on mobile; scrollable so the live
  // preview pane is reachable without tap-tapping through sheets.
  if (isEditing) {
    const initialCorners = current.crop?.corners || [
      [0, 0],
      [editorBitmap.width, 0],
      [editorBitmap.width, editorBitmap.height],
      [0, editorBitmap.height],
    ];
    return (
      <div className="fixed inset-0 z-[60] bg-white flex flex-col">
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-pyqp-border"
          style={{
            paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
          }}
        >
          <button
            type="button"
            onClick={handleCloseEditor}
            className="text-sm text-pyqp-accent font-medium min-h-[48px] flex items-center"
          >
            ← Back
          </button>
          <span className="text-sm font-medium text-pyqp-text">
            Adjust edges
          </span>
          <div className="w-16" />
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <CropEditor
            imageBitmap={editorBitmap}
            initialCorners={initialCorners}
            onSave={handleSaveCorners}
            onCancel={handleCloseEditor}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-pyqp-border"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <button
          type="button"
          onClick={onRetake}
          className="text-sm text-pyqp-accent font-medium min-h-[48px] flex items-center"
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Retake
        </button>
        <span className="text-sm font-medium text-pyqp-text">
          Page {currentIndex + 1} of {total}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleMoveUp}
            disabled={currentIndex <= 0}
            className="min-h-[48px] min-w-[44px] flex items-center justify-center text-pyqp-muted disabled:opacity-30"
            aria-label="Move page up"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleMoveDown}
            disabled={currentIndex >= total - 1}
            className="min-h-[48px] min-w-[44px] flex items-center justify-center text-pyqp-muted disabled:opacity-30"
            aria-label="Move page down"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Image preview */}
      <div className="flex-1 relative bg-gray-100 overflow-hidden">
        {current && (
          <img
            src={current.dataUrl}
            alt={`Page ${currentIndex + 1}`}
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="px-3 py-1.5 bg-white rounded-full text-xs font-medium text-pyqp-text shadow">
              Processing…
            </div>
          </div>
        )}

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
            aria-label="Previous page"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
        )}
        {currentIndex < total - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
            aria-label="Next page"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {capturedPages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? "bg-pyqp-accent" : "bg-pyqp-border"
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}


      {/* Phase 8: Adjust edges + Enhancement mode toggle */}
      <div className="px-4 py-2 border-t border-pyqp-border flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleOpenEditor}
          disabled={!canAdjust || isBusy}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-pyqp-text bg-pyqp-card border border-pyqp-border rounded-lg px-3 py-2 min-h-[40px] disabled:opacity-40"
          aria-label="Adjust edges"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4h6v6H4zM14 14h6v6h-6zM4 20l16-16"
            />
          </svg>
          Adjust edges
        </button>

        <div
          role="group"
          aria-label="Enhancement mode"
          className="ml-auto inline-flex rounded-lg border border-pyqp-border overflow-hidden"
        >
          {[
            { value: "auto", label: "Auto" },
            { value: "bw", label: "B&W" },
            { value: "colour", label: "Colour" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleEnhanceMode(opt.value)}
              disabled={isBusy}
              className={`px-3 py-2 min-h-[40px] text-xs font-medium transition-colors disabled:opacity-40 ${
                enhanceMode === opt.value
                  ? "bg-pyqp-accent text-white"
                  : "bg-white text-pyqp-text"
              }`}
              aria-pressed={enhanceMode === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t border-pyqp-border"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 font-medium min-h-[48px]"
          aria-label="Delete page"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 7h12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m-7 0l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"
            />
          </svg>
          Delete
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isBusy || total === 0}
          className="inline-flex items-center gap-2 px-5 py-3 bg-pyqp-accent text-white rounded-lg font-semibold text-sm min-h-[48px] disabled:opacity-50"
        >
          Use These Pages
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
