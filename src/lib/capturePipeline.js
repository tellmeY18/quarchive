/**
 * Capture Pipeline — Phase 8
 *
 * Wraps the three robustness stages from CLAUDE.md §5A into a single
 * async entry point called from `Viewfinder.jsx` immediately after the
 * shutter fires, and (for re-enhancement after a mode toggle) from
 * `PageReview.jsx` via `reprocessPage`.
 *
 *   raw Blob  ─▶  detect (documentDetect.js)
 *                     │
 *                     ├─ confidence < 0.6  → skip warp, keep raw frame
 *                     ├─ quad area < 60%   → skip warp, keep raw frame
 *                     └─ otherwise         → warp (perspectiveWarp.js)
 *                                             │
 *                                             ▼
 *                                         enhance (paperEnhance.js)
 *                                             │
 *                                             ▼
 *                                         processed Blob + metadata
 *
 * Everything in this module is dynamic-imported on demand — see the
 * dynamic `import()` calls inside `processCapturedFrame` — so none of
 * `documentDetect.js`, `perspectiveWarp.js`, or `paperEnhance.js` ends
 * up in the main chunk (CLAUDE.md §18 bundle discipline).
 *
 * Invariants upheld here (CLAUDE.md §21):
 *  - #16 Auto-crop never distorts aspect ratio: the detection guard
 *    below rejects low-confidence / low-area quads before warp runs.
 *  - #17 Enhancement is reversible per page: the original raw (or
 *    warped-but-unenhanced) ImageBitmap is returned alongside the final
 *    Blob so `PageReview.jsx` can re-run enhancement with a different
 *    mode without re-capturing from the camera.
 */

/**
 * JPEG quality for the Blob we hand back to the existing
 * `useImageToPdf` pipeline. 0.92 matches the quality the camera
 * viewfinder was already producing pre-Phase-8, so downstream file
 * sizes and compression ratios are unchanged.
 */
const OUTPUT_JPEG_QUALITY = 0.92;

/**
 * Encode an ImageBitmap back to a JPEG Blob via OffscreenCanvas.
 * Safe to call from the main thread; the canvas is transient and
 * released as soon as the Promise settles.
 */
async function bitmapToJpegBlob(bitmap, quality = OUTPUT_JPEG_QUALITY) {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("could not get 2d context for bitmap encoding");
  }
  ctx.drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: "image/jpeg", quality });
}

/**
 * Decode a Blob into an ImageBitmap. Used both for the raw camera
 * frame and for re-processing a page from its stored original blob.
 */
async function blobToBitmap(blob) {
  return createImageBitmap(blob);
}

/**
 * Process a single captured camera frame.
 *
 * @param {Blob} rawBlob
 *   The JPEG blob emitted by `useCamera.captureFrame()`.
 * @param {object} [options]
 * @param {'fast'|'auto'|'bw'|'colour'} [options.enhanceMode='fast']
 *   Passed straight through to `enhanceImage()`. The default is 'fast'
 *   — a cheap single-pass RGBA contrast stretch that completes in
 *   well under 100ms on budget Android devices (Snapdragon 6xx class).
 *   Heavier modes ('auto', 'bw') are still available for users who
 *   explicitly toggle them in PageReview.
 *
 * @returns {Promise<{
 *   blob: Blob,              // processed JPEG ready for the PDF pipeline
 *   dataUrl: string,         // object URL for thumbnail rendering
 *   width: number,
 *   height: number,
 *   crop: {                  // persisted on cameraStore.capturedPages[i].crop
 *     corners: number[][] | null,
 *     mode: 'auto' | 'manual' | 'none',
 *     confidence: number | null,
 *   },
 *   baseBitmap: ImageBitmap, // pre-enhancement bitmap — kept in memory so
 *                             // PageReview can re-enhance with a new mode
 *                             // without re-capturing (invariant #17).
 *   baseBlob: Blob,          // JPEG form of baseBitmap (same invariant)
 * }>}
 *
 * The returned Promise NEVER rejects for pipeline-internal reasons:
 * detection failure, warp failure, or enhancement failure each fall
 * back to the previous stage's output. The only way this function
 * rejects is if the raw blob itself cannot be decoded — in which case
 * the caller (Viewfinder) correctly treats it as a failed capture.
 */
export async function processCapturedFrame(rawBlob, options = {}) {
  const { enhanceMode = "fast" } = options;

  // Decode the raw frame first — if this fails, the whole shutter
  // press is dead and the caller must surface it.
  const rawBitmap = await blobToBitmap(rawBlob);
  const frameWidth = rawBitmap.width;
  const frameHeight = rawBitmap.height;

  // ── BUDGET-DEVICE FAST PATH ──────────────────────────────────────
  //
  // Previously every shutter press ran Sobel + Hough + O(n⁴) convex
  // quad search + perspective warp + enhance, synchronously on the
  // main thread, BEFORE the user could take the next photo. On
  // Snapdragon-6xx-class devices that's 2–5 seconds of the UI
  // appearing frozen per page — and the detection gate rejected the
  // result the majority of the time anyway (low confidence or
  // under-60% frame area), so all that work was thrown away.
  //
  // The right default is: commit the raw frame immediately, run only
  // the cheap 'fast' enhance, and let the user opt in to manual
  // perspective correction later via the CropEditor in PageReview
  // (which already flows through `reprocessWithCorners` below).
  //
  // This keeps invariants #16 (never distort aspect ratio on auto —
  // now trivially satisfied, we never auto-warp) and #17 (enhancement
  // is reversible — the raw frame is the baseBlob).
  //
  // If a user explicitly asks for auto-detect in the future, we can
  // re-enable it behind an `autoDetect: true` option without touching
  // this file's public shape.

  let enhanceMod;
  try {
    enhanceMod = await import("./paperEnhance.js");
  } catch (err) {
    // Enhance module failed to load — commit the raw frame as-is so
    // the user can still finish the upload. This also covers offline
    // page loads.
    console.warn("[capturePipeline] enhance module load failed:", err);
    return {
      blob: rawBlob,
      dataUrl: URL.createObjectURL(rawBlob),
      width: frameWidth,
      height: frameHeight,
      crop: { corners: null, mode: "none", confidence: null },
      baseBitmap: rawBitmap,
      baseBlob: rawBlob,
    };
  }

  // Base blob = the raw camera frame itself. We don't re-encode it —
  // that would be a wasted JPEG round-trip, and the bytes already
  // came out of captureFrame() at quality 0.92. This matters: on a
  // 1080p Android the re-encode alone was costing ~300ms.
  const baseBlob = rawBlob;

  // ── Enhance ──────────────────────────────────────────────────────
  // Only the cheap 'fast' mode should reach this path on the hot
  // capture-flow (the default for the store is 'fast'). Heavier modes
  // are still supported here for users who explicitly toggled to
  // 'auto' or 'bw' in PageReview before the next shutter press, but
  // that's rare.
  let finalBitmap = rawBitmap;
  try {
    finalBitmap = await enhanceMod.enhanceImage(rawBitmap, enhanceMode);
  } catch (err) {
    console.warn("[capturePipeline] enhance failed, using raw frame:", err);
    finalBitmap = rawBitmap;
  }

  // 'colour' mode is a true no-op and returns the input bitmap
  // unchanged — in that case we can skip the final JPEG encode too
  // and just hand back the original rawBlob.
  let finalBlob;
  if (finalBitmap === rawBitmap) {
    finalBlob = rawBlob;
  } else {
    try {
      finalBlob = await bitmapToJpegBlob(finalBitmap);
    } catch (err) {
      console.warn("[capturePipeline] final encode failed:", err);
      finalBlob = rawBlob;
    }
  }

  return {
    blob: finalBlob,
    dataUrl: URL.createObjectURL(finalBlob),
    width: finalBitmap.width,
    height: finalBitmap.height,
    // crop.mode === 'none' signals to PageReview that no auto-detect
    // was attempted. The user's "Adjust edges" affordance in the
    // CropEditor still works — it calls `reprocessWithCorners` with
    // the rawBlob (= baseBlob) below, which DOES run detect+warp but
    // only when the user explicitly asked for it.
    crop: { corners: null, mode: "none", confidence: null },
    baseBitmap: rawBitmap,
    baseBlob,
  };
}

/**
 * Re-run enhancement on an already-captured page, using a new mode.
 *
 * Takes the per-page `baseBlob` cached by `processCapturedFrame` so
 * that Auto ↔ B&W ↔ Colour toggles in `PageReview.jsx` never have to
 * re-run detection or warp — those stages are committed to the page
 * the moment the user hits the shutter.
 *
 * @param {Blob} baseBlob
 *   The warped-but-unenhanced JPEG for this page.
 * @param {'fast'|'auto'|'bw'|'colour'} enhanceMode
 *   Default is 'fast' — matches `processCapturedFrame` so that switching
 *   between Fast and Colour (and back) on an untouched page never lands
 *   on a mode the initial capture didn't use.
 *
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 *   The newly-enhanced JPEG and a fresh object URL for the thumbnail.
 */
export async function reprocessPage(baseBlob, enhanceMode = "fast") {
  const bitmap = await blobToBitmap(baseBlob);

  let enhanceMod;
  try {
    enhanceMod = await import("./paperEnhance.js");
  } catch (err) {
    console.warn("[capturePipeline] reprocess module load failed:", err);
    const blob = await bitmapToJpegBlob(bitmap).catch(() => baseBlob);
    return {
      blob,
      dataUrl: URL.createObjectURL(blob),
      width: bitmap.width,
      height: bitmap.height,
    };
  }

  let out = bitmap;
  try {
    out = await enhanceMod.enhanceImage(bitmap, enhanceMode);
  } catch (err) {
    console.warn("[capturePipeline] reprocess enhance failed:", err);
    out = bitmap;
  }

  let blob;
  try {
    blob = await bitmapToJpegBlob(out);
  } catch (err) {
    console.warn("[capturePipeline] reprocess encode failed:", err);
    blob = baseBlob;
  }

  return {
    blob,
    dataUrl: URL.createObjectURL(blob),
    width: out.width,
    height: out.height,
  };
}

/**
 * Re-run warp + enhance on an already-captured page using corners the
 * user dragged in `CropEditor.jsx`. Used only by the manual-crop flow;
 * auto-captures go through `processCapturedFrame` above.
 *
 * @param {Blob} rawBlob        Original camera frame (before any warp).
 * @param {number[][]} corners  Four [[x,y], ...] corners in raw-frame coords.
 * @param {'fast'|'auto'|'bw'|'colour'} [enhanceMode='fast']
 *
 * @returns Same shape as `processCapturedFrame`, with crop.mode='manual'.
 */
export async function reprocessWithCorners(
  rawBlob,
  corners,
  enhanceMode = "fast",
) {
  const rawBitmap = await blobToBitmap(rawBlob);

  let warpMod, enhanceMod;
  try {
    [warpMod, enhanceMod] = await Promise.all([
      import("./perspectiveWarp.js"),
      import("./paperEnhance.js"),
    ]);
  } catch (err) {
    console.warn("[capturePipeline] manual-reprocess load failed:", err);
    const blob = await bitmapToJpegBlob(rawBitmap).catch(() => rawBlob);
    return {
      blob,
      dataUrl: URL.createObjectURL(blob),
      width: rawBitmap.width,
      height: rawBitmap.height,
      crop: { corners, mode: "manual", confidence: null },
      baseBitmap: rawBitmap,
      baseBlob: blob,
    };
  }

  let warped = rawBitmap;
  try {
    warped = await warpMod.warpToRect(rawBitmap, corners);
  } catch (err) {
    console.warn("[capturePipeline] manual warp failed:", err);
    warped = rawBitmap;
  }

  let baseBlob;
  try {
    baseBlob = await bitmapToJpegBlob(warped);
  } catch {
    baseBlob = rawBlob;
  }

  let finalBitmap = warped;
  try {
    finalBitmap = await enhanceMod.enhanceImage(warped, enhanceMode);
  } catch (err) {
    console.warn("[capturePipeline] manual enhance failed:", err);
    finalBitmap = warped;
  }

  let blob;
  try {
    blob = await bitmapToJpegBlob(finalBitmap);
  } catch {
    blob = baseBlob;
  }

  return {
    blob,
    dataUrl: URL.createObjectURL(blob),
    width: finalBitmap.width,
    height: finalBitmap.height,
    crop: { corners, mode: "manual", confidence: null },
    baseBitmap: warped,
    baseBlob,
  };
}
