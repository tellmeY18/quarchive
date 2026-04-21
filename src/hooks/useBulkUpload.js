import { useCallback } from 'react'
import useAuthStore from '../store/authStore'
import useBulkStore from '../store/bulkStore'
import { layer2IdentifierCheck } from '../lib/dedup'
import { buildMetaHeaders } from '../lib/metadata'

/**
 * useBulkUpload — Phase 9A bounded-concurrency upload engine.
 *
 * Exposes a single `startUpload()` action that:
 *   1. Collects all isReady files with uploadStatus === null.
 *   2. Processes them through a hand-rolled concurrency pool (max 3 PUTs).
 *   3. Per-file pipeline: hash → cross-batch dedup → layer-2 dedup → PUT.
 *   4. Retries up to 3 times with exponential backoff (1 s / 4 s / 15 s).
 *   5. On 401: aborts the entire batch immediately and preserves queue state.
 *
 * CLAUDE.md invariants enforced here:
 *   #4  — all three dedup layers run before each PUT
 *   #19 — dedup is never bypassed even in bulk mode
 *   #20 — (OCR serialisation is handled by useBulkOcr, not here)
 */

const MAX_CONCURRENCY = 3
const RETRY_DELAYS_MS = [1000, 4000, 15000]

/** Sleep helper for retry backoff. */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Compute SHA-256 hash of a File using hashWorker.js.
 * All files go through the worker regardless of size (Phase 9A spec).
 */
async function computeFileHash(file) {
  const buffer = await file.arrayBuffer()

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/hashWorker.js', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.error) {
        reject(new Error(e.data.error))
      } else {
        resolve(e.data.hash)
      }
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Hash worker error'))
    }

    // Transfer the buffer zero-copy into the worker.
    worker.postMessage(buffer, [buffer])
  })
}

export default function useBulkUpload() {
  const isUploading = useBulkStore((s) => s.isUploading)

  const startUpload = useCallback(async () => {
    const { accessKey, secretKey } = useAuthStore.getState()

    const store = useBulkStore.getState()
    store.setUploadStarted(true)
    store.setIsUploading(true)

    // Snapshot the ready queue at the moment the user taps Upload.
    // Files that finish OCR and become Ready after this point are NOT
    // included — they'll be picked up on the next "Upload" tap.
    const readyFiles = useBulkStore
      .getState()
      .files.filter((f) => f.isReady && f.uploadStatus === null)

    if (readyFiles.length === 0) {
      useBulkStore.getState().setIsUploading(false)
      return
    }

    // Tracks hashes of files we've already successfully uploaded *in this
    // batch* so cross-file duplicates (identical PDFs with different names)
    // are caught without re-hitting Archive.org.
    const completedHashes = new Set()

    // Shared abort flag — set to true on 401 to stop new PUTs from starting.
    let aborted = false

    // ── Bounded-concurrency pool ──────────────────────────────────────────
    // Hand-rolled instead of Promise.all to honour the MAX_CONCURRENCY cap.
    // Each slot calls dispatchNext() when it finishes, which pulls the next
    // file off the queue — giving us exactly N in-flight at any time.

    let queueIndex = 0
    let activeSlots = 0

    await new Promise((resolveAll) => {
      function checkFinished() {
        if (queueIndex >= readyFiles.length && activeSlots === 0) {
          resolveAll()
        }
      }

      function dispatchNext() {
        while (
          activeSlots < MAX_CONCURRENCY &&
          queueIndex < readyFiles.length &&
          !aborted
        ) {
          const record = readyFiles[queueIndex++]
          activeSlots++

          processFile(record).finally(() => {
            activeSlots--
            dispatchNext()
            checkFinished()
          })
        }

        // Handle the case where aborted = true mid-loop: drain remaining
        // queued (not yet started) files immediately.
        if (aborted) {
          while (queueIndex < readyFiles.length) {
            const record = readyFiles[queueIndex++]
            useBulkStore.getState().updateFile(record.id, {
              uploadStatus: 'failed',
              uploadError: 'session_expired',
            })
          }
          checkFinished()
        }
      }

      dispatchNext()
    })

    useBulkStore.getState().setIsUploading(false)

    // ── Per-file pipeline ─────────────────────────────────────────────────

    async function processFile(record) {
      if (aborted) {
        useBulkStore.getState().updateFile(record.id, {
          uploadStatus: 'failed',
          uploadError: 'session_expired',
        })
        return
      }

      useBulkStore.getState().updateFile(record.id, { uploadStatus: 'pending' })

      // ── Step 1: Hash ─────────────────────────────────────────────────────
      let hash = record.hash
      if (!hash || record.hashStatus !== 'done') {
        useBulkStore.getState().updateFile(record.id, { hashStatus: 'running' })
        try {
          hash = await computeFileHash(record.file)
          useBulkStore.getState().updateFile(record.id, {
            hash,
            hashStatus: 'done',
          })
        } catch (err) {
          console.error(`[useBulkUpload] Hash failed for "${record.name}":`, err)
          useBulkStore.getState().updateFile(record.id, {
            uploadStatus: 'failed',
            uploadError: 'Failed to compute file hash',
            hashStatus: 'failed',
          })
          return
        }
      }

      // ── Step 2: Cross-batch dedup (same-hash within this upload run) ─────
      if (completedHashes.has(hash)) {
        useBulkStore.getState().updateFile(record.id, {
          uploadStatus: 'skipped',
          dedupStatus: 'duplicate',
          duplicateUrl: 'duplicate-in-batch',
        })
        return
      }

      // ── Step 3: Dedup layer 2 (identifier check on Archive.org) ──────────
      const identifier = record.identifier
      if (!identifier) {
        // Should not happen — isReady gate ensures identifier exists.
        useBulkStore.getState().updateFile(record.id, {
          uploadStatus: 'failed',
          uploadError: 'Missing identifier — fill all required fields',
        })
        return
      }

      useBulkStore.getState().updateFile(record.id, { dedupStatus: 'checking' })
      try {
        const { isDuplicate } = await layer2IdentifierCheck(identifier)
        if (isDuplicate) {
          useBulkStore.getState().updateFile(record.id, {
            dedupStatus: 'duplicate',
            duplicateUrl: `https://archive.org/details/${identifier}`,
            uploadStatus: 'skipped',
          })
          return
        }
        useBulkStore.getState().updateFile(record.id, { dedupStatus: 'ok' })
      } catch (err) {
        // Dedup check failed — log and proceed (upload.js layer-3 will catch
        // genuine duplicates via the IAS3 checksum header).
        console.warn(
          `[useBulkUpload] Layer-2 dedup check failed for "${record.name}":`,
          err,
        )
        useBulkStore.getState().updateFile(record.id, { dedupStatus: 'error' })
      }

      // ── Step 4: Upload with retries ───────────────────────────────────────
      // Merge per-file metadata with the shared institution field before
      // building the Archive.org metadata header map.
      const institution = useBulkStore.getState().institution
      const fullMetadata = { ...record.metadata, institution }

      const metaHeaders = buildMetaHeaders(fullMetadata, hash, {
        source: 'pdf-upload',
        ocrAccepted: record.ocrAccepted,
      })

      let lastError = null

      for (let attempt = 0; attempt <= 2; attempt++) {
        if (aborted) {
          useBulkStore.getState().updateFile(record.id, {
            uploadStatus: 'failed',
            uploadError: 'session_expired',
          })
          return
        }

        // Exponential backoff — skip the delay on the first attempt.
        if (attempt > 0) {
          await sleep(RETRY_DELAYS_MS[attempt - 1])
        }

        useBulkStore.getState().updateFile(record.id, {
          uploadStatus: 'uploading',
          retryCount: attempt,
        })

        try {
          const formData = new FormData()
          formData.append('accessKey', accessKey)
          formData.append('secretKey', secretKey)
          formData.append('identifier', identifier)
          formData.append('file', record.file)
          formData.append('meta', JSON.stringify(metaHeaders))

          const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          })

          if (res.ok) {
            // Success — register the hash so cross-batch dedup works for
            // any subsequent file in this run with the same content.
            completedHashes.add(hash)
            useBulkStore.getState().updateFile(record.id, {
              uploadStatus: 'done',
              uploadProgress: 1,
              archiveUrl: `https://archive.org/details/${identifier}`,
            })
            return
          }

          if (res.status === 401) {
            // Session expired — abort the entire batch immediately.
            // Completed files stay done; pending files get marked failed.
            aborted = true
            useBulkStore.getState().updateFile(record.id, {
              uploadStatus: 'failed',
              uploadError: 'session_expired',
            })
            // Mark all files not yet started as failed too.
            const snapshot = useBulkStore.getState().files
            for (const f of snapshot) {
              if (f.uploadStatus === null || f.uploadStatus === 'pending') {
                useBulkStore.getState().updateFile(f.id, {
                  uploadStatus: 'failed',
                  uploadError: 'session_expired',
                })
              }
            }
            return
          }

          // Honour Retry-After on 429 / 503.
          if (res.status === 429 || res.status === 503) {
            const retryAfter = res.headers.get('Retry-After')
            if (retryAfter) {
              const waitMs = parseInt(retryAfter, 10) * 1000
              if (!isNaN(waitMs) && waitMs > 0) {
                await sleep(Math.min(waitMs, 60_000))
              }
            }
            lastError = `rate_limited (HTTP ${res.status})`
          } else {
            lastError = `rejected (HTTP ${res.status})`
          }
        } catch {
          // Network-level failure (offline, DNS, CORS, etc.)
          lastError = 'network'
        }
      }

      // All three attempts exhausted.
      useBulkStore.getState().updateFile(record.id, {
        uploadStatus: 'failed',
        uploadError: lastError || 'unknown',
      })
    }
  }, [])

  return { startUpload, isUploading }
}
