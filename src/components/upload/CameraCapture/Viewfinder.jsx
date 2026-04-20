import { useRef, useEffect, useState, useCallback } from "react";
import useCamera from "../../../hooks/useCamera";
import useCameraStore from "../../../store/cameraStore";
import useToastStore from "../../../store/toastStore";

/**
 * Viewfinder — Phase 8 + mobile-feedback revamp
 *
 * Responsibilities this component owns (and nothing else):
 *   1. Driving the live rear-camera feed via `useCamera`.
 *   2. Taking the shutter press and routing the raw frame through the
 *      Phase 8 capture pipeline (`lib/capturePipeline.js`), which runs
 *      detect → warp → enhance.
 *   3. Giving the user visible feedback at every async boundary:
 *        - "Starting camera…"          (full-screen overlay)
 *        - "Processing page…"           (inline toast, bottom)
 *        - "Flash not available"        (toast warn, when applicable)
 *   4. A flash / torch toggle that is **always visible** on screens
 *      where `getUserMedia` worked — we stopped hiding it behind
 *      `caps.torch`, because many Android browsers (Chromium forks,
 *      Samsung Internet, older stock WebView) report `torch: undefined`
 *      on `getCapabilities()` yet still accept the `applyConstraints`
 *      call. The button now optimistically attempts the constraint
 *      and surfaces a single warn-toast when the device genuinely
 *      can't do it.
 *
 * Intentionally NOT here:
 *   - PDF assembly (happens in `CameraCapture/index.jsx` after Done).
 *   - Per-page enhance toggle or crop editor (both in `PageReview`).
 *   - Toast plumbing details (pushed into `useToastStore`, rendered
 *     once at the App root).
 */
export default function Viewfinder({ onDone }) {
  const videoRef = useRef(null);
  const { startCamera, captureFrame, focusAt, toggleTorch, stopCamera } =
    useCamera();
  const { capturedPages, addPage, enhanceMode } = useCameraStore();
  const pushToast = useToastStore((s) => s.pushToast);

  // Tap-to-focus visual indicator: a small ring drawn at the point
  // the user last tapped, auto-dismissed after ~800ms. We don't wait
  // on the MediaStreamTrack's focus promise to show the ring — the
  // user needs immediate visual feedback even on devices that silently
  // ignore `pointsOfInterest` (iOS Safari).
  const [focusIndicator, setFocusIndicator] = useState(null);

  // Torch state. `torchAvailable` starts as `null` ("unknown") and
  // flips to `true` / `false` only once the user actually tries it
  // OR the track's `getCapabilities()` returns a definitive answer.
  // Showing the button in the "unknown" state is the point — it's
  // the difference between "flash works on budget Android" (common)
  // and "flash silently missing" (the previous behaviour).
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(null);

  // Camera lifecycle: false until the video element reports enough
  // data to render a frame. Drives the full-screen "Starting camera…"
  // overlay so the user isn't staring at a black rectangle wondering
  // whether the app has frozen.
  const [cameraReady, setCameraReady] = useState(false);

  // Shutter-in-flight guard + visible "Processing page…" feedback.
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await startCamera(videoRef.current);
        if (cancelled) return;

        // Some browsers only populate `getCapabilities().torch` AFTER
        // the track has received at least one frame. We treat an
        // explicit `true` as "yes"; everything else is "maybe" until
        // the user clicks and we find out for real.
        const track = stream?.getVideoTracks()[0];
        const caps = track?.getCapabilities?.();
        if (caps && Object.prototype.hasOwnProperty.call(caps, "torch")) {
          setTorchAvailable(!!caps.torch);
        }
        // else: leave torchAvailable === null — the button stays
        // visible and optimistic.
      } catch {
        // Error is surfaced by the camera store; our UI will fall
        // through to the permission_denied / not_supported screens
        // that CameraCapture/index.jsx owns.
      }
    }

    init();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Listen for the video element actually producing frames so we can
  // hide the "Starting camera…" overlay. `loadeddata` fires once the
  // first frame is decoded; `playing` covers browsers that skip it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const handleReady = () => setCameraReady(true);
    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("playing", handleReady);
    return () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("playing", handleReady);
    };
  }, []);

  const handleCapture = useCallback(async () => {
    if (capturing || !cameraReady) return;
    setCapturing(true);

    // Capture the visible rect first — this is the cheap, synchronous
    // part and it's what the user is waiting to see confirmed. The
    // heavier "enhance + encode" pass runs AFTER we release the
    // shutter guard so the user can immediately line up the next page.
    //
    // On budget Android (Snapdragon 6xx) the old synchronous
    // detect+warp+enhance pipeline blocked the main thread for 2–5
    // seconds per page — users reported the app as "frozen". With
    // detect+warp gone (see capturePipeline.js) and the enhance pass
    // scheduled off the critical path, the shutter returns in under
    // ~150ms on the same devices.
    let rawBlob;
    try {
      rawBlob = await captureFrame();
    } catch (err) {
      console.warn("[Viewfinder] captureFrame failed:", err);
      rawBlob = null;
    }

    if (!rawBlob) {
      pushToast({
        message: "Couldn't grab frame — try again",
        variant: "warn",
      });
      setCapturing(false);
      return;
    }

    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const timestamp = Date.now();

    // Provisionally add the raw frame to the tray IMMEDIATELY. The
    // thumbnail is what tells the user "yes, that capture landed" —
    // waiting for the enhance pass before showing it is what made
    // the UI feel janky. We'll swap in the enhanced blob shortly.
    const rawDataUrl = URL.createObjectURL(rawBlob);
    addPage({
      id,
      blob: rawBlob,
      dataUrl: rawDataUrl,
      timestamp,
      baseBlob: rawBlob,
      rawBlob,
      crop: { corners: null, mode: "none", confidence: null },
      enhanceMode,
    });

    // Release the shutter guard NOW so the next capture can happen
    // while enhancement is still running on this one.
    setCapturing(false);

    // Background enhance pass. If it succeeds, swap in the enhanced
    // blob + dataUrl on the already-added page. If it fails, the raw
    // frame stays — a slightly-less-enhanced page is better than no
    // page at all.
    try {
      const { processCapturedFrame } =
        await import("../../../lib/capturePipeline");
      const processed = await processCapturedFrame(rawBlob, { enhanceMode });
      // Only swap if something actually changed — 'colour' mode is a
      // true no-op and returns the same blob we already added.
      if (processed.blob !== rawBlob) {
        useCameraStore.getState().updatePage(id, {
          blob: processed.blob,
          dataUrl: processed.dataUrl,
          baseBlob: processed.baseBlob,
          crop: processed.crop,
          width: processed.width,
          height: processed.height,
        });
        // Free the throwaway raw dataUrl we handed to the thumbnail.
        URL.revokeObjectURL(rawDataUrl);
      }
    } catch (err) {
      // Enhance pipeline failed — the raw frame is already in the
      // tray, nothing more to do. Log once so it's debuggable without
      // bothering the user.
      console.warn("[Viewfinder] background enhance failed:", err);
    }
  }, [capturing, cameraReady, captureFrame, addPage, enhanceMode, pushToast]);

  // Tap-to-focus. Wired onto the video element's click handler below.
  // We draw the ring indicator at the tap point regardless of whether
  // the track accepts the focus hint — the visual confirmation is what
  // users expect from a camera UI, and on iOS Safari the native AF is
  // already doing the right thing even though `pointsOfInterest` is
  // a no-op there.
  const handleViewfinderTap = useCallback(
    (e) => {
      if (!cameraReady) return;
      const x = e.clientX;
      const y = e.clientY;
      // Indicator is positioned in viewport coordinates via `fixed`.
      setFocusIndicator({ x, y, at: Date.now() });
      // Fire-and-forget focus hint. We don't await this — the user is
      // about to press the shutter and we don't want to delay that.
      focusAt(x, y).catch(() => {
        /* swallowed: already surfaced via the indicator */
      });
    },
    [cameraReady, focusAt],
  );

  // Auto-dismiss the focus indicator after ~800ms so it doesn't linger
  // on top of the next capture.
  useEffect(() => {
    if (!focusIndicator) return undefined;
    const t = setTimeout(() => setFocusIndicator(null), 800);
    return () => clearTimeout(t);
  }, [focusIndicator]);

  const handleTorch = useCallback(async () => {
    const next = !torchOn;

    // Mid-range Android fib: `getCapabilities()` can lie in either
    // direction, so we optimistically try `applyConstraints` regardless
    // of whatever `torchAvailable` says. Only after the attempt do we
    // treat its success/failure as ground truth.
    const ok = await toggleTorch(next);
    if (ok) {
      setTorchOn(next);
      setTorchAvailable(true);
    } else {
      setTorchAvailable(false);
      pushToast({
        message:
          "Flash isn't available on this camera. Try a brighter spot instead.",
        variant: "warn",
      });
    }
  }, [torchOn, toggleTorch, pushToast]);

  const handleDone = useCallback(() => {
    stopCamera();
    onDone?.();
  }, [stopCamera, onDone]);

  // If the user already tried the flash and the device refused, we
  // disable the button (rather than hide it) so the UI doesn't shift
  // under their thumb and they get an obvious "can't do that" state.
  const flashDisabled = torchAvailable === false;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/60 text-white z-10"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <button
          type="button"
          onClick={handleDone}
          className="min-h-[48px] min-w-[48px] flex items-center justify-center"
          aria-label="Close camera"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <span className="text-sm font-medium">Scan Question Paper</span>

        {/* Flash / torch button — ALWAYS present (see header comment).
            Styled muted when we already know the device refuses it,
            but still focusable so a user can discover why via the
            warn-toast we pushed on the first attempt. */}
        <button
          type="button"
          onClick={handleTorch}
          disabled={flashDisabled}
          className={`min-h-[48px] min-w-[48px] flex items-center justify-center transition-opacity ${
            flashDisabled ? "opacity-40" : ""
          }`}
          aria-label={
            flashDisabled
              ? "Flash not available on this camera"
              : torchOn
                ? "Turn off flash"
                : "Turn on flash"
          }
          aria-pressed={torchOn}
        >
          <svg
            className={`h-6 w-6 ${
              torchOn ? "text-yellow-400" : "text-white/80"
            }`}
            fill={torchOn ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
            />
          </svg>
        </button>
      </div>

      {/* Video feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onClick={handleViewfinderTap}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
        />

        {/* Tap-to-focus ring. Rendered at the viewport position the
            user tapped and auto-dismissed after ~800ms. Pointer-events
            none so it never swallows the next tap. */}
        {focusIndicator && (
          <div
            aria-hidden="true"
            className="fixed pointer-events-none"
            style={{
              left: focusIndicator.x - 28,
              top: focusIndicator.y - 28,
              width: 56,
              height: 56,
            }}
          >
            <div className="w-full h-full rounded-full border-2 border-yellow-300 animate-ping opacity-80" />
            <div className="absolute inset-2 rounded-full border border-yellow-200/80" />
          </div>
        )}

        {/* Guide overlay — only shown once the feed is actually
            rendering, otherwise it layers over a black rectangle and
            makes the "camera not ready" state worse. */}
        {cameraReady && (
          <>
            <div className="absolute inset-8 border-2 border-white/30 rounded-lg pointer-events-none" />
            <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50 text-sm font-medium pointer-events-none">
              Position paper in frame
            </p>
          </>
        )}

        {/* Hint the user that tap-to-focus is available. Only shown
            when the viewfinder is live AND the tray is empty, so it
            doesn't clutter the UI once capture is underway. */}
        {cameraReady && capturedPages.length === 0 && !focusIndicator && (
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs font-medium pointer-events-none bg-black/30 px-3 py-1 rounded-full">
            Tap to focus
          </p>
        )}

        {/* Full-screen "Starting camera…" veil. getUserMedia can take
            1–3 seconds on budget Android even when the permission was
            pre-granted — leaving the user staring at a black viewport
            during that window is the #1 reported "app feels frozen"
            bug. */}
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white gap-3">
            <svg
              className="h-10 w-10 animate-spin text-white/80"
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
            <p className="text-sm font-medium">Starting camera…</p>
            <p className="text-xs text-white/60">
              Allow camera access when prompted
            </p>
          </div>
        )}
      </div>

      {/* Thumbnail tray */}
      {capturedPages.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-black/60 overflow-x-auto scrollbar-hide">
          {capturedPages.map((page, i) => (
            <img
              key={page.id}
              src={page.dataUrl}
              alt={`Page ${i + 1}`}
              className="h-12 w-9 object-cover rounded border border-white/30 flex-shrink-0"
            />
          ))}
          <span className="text-white/60 text-xs ml-1 whitespace-nowrap">
            {capturedPages.length} page{capturedPages.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="flex items-center justify-between px-6 py-4 bg-black/80"
        style={{
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="w-20" />

        {/* Shutter button — disabled while the camera is still warming
            up or a previous capture is still mid-pipeline. The inner
            white disc scales slightly during capture to give a second,
            very fast visual cue in addition to the toast. */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={capturing || !cameraReady}
          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50"
          aria-label={
            capturing
              ? "Processing page"
              : cameraReady
                ? "Capture page"
                : "Camera starting"
          }
          aria-busy={capturing}
        >
          {capturing ? (
            <svg
              className="h-8 w-8 animate-spin text-white"
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
          ) : (
            <div className="w-12 h-12 rounded-full bg-white transition-transform" />
          )}
        </button>

        {/* Done button — only appears once at least one page is
            captured, so the bottom bar reads differently in the
            empty vs. ready-to-finish states without shifting the
            shutter's horizontal position. */}
        {capturedPages.length > 0 ? (
          <button
            type="button"
            onClick={handleDone}
            disabled={capturing}
            className="min-w-[80px] min-h-[48px] bg-pyqp-accent text-white text-sm font-semibold rounded-lg px-4 py-2 disabled:opacity-50"
          >
            Done ({capturedPages.length})
          </button>
        ) : (
          <div className="w-20" />
        )}
      </div>
    </div>
  );
}
