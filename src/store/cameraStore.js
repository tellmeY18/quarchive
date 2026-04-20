import { create } from "zustand";

/**
 * Camera / capture store — Phase 8 extensions
 *
 * Per-page shape (see `addPage` / `updatePage`):
 * {
 *   id:          string,                      // unique, set by caller
 *   blob:        Blob,                        // final enhanced JPEG (fed into PDF)
 *   dataUrl:     string,                      // object URL for <img> thumbnails
 *   timestamp:   number,
 *   // Phase 8 additions — all optional so legacy captures keep working:
 *   baseBlob?:   Blob,                        // warped-but-unenhanced JPEG, kept
 *                                             //   in memory so PageReview can
 *                                             //   re-run enhancement without
 *                                             //   re-capturing (invariant #17)
 *   crop?: {                                  // auto or manually adjusted quad
 *     corners: number[][] | null,             //   [[x,y],[x,y],[x,y],[x,y]]
 *     mode: 'auto' | 'manual' | 'none',
 *     confidence: number | null,
 *   },
 *   enhanceMode?: 'auto' | 'bw' | 'colour',   // Auto/B&W/Colour toggle state
 *   width?:      number,
 *   height?:     number,
 * }
 *
 * The `enhanceMode` global below is the DEFAULT mode applied to new captures.
 * Individual pages can diverge from it via `updatePage` once the user toggles
 * the mode on a specific thumbnail in PageReview.
 */
const useCameraStore = create((set) => ({
  capturedPages: [],
  isCapturing: false,
  reviewMode: false,
  cropEditing: null, // id of page currently open in CropEditor, or null
  enhanceMode: "auto", // default enhancement mode for new captures
  // ('auto' | 'bw' | 'colour' — see CLAUDE.md §5A)
  pdfBlob: null,
  pdfSize: 0,
  converting: false,
  convertProgress: 0,
  cameraError: null,

  addPage: (page) =>
    set((s) => ({ capturedPages: [...s.capturedPages, page] })),

  removePage: (id) =>
    set((s) => ({
      capturedPages: s.capturedPages.filter((p) => p.id !== id),
    })),

  reorderPages: (pages) => set({ capturedPages: pages }),

  replacePage: (id, newPage) =>
    set((s) => ({
      capturedPages: s.capturedPages.map((p) => (p.id === id ? newPage : p)),
    })),

  /**
   * Merge a partial update into a single page (preserves unchanged fields).
   * Used by PageReview / CropEditor to persist:
   *   - `blob` + `dataUrl` after re-enhancement
   *   - `crop` after manual corner adjustment
   *   - `enhanceMode` after toggling Auto / B&W / Colour
   * without blowing away other metadata (baseBlob, timestamp, id).
   */
  updatePage: (id, patch) =>
    set((s) => ({
      capturedPages: s.capturedPages.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    })),

  clearPages: () => set({ capturedPages: [], pdfBlob: null, pdfSize: 0 }),

  setCapturing: (bool) => set({ isCapturing: bool }),
  setReviewMode: (bool) => set({ reviewMode: bool }),
  setCropEditing: (pageId) => set({ cropEditing: pageId }),
  setEnhanceMode: (mode) => set({ enhanceMode: mode }),
  setPdfBlob: (blob) => set({ pdfBlob: blob, pdfSize: blob?.size || 0 }),
  setConverting: (bool) => set({ converting: bool }),
  setConvertProgress: (p) => set({ convertProgress: p }),
  setCameraError: (err) => set({ cameraError: err }),

  reset: () =>
    set({
      capturedPages: [],
      isCapturing: false,
      reviewMode: false,
      cropEditing: null,
      enhanceMode: "auto",
      pdfBlob: null,
      pdfSize: 0,
      converting: false,
      convertProgress: 0,
      cameraError: null,
    }),
}));

export default useCameraStore;
