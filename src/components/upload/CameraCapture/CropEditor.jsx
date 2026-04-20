import { useRef, useEffect, useState, useCallback } from "react";

/**
 * CropEditor — Phase 8 manual crop UI
 *
 * Lets the user drag four corner handles over the source image to fix
 * a misdetected (or undetected) paper quad. The warped preview updates
 * live ≤ 100ms after each drag.
 *
 * Invariants (CLAUDE.md §5A "Manual Crop"):
 *   - Each corner handle is ≥ 44×44px in source-image coordinates, which
 *     we also ensure translates to ≥ 44 CSS px on the canvas regardless
 *     of the rendered width.
 *   - Live preview is rendered to a canvas (NOT an <img src=bitmap>,
 *     which is invalid — ImageBitmap is not a URL). Avoids the subtle
 *     memory leak of generating blob URLs per drag frame.
 *   - `warpToRect` and any future snap-to-edge heavy work are loaded
 *     via dynamic import so this component and its transitive deps
 *     never bulk up the main chunk.
 *   - Reset-to-auto / reset-to-full buttons are always reachable.
 *
 * Props:
 *   imageBitmap    — ImageBitmap of the raw (pre-warp) camera frame.
 *   initialCorners — [[tl], [tr], [br], [bl]] in imageBitmap coords.
 *   onSave(corners) — called with the user's chosen corners.
 *   onCancel()     — called to dismiss the editor without saving.
 */
export default function CropEditor({
  imageBitmap,
  initialCorners,
  onSave,
  onCancel,
}) {
  const sourceCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);

  const [corners, setCorners] = useState(initialCorners);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [loading, setLoading] = useState(false);

  // Cache of dynamic-imported modules so we don't re-import on every
  // drag frame or preview update.
  const modsRef = useRef({ detect: null, warp: null });

  const width = imageBitmap.width;
  const height = imageBitmap.height;

  // 44px tap-target (CLAUDE.md §21 invariant for mobile) expressed in
  // *source-image* pixels. We want the on-screen handle to be ≥ 44
  // CSS px, so we compute the scale factor from canvas.width (source
  // coords) → canvas.clientWidth (CSS px) and size the handle
  // accordingly. `handleSizeSrc` is what we draw with; `handleHitSrc`
  // is how close a tap must land to the corner to be counted.
  const handleSizeCssPx = 44;
  const [handleSizeSrc, setHandleSizeSrc] = useState(44);
  const [handleHitSrc, setHandleHitSrc] = useState(44);

  // ── Load the source image into the background canvas once. ─────────
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(imageBitmap, 0, 0);
  }, [imageBitmap, width, height]);

  // ── Redraw the overlay (quad edges + corner handles) ─────────────
  // any time the corners or the dragging state change. We redraw the
  // image each time too so stale handle positions don't linger.
  useEffect(() => {
    const canvas = sourceCanvasRef.current;
    if (!canvas || !corners) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(imageBitmap, 0, 0);

    // Quad outline.
    ctx.strokeStyle = "rgba(66, 185, 255, 0.95)";
    ctx.lineWidth = Math.max(2, handleSizeSrc / 14);
    ctx.beginPath();
    ctx.moveTo(corners[0][0], corners[0][1]);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(corners[i][0], corners[i][1]);
    }
    ctx.closePath();
    ctx.stroke();

    // Corner handles — square, high-contrast, ≥ 44 CSS px.
    corners.forEach((corner, idx) => {
      const [cx, cy] = corner;
      const half = handleSizeSrc / 2;
      ctx.fillStyle =
        idx === draggingIdx
          ? "rgba(66, 185, 255, 1)"
          : "rgba(66, 185, 255, 0.85)";
      ctx.fillRect(cx - half, cy - half, handleSizeSrc, handleSizeSrc);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(2, handleSizeSrc / 18);
      ctx.strokeRect(cx - half, cy - half, handleSizeSrc, handleSizeSrc);
    });
  }, [corners, width, height, imageBitmap, draggingIdx, handleSizeSrc]);

  // ── Keep the source-pixel handle size proportional to the actual
  // rendered width so hit-testing stays accurate after resize or
  // orientation change.
  useEffect(() => {
    const update = () => {
      const canvas = sourceCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      const scale = canvas.width / rect.width; // srcPx per cssPx
      setHandleSizeSrc(Math.max(12, handleSizeCssPx * scale));
      // Hit region is intentionally a bit larger than the visible handle
      // so thumbs on small screens don't need pixel-perfect aim.
      setHandleHitSrc(Math.max(22, handleSizeCssPx * 1.2 * scale));
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  // ── Lazy-load the warp module exactly once. detectPaperQuad is only
  // pulled in if/when the user taps "Reset to Auto" — it's not on the
  // hot path of the editor. ─────────────────────────────────────────
  const getWarp = useCallback(async () => {
    if (!modsRef.current.warp) {
      modsRef.current.warp = await import("../../../lib/perspectiveWarp");
    }
    return modsRef.current.warp;
  }, []);
  const getDetect = useCallback(async () => {
    if (!modsRef.current.detect) {
      modsRef.current.detect = await import("../../../lib/documentDetect");
    }
    return modsRef.current.detect;
  }, []);

  // ── Debounced live preview. We paint the warped ImageBitmap to a
  // dedicated preview canvas; the old code set an ImageBitmap as an
  // <img src=…>, which doesn't work.
  useEffect(() => {
    if (!corners) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { warpToRect } = await getWarp();
        const warped = await warpToRect(imageBitmap, corners);
        if (cancelled) return;

        const previewCanvas = previewCanvasRef.current;
        if (!previewCanvas) return;
        previewCanvas.width = warped.width;
        previewCanvas.height = warped.height;
        const pctx = previewCanvas.getContext("2d");
        if (!pctx) return;
        pctx.drawImage(warped, 0, 0);
      } catch (e) {
        if (!cancelled) {
          console.warn("[CropEditor] preview failed:", e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // ≤ 100ms update target per CLAUDE.md §5A.
    const timer = setTimeout(run, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [corners, imageBitmap, getWarp]);

  // ── Pointer → source-image coordinate translation. Works for both
  // mouse and touch because the Pointer Events API unifies them. ───
  const eventToSourceCoords = useCallback((event) => {
    const canvas = sourceCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const clientX = event.clientX ?? event.touches?.[0]?.clientX;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY;
    if (clientX == null || clientY == null) return null;
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return [x, y];
  }, []);

  // Clamp a corner to image bounds so the user can't drag a handle
  // into negative space (where subsequent detection/warp math would
  // misbehave).
  const clampToImage = useCallback(
    (pt) => [
      Math.max(0, Math.min(width - 1, pt[0])),
      Math.max(0, Math.min(height - 1, pt[1])),
    ],
    [width, height],
  );

  // Optional snap-to-edge: if the dragged corner is within 20 CSS px
  // of a nearby strong image gradient, nudge it onto that gradient.
  // For this milestone we implement a lightweight version that snaps
  // to the nearest image boundary only — it's genuinely useful for
  // papers photographed against a plain background and cheap enough
  // to run on every drag frame. Full Sobel-based snap is listed as a
  // future refinement in ROADMAP §8.2.
  const maybeSnap = useCallback(
    (pt) => {
      const snapRadius = Math.max(6, 20 * (handleHitSrc / 44));
      const out = [pt[0], pt[1]];
      if (out[0] < snapRadius) out[0] = 0;
      if (out[1] < snapRadius) out[1] = 0;
      if (width - out[0] < snapRadius) out[0] = width - 1;
      if (height - out[1] < snapRadius) out[1] = height - 1;
      return out;
    },
    [width, height, handleHitSrc],
  );

  const handlePointerDown = useCallback(
    (event) => {
      event.preventDefault();
      const pt = eventToSourceCoords(event);
      if (!pt || !corners) return;

      // Find the corner closest to the pointer within the hit region.
      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < 4; i++) {
        const [cx, cy] = corners[i];
        const d = Math.hypot(pt[0] - cx, pt[1] - cy);
        if (d < handleHitSrc && d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) return;

      // Capture the pointer so we keep receiving move events even if
      // the pointer slides off the canvas.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Some browsers reject setPointerCapture on synthetic events;
        // we still receive the subsequent move events on the window.
      }
      setDraggingIdx(bestIdx);
    },
    [corners, eventToSourceCoords, handleHitSrc],
  );

  const handlePointerMove = useCallback(
    (event) => {
      if (draggingIdx == null) return;
      const pt = eventToSourceCoords(event);
      if (!pt) return;
      const next = clampToImage(maybeSnap(pt));
      setCorners((prev) => {
        if (!prev) return prev;
        const out = prev.slice();
        out[draggingIdx] = next;
        return out;
      });
    },
    [draggingIdx, eventToSourceCoords, clampToImage, maybeSnap],
  );

  const handlePointerUp = useCallback(
    (event) => {
      if (draggingIdx == null) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Same as above — releasing may throw in some environments.
      }
      setDraggingIdx(null);
    },
    [draggingIdx],
  );

  // ── Reset buttons ────────────────────────────────────────────────
  // Declared in this order (full → auto) so the async auto-reset can
  // cleanly fall back to full-frame without tripping TDZ / linter
  // rules on hoisted-but-uninitialised variables.
  const handleResetFull = useCallback(() => {
    setCorners([
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ]);
  }, [width, height]);

  const handleResetAuto = useCallback(async () => {
    try {
      const { detectPaperQuad } = await getDetect();
      const result = await detectPaperQuad(imageBitmap);
      if (result && result.corners && result.confidence >= 0.6) {
        setCorners(result.corners);
      } else {
        // No trustworthy detection; fall back to full-frame so the
        // user still gets a visible, predictable reset.
        handleResetFull();
      }
    } catch (e) {
      console.warn("[CropEditor] reset-to-auto failed:", e);
      handleResetFull();
    }
  }, [getDetect, imageBitmap, handleResetFull]);

  const handleSave = useCallback(() => {
    if (!corners) return;
    onSave?.(corners);
  }, [corners, onSave]);

  return (
    <div ref={containerRef} className="flex flex-col gap-3">
      {/* Source canvas with draggable handles — wrapped so we can
          attach pointer events and set touch-action: none to prevent
          the browser's own pan gestures from stealing the drag. */}
      <div className="relative w-full bg-black rounded overflow-hidden">
        <canvas
          ref={sourceCanvasRef}
          className="block w-full h-auto select-none cursor-grab"
          style={{
            maxHeight: "50vh",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>

      {/* Live preview — painted directly to canvas (not an <img>)
          because ImageBitmap is not a URL. */}
      <div className="relative w-full bg-black rounded overflow-hidden">
        <div className="absolute top-0 left-0 z-10 text-xs text-white/80 px-2 py-1 bg-black/60">
          ✨ Preview
        </div>
        <canvas
          ref={previewCanvasRef}
          className="block w-full h-auto"
          style={{ maxHeight: "40vh" }}
          aria-label="Cropped paper preview"
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-white text-xs font-medium">Updating…</div>
          </div>
        )}
      </div>

      {/* Reset buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleResetAuto}
          className="flex-1 px-4 py-3 text-sm font-medium bg-gray-100 text-pyqp-text rounded hover:bg-gray-200 transition min-h-[44px]"
        >
          Reset to Auto
        </button>
        <button
          type="button"
          onClick={handleResetFull}
          className="flex-1 px-4 py-3 text-sm font-medium bg-gray-100 text-pyqp-text rounded hover:bg-gray-200 transition min-h-[44px]"
        >
          Full Frame
        </button>
      </div>

      {/* Save / Cancel */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-3 text-sm font-medium border border-pyqp-border text-pyqp-text rounded hover:bg-gray-50 transition min-h-[48px]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-4 py-3 text-sm font-semibold bg-pyqp-accent text-white rounded hover:bg-pyqp-accent-hover transition min-h-[48px]"
        >
          Save Crop
        </button>
      </div>

      <p className="text-xs text-pyqp-muted text-center px-2">
        Drag the corners to fit the paper edges. Preview updates live.
      </p>
    </div>
  );
}
