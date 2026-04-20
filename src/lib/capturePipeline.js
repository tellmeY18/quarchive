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

/** Minimum detection confidence before we trust the quad for auto-crop. */
const MIN_CONFIDENCE = 0.6;

/**
 * Minimum fraction of the frame the detected quad must cover. Papers
 * held up to the camera with no other content usually take > 60% of
 * the frame; anything smaller is likely a stray rectangular feature
 * (a book on a desk, a window, etc.) and should be ignored.
 */
const MIN_AREA_FRACTION = 0.6;

/**
 * JPEG quality for the Blob we hand back to the existing
 * `useImageToPdf` pipeline. 0.92 matches the quality the camera
 * viewfinder was already producing pre-Phase-8, so downstream file
 * sizes and compression ratios are unchanged.
 */
const OUTPUT_JPEG_QUALITY = 0.92;

/**
 * Shoelace-formula area for a 4-point quad.
 * Accepts corners as [[x,y], [x,y], [x,y], [x,y]] in any winding order.
 */
function quadArea(corners) {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = corners[i];
    const [x2, y2] = corners[(i + 1) % 4];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

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
 * Decide whether a detection result is trustworthy enough to warp on.
 *
 * Returns the detection object if it passes the gate, or `null` if
 * the caller should fall back to the raw frame. Invariant #16 —
 * "a squished PDF is worse than an uncropped one".
 */
function gateDetection(detection, frameWidth, frameHeight) {
  if (!detection || !detection.corners || detection.corners.length !== 4) {
    return null;
  }
  if (typeof detection.confidence !== "number") {
    return null;
  }
  if (detection.confidence < MIN_CONFIDENCE) {
    return null;
  }
  const area = quadArea(detection.corners);
  const frameArea = frameWidth * frameHeight;
  if (frameArea <= 0) return null;
  if (area / frameArea < MIN_AREA_FRACTION) {
    return null;
  }
  return detection;
}

/**
 * Process a single captured camera frame.
 *
 * @param {Blob} rawBlob
 *   The JPEG blob emitted by `useCamera.captureFrame()`.
 * @param {object} [options]
 * @param {'auto'|'bw'|'colour'} [options.enhanceMode='auto']
 *   Passed straight through to `enhanceImage()`.
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
  const { enhanceMode = "auto" } = options;

  // Decode the raw frame first — if this fails, the whole shutter
  // press is dead and the caller must surface it.
  const rawBitmap = await blobToBitmap(rawBlob);
  const frameWidth = rawBitmap.width;
  const frameHeight = rawBitmap.height;

  // Dynamic imports — these libraries live outside the main bundle
  // and only load the first time the user takes a photo.
  let detectMod, warpMod, enhanceMod;
  try {
    [detectMod, warpMod, enhanceMod] = await Promise.all([
      import("./documentDetect.js"),
      import("./perspectiveWarp.js"),
      import("./paperEnhance.js"),
    ]);
  } catch (err) {
    // Loading the pipeline modules failed — most likely an offline
    // page load or a CDN hiccup. Commit the raw frame so the user
    // can still finish their upload.
    console.warn("[capturePipeline] module load failed:", err);
    const blob = await bitmapToJpegBlob(rawBitmap).catch(() => rawBlob);
    return {
      blob,
      dataUrl: URL.createObjectURL(blob),
      width: frameWidth,
      height: frameHeight,
      crop: { corners: null, mode: "none", confidence: null },
      baseBitmap: rawBitmap,
      baseBlob: blob,
    };
  }

  // ── Stage 1: detect ──────────────────────────────────────────────
  let detection = null;
  try {
    detection = await detectMod.detectPaperQuad(rawBitmap);
  } catch (err) {
    console.warn("[capturePipeline] detect failed:", err);
    detection = null;
  }
  const trustedDetection = gateDetection(detection, frameWidth, frameHeight);

  // ── Stage 2: warp (only if detection is trustworthy) ─────────────
  let warpedBitmap = rawBitmap;
  let cropCorners = null;
  let cropConfidence = null;
  let cropMode = "none";
  if (trustedDetection) {
    try {
      warpedBitmap = await warpMod.warpToRect(
        rawBitmap,
        trustedDetection.corners,
      );
      cropCorners = trustedDetection.corners;
      cropConfidence = trustedDetection.confidence;
      cropMode = "auto";
    } catch (err) {
      console.warn("[capturePipeline] warp failed, using raw frame:", err);
      warpedBitmap = rawBitmap;
      cropMode = "none";
    }
  }

  // Capture the base (warped-but-unenhanced) bitmap + blob before
  // enhancement runs. `PageReview.jsx` needs this to let the user flip
  // between Auto / B&W / Colour without re-opening the camera
  // (invariant #17 — enhancement is reversible per page).
  let baseBlob;
  try {
    baseBlob = await bitmapToJpegBlob(warpedBitmap);
  } catch (err) {
    console.warn("[capturePipeline] base encode failed:", err);
    baseBlob = rawBlob;
  }

  // ── Stage 3: enhance ─────────────────────────────────────────────
  let finalBitmap = warpedBitmap;
  try {
    finalBitmap = await enhanceMod.enhanceImage(warpedBitmap, enhanceMode);
  } catch (err) {
    console.warn("[capturePipeline] enhance failed, using warped frame:", err);
    finalBitmap = warpedBitmap;
  }

  // Encode the final image to JPEG for the downstream PDF pipeline.
  let finalBlob;
  try {
    finalBlob = await bitmapToJpegBlob(finalBitmap);
  } catch (err) {
    console.warn("[capturePipeline] final encode failed:", err);
    finalBlob = baseBlob;
  }

  return {
    blob: finalBlob,
    dataUrl: URL.createObjectURL(finalBlob),
    width: finalBitmap.width,
    height: finalBitmap.height,
    crop: {
      corners: cropCorners,
      mode: cropMode,
      confidence: cropConfidence,
    },
    baseBitmap: warpedBitmap,
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
 * @param {'auto'|'bw'|'colour'} enhanceMode
 *
 * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
 *   The newly-enhanced JPEG and a fresh object URL for the thumbnail.
 */
export async function reprocessPage(baseBlob, enhanceMode = "auto") {
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
 * @param {'auto'|'bw'|'colour'} [enhanceMode='auto']
 *
 * @returns Same shape as `processCapturedFrame`, with crop.mode='manual'.
 */
export async function reprocessWithCorners(
  rawBlob,
  corners,
  enhanceMode = "auto",
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
