import { create } from "zustand";

/**
 * Global toast store — Phase 8 user-feedback channel
 *
 * A single slot (NOT a queue). The rationale: the upload flow surfaces
 * at most one interesting status at a time (camera starting, pipeline
 * running, flash unavailable, OCR skipped, …). Stacking multiple toasts
 * on a 6-inch screen wastes vertical space and competes with the
 * bottom nav / CTAs — so the newest toast always replaces the old one.
 *
 * Shape of a toast (see `pushToast`):
 *   {
 *     id:       number,                 // monotonically increasing; used as React key
 *     message:  string,                 // user-facing text (keep under ~60 chars)
 *     variant:  'info' | 'busy'         // drives colour + spinner in <Toast />
 *             | 'success' | 'warn'
 *             | 'error',
 *     duration: number,                 // ms before auto-dismiss; 0 = persistent
 *   }
 *
 * Actions:
 *   - `pushToast({ message, variant?, duration? })` — replaces any current
 *     toast with a fresh one. Returns the new toast id so callers who
 *     pushed a persistent 'busy' toast can later call `clearToast(id)`
 *     to dismiss exactly their own toast without clobbering an
 *     unrelated message that a different part of the UI pushed in
 *     the meantime.
 *   - `clearToast(id?)` — dismisses the current toast. If `id` is
 *     supplied, only dismisses if the currently-displayed toast still
 *     matches that id (race-safe for the "busy → done" pattern).
 *
 * Usage pattern for a "busy during a long op" toast:
 *
 *   const id = pushToast({
 *     message: "Creating PDF…",
 *     variant: "busy",
 *     duration: 0,           // persistent; we'll clear it ourselves
 *   });
 *   try {
 *     await doTheWork();
 *     pushToast({ message: "PDF ready", variant: "success" });
 *   } finally {
 *     clearToast(id);        // no-op if the success toast already replaced us
 *   }
 *
 * Why a store instead of React Context?
 *   - Zero prop-drilling between Viewfinder / PageReview / CropEditor /
 *     StepMetadata, all of which have independent reasons to speak to
 *     the user during Phase 8 flows.
 *   - Survives component remounts (e.g. bouncing between capture
 *     phases inside CameraCapture/index.jsx).
 *   - Matches the rest of Quarchive's state layer (zustand everywhere).
 */
const useToastStore = create((set, get) => ({
  /** The currently-displayed toast, or null if nothing is showing. */
  toast: null,

  /** Monotonic id generator — kept on the store so IDs survive across
   *  multiple push/clear cycles without colliding. */
  _nextId: 1,

  /**
   * Show a toast, replacing any existing one.
   * Returns the new toast's id for race-safe clearing.
   */
  pushToast: ({ message, variant = "info", duration = 3000 }) => {
    if (!message) return null;
    const id = get()._nextId;
    set({
      toast: { id, message, variant, duration },
      _nextId: id + 1,
    });
    return id;
  },

  /**
   * Dismiss the current toast.
   *
   * If `id` is provided, only dismisses when the currently-visible
   * toast still matches. This is the safe pattern for the "push busy,
   * then clear on completion" idiom — it prevents a late-arriving
   * clear from accidentally wiping a later, unrelated toast.
   */
  clearToast: (id) => {
    const current = get().toast;
    if (!current) return;
    if (id != null && current.id !== id) return;
    set({ toast: null });
  },
}));

export default useToastStore;
