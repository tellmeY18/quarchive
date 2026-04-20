import { useRef, useCallback, useEffect } from "react";
import useCameraStore from "../store/cameraStore";

/**
 * useCamera — camera lifecycle + WYSIWYG capture + tap-to-focus
 *
 * Why this exists (as opposed to calling `getUserMedia` directly in the
 * Viewfinder):
 *
 *  1. **WYSIWYG capture.** The viewfinder renders the feed with
 *     `object-cover` so it always fills the screen. That means the
 *     browser is cropping the live video to the viewport — parts of
 *     the raw stream are off-screen. The old `captureFrame` grabbed
 *     the FULL `videoWidth × videoHeight` frame, so the saved JPEG
 *     contained strips the user never saw framed. Users reported
 *     this as "the preview and the final image look different".
 *     `captureFrame()` here replicates the `object-cover` math to
 *     crop the exact visible rect before encoding.
 *
 *  2. **Tap-to-focus.** Budget Android phones hold whatever focus
 *     they acquired when the stream started. For a paper held 20cm
 *     from the lens that's usually "infinity" and the text is
 *     unreadable. `focusAt(clientX, clientY)` translates a viewport
 *     tap into normalised (0..1) track coordinates and pushes a
 *     `pointsOfInterest` constraint — the W3C-standard focus-nudge
 *     that works on every modern Android and is silently ignored on
 *     iOS (which does its own autofocus well enough).
 *
 *  3. **Continuous autofocus by default.** Where the track supports
 *     it, we set `focusMode: 'continuous'` at stream-start. Combined
 *     with (2) this covers almost every real-world capture.
 *
 *  4. **Torch still works through `applyConstraints`** — some
 *     Chromium forks report `torch: undefined` in `getCapabilities`
 *     but accept the constraint anyway, so we stay optimistic.
 *
 *  5. **Stream lifecycle.** Always stopped on unmount (CLAUDE.md
 *     invariant #9).
 */
export default function useCamera() {
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const trackRef = useRef(null);

  const setCameraError = useCameraStore((s) => s.setCameraError);

  const startCamera = useCallback(
    async (videoElement) => {
      videoRef.current = videoElement;

      // Constraints tuned for paper capture:
      //   - rear camera (environment)
      //   - 1920×1080 ideal — gives enough resolution for OCR of small
      //     body text without asking every budget phone for 4K (which
      //     blows memory on the enhancement pass).
      //   - continuous autofocus as a hint. Most Android browsers
      //     silently accept this advanced constraint; iOS ignores it
      //     (iOS does continuous AF natively anyway).
      const constraints = {
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: "continuous" }],
        },
        audio: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        trackRef.current = stream.getVideoTracks()[0] || null;
        if (videoElement) {
          videoElement.srcObject = stream;
        }
        setCameraError(null);
        return stream;
      } catch (err) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setCameraError("permission_denied");
        } else {
          setCameraError("not_supported");
        }
        throw err;
      }
    },
    [setCameraError],
  );

  /**
   * Compute the rectangle of the raw video frame that is actually
   * visible on screen given CSS `object-fit: cover`.
   *
   * Returns a rect in video-native pixels: `{ sx, sy, sw, sh }`.
   * Falls back to the full frame when we don't have a rendered element
   * yet (first-shutter edge case).
   */
  const getVisibleCropRect = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // The element's rendered size. clientWidth/Height exclude borders
    // which is what we want — `object-cover` lives inside the content
    // box.
    const cw = video.clientWidth || vw;
    const ch = video.clientHeight || vh;

    // `object-cover`: uniform scale to cover the container, crop the
    // rest. We invert that to find the sub-rect of the raw frame that
    // is visible.
    const scale = Math.max(cw / vw, ch / vh);
    // In the limit of a perfectly-matching aspect, scale * vw = cw and
    // sw = vw (no crop). Otherwise one of the dimensions shrinks.
    const sw = Math.min(vw, Math.round(cw / scale));
    const sh = Math.min(vh, Math.round(ch / scale));
    const sx = Math.max(0, Math.round((vw - sw) / 2));
    const sy = Math.max(0, Math.round((vh - sh) / 2));
    return { sx, sy, sw, sh };
  }, []);

  /**
   * Grab a JPEG of exactly what the user saw in the viewfinder.
   *
   * Implementation note: we use a plain HTMLCanvasElement (not
   * OffscreenCanvas) because `drawImage(video, ...)` with the
   * source-rect overload is universally supported on canvas, whereas
   * OffscreenCanvas's support for video sources is still patchy on
   * older Samsung Internet / WebView builds we need to keep working.
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    const rect = getVisibleCropRect();
    if (!rect) return null;

    const canvas = document.createElement("canvas");
    canvas.width = rect.sw;
    canvas.height = rect.sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Source-rect overload of drawImage: crop the raw frame to the
    // visible region in a single GPU blit — no intermediate buffer.
    ctx.drawImage(
      video,
      rect.sx,
      rect.sy,
      rect.sw,
      rect.sh,
      0,
      0,
      rect.sw,
      rect.sh,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
    });
  }, [getVisibleCropRect]);

  /**
   * Nudge the camera to focus on a point in the viewport.
   *
   * @param {number} clientX — pageX-style coord relative to the viewport
   * @param {number} clientY — pageY-style coord relative to the viewport
   * @returns {Promise<boolean>} — true if the track accepted the hint
   *
   * We translate the viewport coords through the object-cover crop
   * rect so the focus point is in *raw-frame normalised* space (what
   * the MediaStreamTrack expects), even when the user tapped a pixel
   * in the cropped-off region.
   *
   * Silently returns false on browsers that don't support advanced
   * focus constraints (notably iOS Safari). The viewfinder treats
   * that as "OK, we tried" — the native AF is doing its job anyway.
   */
  const focusAt = useCallback(
    async (clientX, clientY) => {
      const track = trackRef.current;
      const video = videoRef.current;
      if (!track || !video) return false;

      const rectVisible = getVisibleCropRect();
      if (!rectVisible) return false;

      // Map viewport coords → element-local coords.
      const elRect = video.getBoundingClientRect();
      const localX = clientX - elRect.left;
      const localY = clientY - elRect.top;
      if (
        localX < 0 ||
        localY < 0 ||
        localX > elRect.width ||
        localY > elRect.height
      ) {
        return false;
      }

      // Element-local → visible-crop-rect normalised (0..1).
      const nxInCrop = localX / elRect.width;
      const nyInCrop = localY / elRect.height;

      // Visible-crop-rect normalised → raw-frame normalised. The
      // track's pointsOfInterest uses raw-frame-space coords.
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      const x = (rectVisible.sx + nxInCrop * rectVisible.sw) / vw;
      const y = (rectVisible.sy + nyInCrop * rectVisible.sh) / vh;

      // Clamp to the 0..1 interval — defensive against rounding.
      const cx = Math.min(1, Math.max(0, x));
      const cy = Math.min(1, Math.max(0, y));

      try {
        // Ask for single-shot focus at the point. A handful of
        // Chromium builds prefer `manual` here; we try `single-shot`
        // first (the specced value) and fall back on rejection.
        await track.applyConstraints({
          advanced: [
            {
              focusMode: "single-shot",
              pointsOfInterest: [{ x: cx, y: cy }],
            },
          ],
        });
        return true;
      } catch {
        try {
          await track.applyConstraints({
            advanced: [{ pointsOfInterest: [{ x: cx, y: cy }] }],
          });
          return true;
        } catch {
          return false;
        }
      }
    },
    [getVisibleCropRect],
  );

  const toggleTorch = useCallback(async (on) => {
    const track = trackRef.current;
    if (!track) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    trackRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Always stop on unmount — invariant #9 from CLAUDE.md.
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return { startCamera, captureFrame, focusAt, toggleTorch, stopCamera };
}
