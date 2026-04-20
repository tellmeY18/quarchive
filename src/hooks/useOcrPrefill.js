/**
 * useOcrPrefill Hook + runOcrOnImage helper
 *
 * Two entry points, same destination (wizardStore.ocrSuggestions):
 *
 *   1. `runOcrOnImage(blob)` — imperative, called by the camera
 *      Viewfinder immediately after the FIRST captured page. Feeds the
 *      raw JPEG straight into scribe.js via `ocrFirstImage`, which
 *      skips PDF assembly + rasterisation entirely. On a typical
 *      first page of a question paper (header contains course code,
 *      title, exam type) this finishes well before the user has
 *      navigated to StepMetadata, so suggestion pills are already
 *      populated by the time they're needed.
 *
 *   2. `useOcrPrefill(pdfBlob, enabled)` — React hook, kept as a
 *      fallback for the PDF-upload source (no camera images
 *      available) and for the edge case where image OCR failed or
 *      produced no useful suggestions. If image OCR already ran to
 *      success, this hook is a no-op — we don't want to overwrite
 *      suggestions the user may already have accepted / dismissed.
 *
 * Both paths respect CLAUDE.md invariants 12–14:
 *  - OCR always runs in a Web Worker (scribeClient owns the worker).
 *  - Suggestions never auto-fill; StepMetadata renders them as pills.
 *  - Failures are silent — no error is surfaced to the user.
 */

import { useEffect } from "react";
import { initScribe, ocrFirstPages, ocrFirstImage } from "../lib/scribeClient";
import { extractFromOcr } from "../lib/metadataExtract";
import useWizardStore from "../store/wizardStore";

/** Hard per-call budget for OCR, enforced inside scribeClient. */
const OCR_TIMEOUT_MS = 15000;

/**
 * Imperative entry point — call this from the camera flow the moment
 * the first page lands. Resolves to a boolean:
 *   - `true`  — OCR produced at least one suggestion and wizardStore
 *               was updated.
 *   - `false` — init failed, timed out, or yielded no suggestions.
 *               The caller should NOT treat this as an error; the PDF
 *               fallback in `useOcrPrefill` will take over later.
 *
 * We merge any existing (non-null) suggestions with the newly
 * extracted ones instead of blindly overwriting. This matters because
 * a user might capture page 1, OCR starts in the background, they
 * then manually type a course code on StepMetadata while OCR is
 * still running, and we MUST NOT clobber the field they just typed.
 * StepMetadata already guards against overwriting non-empty fields
 * when rendering pills, but suggestion state being stable is still
 * the right behaviour for the store itself.
 */
export async function runOcrOnImage(imageBlob) {
  if (!imageBlob) return false;

  const store = useWizardStore.getState();

  // If OCR already ran and finished, don't run it again. The camera
  // flow might retrigger this on a retake, but we guard against that
  // in the Viewfinder itself by running image OCR only on the FIRST
  // captured page per session.
  if (store.ocrStatus === "done" || store.ocrStatus === "running") {
    return false;
  }

  store.setOcrStatus("running");

  try {
    await initScribe({ vendorPath: "/vendor/scribe/" });

    const { text } = await ocrFirstImage(imageBlob, {
      maxPages: 1,
      language: "eng",
      timeout: OCR_TIMEOUT_MS,
    });

    const { suggestions } = extractFromOcr(text || "");

    // Only mark as "done" (the state that turns off the ✨ Reading
    // paper… indicator in StepMetadata) once we actually have
    // suggestions. If the extract returned all-null we keep status
    // as 'done' anyway — OCR completed, just with nothing useful —
    // so the PDF fallback doesn't race against this promise later.
    useWizardStore.getState().setOcrSuggestions(suggestions);
    useWizardStore.getState().setOcrStatus("done");

    // Report back to the caller whether any field was populated.
    return Object.values(suggestions).some((v) => v !== null && v !== "");
  } catch (error) {
    console.warn("[runOcrOnImage] OCR failed:", error);
    // Mark as failed so the PDF fallback path in useOcrPrefill can
    // retry against the assembled PDF — maybe mupdf will have better
    // luck with the rasterised version of the page than scribe did
    // with the raw JPEG.
    useWizardStore.getState().setOcrStatus("failed");
    return false;
  }
}

/**
 * React hook — fallback path for the PDF-upload source, and retry
 * path if image OCR failed. Fires exactly once per distinct pdfBlob.
 *
 * Usage:
 *   useOcrPrefill(pdfBlob, enabled = true)
 *
 * The `enabled` flag exists so StepMetadata can pass `true`
 * unconditionally and this hook decides internally whether to run:
 *  - skip if no pdfBlob yet
 *  - skip if image OCR already produced a 'done' state (the common
 *    camera-flow case — suggestions are already in the store and
 *    re-running against the PDF would waste 3–10s of CPU for no gain)
 *  - otherwise run against the PDF
 */
export function useOcrPrefill(pdfBlob, enabled = true) {
  const setOcrStatus = useWizardStore((s) => s.setOcrStatus);
  const setOcrSuggestions = useWizardStore((s) => s.setOcrSuggestions);
  // Deliberately not pulled here:
  //   - `resetOcr` is driven by the wizard lifecycle, not by this hook.
  //     Pulling it would re-trigger this effect on every store identity
  //     change and defeat the "fire once per PDF" model.
  //   - `ocrStatus` — we read it via `getState()` at effect-run time
  //     instead of subscribing, for the same reason.

  useEffect(() => {
    if (!pdfBlob || !enabled) return;

    // Check current status at effect-run time (NOT via subscription).
    // If image OCR already succeeded, bail out — we have suggestions.
    const currentStatus = useWizardStore.getState().ocrStatus;
    if (currentStatus === "done" || currentStatus === "running") {
      return;
    }

    let cancelled = false;

    const runOcr = async () => {
      try {
        setOcrStatus("running");

        await initScribe({ vendorPath: "/vendor/scribe/" });

        const { text } = await ocrFirstPages(pdfBlob, {
          maxPages: 2,
          language: "eng",
          timeout: OCR_TIMEOUT_MS,
        });

        if (cancelled) return;

        const { suggestions } = extractFromOcr(text || "");

        setOcrSuggestions(suggestions);
        setOcrStatus("done");
      } catch (error) {
        if (cancelled) return;
        console.warn("[useOcrPrefill] PDF OCR failed:", error);
        setOcrStatus("failed");
        // Silent failure — CLAUDE.md invariant 14.
      }
    };

    runOcr();

    return () => {
      cancelled = true;
      // Don't terminate the worker here — it's expensive to re-init
      // (WASM re-instantiation) and the user may come back to the
      // wizard. scribeClient.terminateScribe() is called from the
      // global wizard-reset path instead.
    };
  }, [pdfBlob, enabled, setOcrStatus, setOcrSuggestions]);
}
