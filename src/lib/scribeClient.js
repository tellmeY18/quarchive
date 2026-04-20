/**
 * Scribe.js OCR Client — Phase 8
 *
 * Thin main-thread wrapper around `src/workers/ocrWorker.js`. The worker
 * is the only place in Quarchive that imports scribe.js-ocr (CLAUDE.md
 * §5B rule 1, §21 invariant 12), and this file is the only thing in the
 * main bundle that knows about the worker.
 *
 * Design notes:
 *  - A single Web Worker instance is reused for the lifetime of the page.
 *    Re-creating the worker (and thus re-instantiating scribe's WASM
 *    modules) on every PDF is extremely expensive. CLAUDE.md §5B rule 3
 *    says "a single scribe worker instance is reused for all pages of
 *    one PDF; it is terminated when the upload wizard unmounts" — we go
 *    one better and keep it alive across uploads too.
 *  - Exactly one permanent `message` listener is attached to the worker.
 *    Each in-flight call (init, ocr) gets a monotonically-incrementing
 *    request id, and the permanent listener dispatches by id. This avoids
 *    the old bug where `addEventListener`/`removeEventListener` pairs per
 *    call would silently drop `init-complete` (it has no id, arrives
 *    before we attach) or leak listeners when a timeout fired.
 *  - Every call is bounded: init has an implicit (generous) budget;
 *    `ocrFirstPages` enforces the CLAUDE.md §21 invariant 14 budget
 *    (default 15s) via an abort timer that settles the promise with
 *    an Error the caller can treat as "no suggestions".
 *  - Failures never throw past the hook boundary; `useOcrPrefill.js`
 *    is responsible for swallowing them silently.
 */

/** The single worker instance. Created on first `initScribe` call. */
let ocrWorker = null;

/**
 * Promise returned by the first `initScribe()` call. Subsequent calls
 * await this same promise instead of kicking off a second init.
 */
let initPromise = null;

/**
 * Tracks the outcome of `initPromise` so we can refuse follow-up
 * `ocrFirstPages` calls cleanly instead of hanging forever.
 */
let initState = "pending"; // 'pending' | 'ready' | 'failed'

/**
 * In-flight OCR requests keyed by their request id. The permanent
 * `message` listener on the worker pops entries from this map as
 * results arrive.
 */
const pendingOcr = new Map();

/** Monotonic request id generator for OCR calls. */
let nextRequestId = 1;

/**
 * Attach the permanent message router. Called exactly once when the
 * worker is created.
 */
function wireWorker(worker) {
  worker.addEventListener("message", (event) => {
    const data = event.data || {};

    // Init messages: resolved/rejected by initPromise below. We don't
    // unwrap them here because they arrive before any OCR request can
    // be posted — see `initScribe`.
    if (data.type === "init-complete" || data.type === "init-error") {
      return;
    }

    // OCR messages: look up the pending request by id and settle it.
    // The worker echoes back the id it received with the request.
    if (data.type === "ocr-result" || data.type === "ocr-error") {
      const { id } = data;
      const entry = pendingOcr.get(id);
      if (!entry) {
        // Orphan result — most likely the caller already timed out.
        // Drop on the floor rather than surfacing a stray error.
        return;
      }
      pendingOcr.delete(id);
      clearTimeout(entry.timeoutId);
      if (data.type === "ocr-result") {
        entry.resolve({ text: data.text || "", layout: data.layout || {} });
      } else {
        entry.reject(new Error(data.error || "OCR failed"));
      }
    }
  });

  worker.addEventListener("error", (err) => {
    // A hard worker crash — fail every pending OCR request so callers
    // don't hang, and mark init as failed so future calls bail fast.
    initState = "failed";
    const message = err && err.message ? err.message : "OCR worker crashed";
    for (const [, entry] of pendingOcr) {
      clearTimeout(entry.timeoutId);
      entry.reject(new Error(message));
    }
    pendingOcr.clear();
  });
}

/**
 * Initialize the OCR worker and pre-warm scribe.js-ocr inside it.
 *
 * Safe to call many times: the first call creates the worker and kicks
 * off scribe's init; every subsequent call awaits the same promise.
 *
 * Resolves on success; rejects on scribe init failure. Callers in
 * `useOcrPrefill.js` treat a rejection as "OCR unavailable, skip
 * suggestions" (silent failure, CLAUDE.md invariant 14).
 */
export async function initScribe(options = {}) {
  if (initPromise) {
    return initPromise;
  }

  const vendorPath = options.vendorPath || "/vendor/scribe/";

  initPromise = new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../workers/ocrWorker.js", import.meta.url), {
        type: "module",
      });
    } catch (err) {
      initState = "failed";
      reject(err);
      return;
    }

    ocrWorker = worker;

    // One-shot init handler. It's attached BEFORE the permanent router
    // in wireWorker() so that init-complete / init-error land here first.
    // Once init settles we detach this handler; the permanent router
    // (wired immediately below) owns all subsequent messages.
    const initHandler = (event) => {
      const data = event.data || {};
      if (data.type === "init-complete") {
        worker.removeEventListener("message", initHandler);
        initState = "ready";
        resolve();
      } else if (data.type === "init-error") {
        worker.removeEventListener("message", initHandler);
        initState = "failed";
        reject(new Error(data.error || "scribe init failed"));
      }
    };

    worker.addEventListener("message", initHandler);
    // Hard failure of the worker itself (syntax error in ocrWorker.js,
    // OOM during WASM instantiation on iOS, etc.) — reject init with the
    // browser-provided ErrorEvent message.
    const errorHandler = (err) => {
      worker.removeEventListener("error", errorHandler);
      initState = "failed";
      reject(
        new Error(err && err.message ? err.message : "worker failed to start"),
      );
    };
    worker.addEventListener("error", errorHandler);

    // Attach the permanent router. It ignores init messages (they're
    // handled by initHandler above) and routes ocr-result / ocr-error
    // to their pending entries in `pendingOcr`.
    wireWorker(worker);

    worker.postMessage({ type: "init", vendorPath });
  });

  return initPromise;
}

/**
 * Run OCR on the first N pages of a PDF.
 *
 * @param {Blob} pdfBlob - the assembled PDF
 * @param {object} [options]
 * @param {number} [options.maxPages=2]  Pages to OCR. Phase 8 target.
 * @param {string} [options.language='eng']  Tesseract language code.
 * @param {number} [options.timeout=15000]  Hard budget in ms
 *   (CLAUDE.md §21 invariant 14). On timeout the promise rejects with
 *   a plain Error whose message is 'OCR timeout'.
 *
 * @returns {Promise<{ text: string, layout: object }>}
 */
export async function ocrFirstPages(pdfBlob, options = {}) {
  const { maxPages = 2, language = "eng", timeout = 15000 } = options;

  if (!ocrWorker || initState !== "ready") {
    throw new Error("OCR worker not initialised");
  }

  // Read the Blob once on the main thread. scribe.js can accept an
  // ArrayBuffer directly in the worker, which is cheaper than shuttling
  // a File object over postMessage (structured clone handles both, but
  // ArrayBuffer is transferable — see below).
  const pdfBuffer = await pdfBlob.arrayBuffer();

  const id = nextRequestId++;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pendingOcr.has(id)) {
        pendingOcr.delete(id);
        reject(new Error("OCR timeout"));
      }
    }, timeout);

    pendingOcr.set(id, { resolve, reject, timeoutId });

    // Transfer the underlying ArrayBuffer so we avoid a copy on the way
    // into the worker. pdfBuffer is unusable after this call — that's
    // fine because we already finished reading it.
    try {
      ocrWorker.postMessage(
        {
          type: "ocr",
          id,
          pdfBuffer,
          maxPages,
          language,
        },
        [pdfBuffer],
      );
    } catch (err) {
      pendingOcr.delete(id);
      clearTimeout(timeoutId);
      reject(err);
    }
  });
}

/**
 * Run OCR directly on one or more raw image blobs.
 *
 * This is the preferred path for the camera flow — we feed the first
 * captured JPEG straight into scribe.js's `imageFiles` importer, which
 * skips PDF rasterisation entirely. Compared to `ocrFirstPages`:
 *
 *   - No PDF assembly wait (pdf-lib takes ~1–3s on budget Android).
 *   - No mupdf rasterisation pass inside scribe.
 *   - OCR can start the moment the shutter fires, in parallel with
 *     the user capturing additional pages.
 *
 * On a typical first page of a question paper (course code, title,
 * exam type all in the header region), the returned text is more than
 * enough for `metadataExtract.js` — we never needed multi-page
 * synthesis for metadata prefill anyway.
 *
 * @param {Blob|Blob[]} imageBlobs - one or more image Blobs (JPEG/PNG).
 *   A single Blob is accepted for convenience and wrapped internally.
 * @param {object} [options]
 * @param {number} [options.maxPages=1]  How many image pages to OCR.
 *   Default 1 because the camera flow feeds the FIRST captured page
 *   only — that's where the metadata lives.
 * @param {string} [options.language='eng']  Tesseract language code.
 * @param {number} [options.timeout=15000]  Hard budget, same as the
 *   PDF path (CLAUDE.md §21 invariant 14).
 *
 * @returns {Promise<{ text: string, layout: object }>}
 */
export async function ocrFirstImage(imageBlobs, options = {}) {
  const { maxPages = 1, language = "eng", timeout = 15000 } = options;

  if (!ocrWorker || initState !== "ready") {
    throw new Error("OCR worker not initialised");
  }

  // Accept either a single Blob or an array for ergonomic callers.
  const blobs = Array.isArray(imageBlobs) ? imageBlobs : [imageBlobs];
  if (blobs.length === 0) {
    throw new Error("no image blobs supplied");
  }

  // Read every Blob into an ArrayBuffer on the main thread so we can
  // transfer them zero-copy into the worker. The MIME type of the
  // first blob is forwarded as a hint for libraries that sniff; scribe
  // itself auto-detects from the buffer header.
  const imageBuffers = await Promise.all(blobs.map((b) => b.arrayBuffer()));
  const imageType = blobs[0]?.type || "image/jpeg";

  const id = nextRequestId++;

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pendingOcr.has(id)) {
        pendingOcr.delete(id);
        reject(new Error("OCR timeout"));
      }
    }, timeout);

    pendingOcr.set(id, { resolve, reject, timeoutId });

    try {
      // Transfer every ArrayBuffer — they're all unusable on the main
      // thread after this call, which is fine because we only needed
      // them long enough to postMessage them across.
      ocrWorker.postMessage(
        {
          type: "ocr-image",
          id,
          imageBuffers,
          imageType,
          maxPages,
          language,
        },
        imageBuffers,
      );
    } catch (err) {
      pendingOcr.delete(id);
      clearTimeout(timeoutId);
      reject(err);
    }
  });
}

/**
 * Tear down the worker. Called from `useOcrPrefill.js` cleanup / on
 * route change away from the upload wizard. Safe to call when the
 * worker was never initialised.
 *
 * After termination, a subsequent `initScribe()` call will start a
 * fresh worker from scratch.
 */
export function terminateScribe() {
  if (!ocrWorker) return;

  // Fail any in-flight OCR promises so callers don't hang.
  for (const [, entry] of pendingOcr) {
    clearTimeout(entry.timeoutId);
    entry.reject(new Error("OCR worker terminated"));
  }
  pendingOcr.clear();

  try {
    // Give the worker a chance to call scribe.terminate() cleanly before
    // we yank the thread out from under it.
    ocrWorker.postMessage({ type: "terminate" });
  } catch {
    // Ignore — we're terminating anyway.
  }

  try {
    ocrWorker.terminate();
  } catch {
    // Ignore.
  }

  ocrWorker = null;
  initPromise = null;
  initState = "pending";
}
