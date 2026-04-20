/**
 * OCR Worker — Phase 8
 *
 * Runs scribe.js-ocr (Tesseract-based) inside a dedicated Web Worker so that
 * the main thread (camera shutter, thumbnail tray, form typing) never janks
 * while OCR is running.
 *
 * Architecture:
 *   scribeClient.js (main thread)
 *      │  postMessage({ type: 'init', vendorPath })
 *      ▼
 *   this worker
 *      │  dynamic import('/vendor/scribe/scribe.js')  ← same-origin (CLAUDE.md §5B)
 *      │  scribe.init({ ocr: true, font: true })
 *      ▼
 *   scribeClient.js
 *      │  postMessage({ type: 'ocr', pdfBuffer, maxPages, language })
 *      ▼
 *   this worker
 *      │  scribe.importFiles({ pdfFiles: [arrayBuffer] })
 *      │  scribe.recognize({ langs, mode: 'speed' })
 *      │  scribe.exportData('txt', 0, maxPages - 1)
 *      ▼
 *   postMessage({ type: 'ocr-result', text, layout })
 *
 * Rules enforced here:
 *  - scribe.js-ocr is imported only inside this worker (CLAUDE.md §5B rule 1,
 *    §21 invariant 12).
 *  - All scribe assets are loaded from /vendor/scribe/ on Quarchive's own
 *    origin (CLAUDE.md §21 invariant 18).
 *  - A single scribe instance is reused for every OCR request during the
 *    lifetime of the worker (CLAUDE.md §5B rule 3).
 *  - Failures are reported back to the main thread; the main thread decides
 *    whether to surface them. This worker never throws to self.
 */

/** Bound once by the `init` message; imported lazily from /vendor/scribe/. */
let scribe = null;

/** Marks whether a previous init attempt failed so we don't retry forever. */
let initFailed = false;

/**
 * Lazily import the scribe.js entry point from /vendor/scribe/scribe.js.
 *
 * `vendorPath` is passed in by the main thread (defaults to '/vendor/scribe/')
 * and resolved against the worker's own origin.
 */
async function loadScribe(vendorPath) {
  const base = vendorPath.endsWith("/") ? vendorPath : `${vendorPath}/`;
  const url = new URL(`${base}scribe.js`, self.location.origin).toString();
  // Vite refuses to analyse this statically — that's exactly what we want,
  // so the scribe.js bundle never gets inlined into the main chunk.
  const mod = await import(/* @vite-ignore */ url);
  return mod.default || mod.scribe || mod;
}

/**
 * Initialize scribe.js. Resolves with { ok: true } on success and
 * { ok: false, error } on failure — callers treat a failed init as a
 * graceful no-op (CLAUDE.md §21 invariant 14, §5B rule 5).
 */
async function handleInit(vendorPath) {
  if (scribe) return { ok: true };
  if (initFailed) return { ok: false, error: "previous init failed" };

  try {
    scribe = await loadScribe(vendorPath);
    // Pre-load OCR engine + fonts so the first real OCR call is fast.
    // Per scribe.js API docs, passing `ocr: true` / `font: true` to
    // `init` is the officially-supported pre-warm path.
    if (typeof scribe.init === "function") {
      await scribe.init({ ocr: true, font: true });
    }
    return { ok: true };
  } catch (err) {
    initFailed = true;
    scribe = null;
    return {
      ok: false,
      error: err && err.message ? err.message : String(err),
    };
  }
}

/**
 * Run OCR on the first N pages of a PDF.
 *
 * Strategy:
 *  1. Import the PDF via scribe.importFiles({ pdfFiles: [arrayBuffer] }).
 *  2. Call scribe.recognize({ mode: 'speed', langs: [language] }) — 'speed'
 *     mode is the right default for best-effort metadata prefill (we're
 *     looking for a course code, not publishing a searchable PDF).
 *  3. Export plain text for pages [0, maxPages-1] and return it.
 *
 * All scribe APIs are used through optional-chaining guards: older scribe.js
 * versions drop or rename methods occasionally, and Phase 8 must degrade
 * gracefully rather than crash the upload flow (CLAUDE.md invariant 14).
 */
async function handleOcr({ pdfBuffer, maxPages = 2, language = "eng" }) {
  if (!scribe) {
    throw new Error("scribe not initialised");
  }

  // Clear any state left over from a previous OCR run so successive
  // uploads don't bleed text into each other.
  if (typeof scribe.clear === "function") {
    try {
      await scribe.clear();
    } catch {
      // Non-fatal; proceed with whatever state scribe has.
    }
  }

  // Import the PDF. scribe.importFiles is happy with an ArrayBuffer in the
  // `pdfFiles` array when we pre-sort the input ourselves (docs: SortedInputFiles).
  await scribe.importFiles({ pdfFiles: [pdfBuffer] });

  // Recognise. 'speed' ≈ lstm-only; sufficient for headline-sized course
  // codes which is all Phase 8 cares about.
  await scribe.recognize({ langs: [language], mode: "speed" });

  // Export the first `maxPages` pages as plain text. scribe uses inclusive
  // page indices, 0-based.
  let text = "";
  if (typeof scribe.exportData === "function") {
    try {
      text = await scribe.exportData("txt", 0, Math.max(0, maxPages - 1));
    } catch {
      text = "";
    }
  }

  // Return a best-effort layout hint if scribe exposes it. This is purely
  // optional — metadataExtract.js only reads `text`.
  let layout = {};
  try {
    if (scribe.data && scribe.data.ocr && scribe.data.ocr.active) {
      const pages = scribe.data.ocr.active;
      layout = {
        pageCount: Array.isArray(pages) ? pages.length : 0,
      };
    }
  } catch {
    layout = {};
  }

  return { text: typeof text === "string" ? text : "", layout };
}

/**
 * Top-level message router. Every incoming message resolves to exactly one
 * outgoing message so the main thread's `addEventListener('message', ...)`
 * promise-handlers in scribeClient.js always settle.
 */
self.addEventListener("message", async (event) => {
  const data = event.data || {};

  if (data.type === "init") {
    const result = await handleInit(data.vendorPath || "/vendor/scribe/");
    if (result.ok) {
      self.postMessage({ type: "init-complete" });
    } else {
      self.postMessage({ type: "init-error", error: result.error });
    }
    return;
  }

  if (data.type === "ocr") {
    const { id } = data;
    try {
      const { text, layout } = await handleOcr({
        pdfBuffer: data.pdfBuffer,
        maxPages: data.maxPages,
        language: data.language,
      });
      self.postMessage({ type: "ocr-result", id, text, layout });
    } catch (err) {
      self.postMessage({
        type: "ocr-error",
        id,
        error: err && err.message ? err.message : String(err),
      });
    }
    return;
  }

  if (data.type === "terminate") {
    try {
      if (scribe && typeof scribe.terminate === "function") {
        await scribe.terminate();
      }
    } catch {
      // Ignore — worker is closing anyway.
    }
    self.close();
    return;
  }
});
