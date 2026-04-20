import { useEffect } from "react";

/**
 * Toast — ephemeral status feedback for the upload flow
 *
 * Deliberately minimal. Designed for the cases Phase 8 cares about:
 *   - "Flash not available on this camera"
 *   - "Processing 3 pages into PDF…"
 *   - "OCR skipped — enter details manually"
 *   - "Crop editor ready"
 *
 * Rules:
 *   - Always anchored bottom-center above the bottom-nav / safe area.
 *   - Only one toast visible at a time (caller decides which message
 *     wins — we don't maintain a queue here).
 *   - Auto-dismisses after `duration` ms unless `duration` is 0, in
 *     which case the toast is persistent (use for "busy" states that
 *     the caller will manually close).
 *   - Escape and tap-outside are NOT handled — toasts are advisory,
 *     not modal. The tap target on the toast itself dismisses.
 *   - No portal; rendered wherever the caller puts it. On mobile the
 *     fixed positioning is enough to float above the rest of the UI.
 *
 * Variants:
 *   - 'info'    — neutral (default)
 *   - 'busy'    — shows a spinner; intended for longer operations
 *   - 'success' — green tint
 *   - 'warn'    — amber tint; use for "couldn't do X, falling back"
 *   - 'error'   — red tint
 *
 * Usage:
 *   {toast && (
 *     <Toast
 *       message={toast.message}
 *       variant={toast.variant}
 *       duration={toast.duration}
 *       onClose={() => setToast(null)}
 *     />
 *   )}
 */
export default function Toast({
  message,
  variant = "info",
  duration = 3000,
  onClose,
}) {
  useEffect(() => {
    if (!duration || duration <= 0) return undefined;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, message, onClose]);

  const palette = VARIANT_PALETTE[variant] || VARIANT_PALETTE.info;

  return (
    <div
      // Fixed, above bottom nav + safe area. pointer-events-none on the
      // outer wrapper so the toast never intercepts taps outside its
      // own body — dismissal is the only interactive target.
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center px-4"
      style={{
        paddingBottom:
          "calc(5rem + env(safe-area-inset-bottom, 0px))" /* clear bottom nav */,
      }}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => onClose?.()}
        className={`pointer-events-auto inline-flex max-w-[92%] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg transition-opacity min-h-[44px] ${palette}`}
      >
        {variant === "busy" && (
          <svg
            className="h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
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
        )}
        <span className="text-left
">{message}</span>
      </button>
    </div>
  );
}

/**
 * Tailwind palette for each variant. Kept as a plain lookup so the
 * component tree-shakes cleanly — no runtime class concatenation beyond
 * picking one of five strings.
 */
const VARIANT_PALETTE = {
  info: "bg-gray-900/95 text-white",
  busy: "bg-gray-900/95 text-white",
  success: "bg-green-600/95 text-white",
  warn: "bg-amber-600/95 text-white",
  error: "bg-red-600/95 text-white",
};
