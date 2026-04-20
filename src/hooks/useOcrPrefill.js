/**
 * useOcrPrefill Hook
 *
 * Manages OCR extraction in the background while the user navigates the upload flow.
 * Triggered when a PDF is assembled, completes asynchronously without blocking.
 *
 * Usage:
 * useOcrPrefill(pdfBlob, enabled) — triggers OCR on mount if pdfBlob is available
 */

import { useEffect } from "react";
import { initScribe, ocrFirstPages } from "../lib/scribeClient";
import { extractFromOcr } from "../lib/metadataExtract";
import useWizardStore from "../store/wizardStore";

const OCR_TIMEOUT_MS = 15000; // 15 second hard cap

export function useOcrPrefill(pdfBlob, enabled = true) {
  const setOcrStatus = useWizardStore((s) => s.setOcrStatus);
  const setOcrSuggestions = useWizardStore((s) => s.setOcrSuggestions);
  // `resetOcr` intentionally not pulled here — it's called by the wizard
  // reset flow, not by this hook. Adding it as a dependency would retrigger
  // OCR on every store-selector identity change, which defeats the whole
  // "background, fire-once-per-PDF" model.

  useEffect(() => {
    if (!pdfBlob || !enabled) {
      return;
    }

    const runOcr = async () => {
      try {
        setOcrStatus("running");

        // Initialize scribe.js once per session
        await initScribe({ vendorPath: "/vendor/scribe/" });

        // Run OCR on first 1-2 pages
        const { text } = await ocrFirstPages(pdfBlob, {
          maxPages: 2,
          language: "eng",
          timeout: OCR_TIMEOUT_MS,
        });

        // Extract metadata from OCR text
        const { suggestions } = extractFromOcr(text);

        // Store suggestions (user can accept or dismiss)
        setOcrSuggestions(suggestions);
        setOcrStatus("done");
      } catch (error) {
        console.error("[useOcrPrefill] Error:", error);
        setOcrStatus("failed");
        // Silent failure — no error shown to user
      }
    };

    // Start OCR in background (don't await, don't block)
    runOcr();

    // Cleanup on unmount
    return () => {
      // terminateScribe(); // Keep worker alive for potential re-run
    };
  }, [pdfBlob, enabled, setOcrStatus, setOcrSuggestions]);
}
