/**
 * useBulkOcr — serial OCR orchestration over the bulk upload queue.
 *
 * Watches bulkStore.files for entries with ocrStatus === 'idle' and
 * processes them one at a time using the shared ocrWorker.js (Phase 8).
 *
 * Rules enforced (CLAUDE.md §5C / invariants 12, 13, 14, 20):
 *  - Strictly serial: only one file in-flight at any moment.
 *  - Shared worker: initScribe is called once; the worker lives across
 *    the whole session. Never spawn a new worker per file.
 *  - First page only: maxPages: 1 (bulk budget, Phase 9A).
 *  - Hard 8 s timeout per file. Exceeded → ocrStatus: 'skipped', no error.
 *  - OCR is client-side only; no text or suggestions leave the browser.
 *  - Never auto-fills fields the user has already typed (enforced in
 *    BulkQueueItem / BulkMetadataSheet when rendering suggestion pills).
 *
 * Usage: call useBulkOcr() once in BulkUpload.jsx. No return value.
 */

import { useEffect, useRef } from 'react'
import useBulkStore from '../store/bulkStore'
import { initScribe, ocrFirstPages } from '../lib/scribeClient'
import { extractFromOcr } from '../lib/metadataExtract'
import { normaliseBulkCourseCode } from '../store/bulkStore'

/** Hard per-file OCR budget for the bulk flow (tighter than the 15 s single-file budget). */
const BULK_OCR_TIMEOUT_MS = 8_000

export default function useBulkOcr() {
  /**
   * True while a file is being OCR-processed.
   * Guards against concurrent processing if the store subscription fires
   * multiple times before the async work completes.
   */
  const processingRef = useRef(false)

  /**
   * Tracks whether the component that owns this hook is still mounted.
   * We must not touch the store after unmount — the Zustand subscription
   * fires synchronously on state changes, so we need an explicit guard
   * for async callbacks that outlive the component.
   */
  const mountedRef = useRef(true)

  // Mark unmounted on cleanup so async callbacks bail early.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    /**
     * Picks the next idle file from the queue, runs OCR on it, then
     * recursively schedules itself for the file after that.
     *
     * If called while already processing (processingRef.current === true)
     * it exits immediately — the in-flight run will call processNext()
     * itself in its finally block.
     */
    async function processNext() {
      if (processingRef.current) return
      if (!mountedRef.current) return

      // Find the first file still waiting for OCR.
      const { files } = useBulkStore.getState()
      const nextFile = files.find((f) => f.ocrStatus === 'idle')
      if (!nextFile) return

      processingRef.current = true
      const { id, file } = nextFile

      // Transition to 'running' so the UI can show a spinner on this row.
      useBulkStore.getState().updateFile(id, { ocrStatus: 'running' })

      try {
        // Init is idempotent — subsequent calls await the same promise as
        // the first call (see scribeClient.js). No worker is re-created.
        await initScribe({ vendorPath: '/vendor/scribe/' })

        if (!mountedRef.current) return

        // File extends Blob — ocrFirstPages accepts it directly.
        const { text } = await ocrFirstPages(file, {
          maxPages: 1,             // first page only (Phase 9A budget rule)
          language: 'eng',
          timeout: BULK_OCR_TIMEOUT_MS,
        })

        if (!mountedRef.current) return

        const { suggestions } = extractFromOcr(text || '')

        // Invariant 15: courseCode must be normalised at every entry point —
        // trim → toUpperCase → collapse whitespace/hyphens — so that an
        // OCR-sourced code and a manually-typed equivalent produce a
        // byte-identical identifier slug.
        if (suggestions.courseCode) {
          suggestions.courseCode = normaliseBulkCourseCode(suggestions.courseCode)
        }

        // setOcrSuggestions also transitions ocrStatus to 'done'.
        useBulkStore.getState().setOcrSuggestions(id, suggestions)

      } catch (err) {
        // Silent failure — CLAUDE.md invariant 14: OCR never blocks the
        // upload flow. Log once for dev visibility; never shown to user.
        console.warn(
          `[useBulkOcr] OCR skipped for "${file.name}":`,
          err?.message ?? err,
        )
        if (mountedRef.current) {
          useBulkStore.getState().updateFile(id, { ocrStatus: 'skipped' })
        }
      } finally {
        processingRef.current = false

        // Schedule the next file. Using setTimeout(0) avoids a synchronous
        // call stack that could grow unbounded for a large queue, and gives
        // React a chance to flush any state updates from the completed file
        // before we start the next one.
        if (mountedRef.current) {
          setTimeout(processNext, 0)
        }
      }
    }

    // Subscribe to store changes. The callback fires synchronously whenever
    // the files array changes (new files added, ocrStatus flipped, etc.).
    // We only act when there are idle files and nothing is in-flight.
    const unsubscribe = useBulkStore.subscribe((state) => {
      const hasIdle = state.files.some((f) => f.ocrStatus === 'idle')
      if (hasIdle && !processingRef.current && mountedRef.current) {
        processNext()
      }
    })

    // Process any files that are already in the queue on mount
    // (e.g. files added before this hook first ran, or if BulkUpload
    // re-mounts with an existing session in the store).
    processNext()

    return () => {
      unsubscribe()
      // NOTE: We deliberately do NOT terminate the shared scribe worker
      // on unmount. Re-instantiating scribe's WASM modules is expensive
      // (~1–3 s on mid-range hardware). The worker is kept alive across
      // the whole page session; it is only torn down by terminateScribe()
      // when the upload wizard fully resets (wizardStore.resetWizard).
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // empty deps — this effect should run exactly once on mount
}
