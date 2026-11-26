/**
 * Deduplication layers.
 *
 * Layer 1: Archive.org search by SHA-256. Layer 2: metadata lookup by
 * identifier. Layer 3 (IAS3 checksum header) lives in the upload Worker.
 * All checks fail open so a network hiccup never blocks an upload.
 */

import { buildMetadataUrl, buildSearchUrl } from './archive.js'
import { apiJson } from './fetch.js'
import { HASH_WORKER_THRESHOLD_BYTES } from './constants.js'

/**
 * Layer 1 — look for an existing item with the same content hash.
 *
 * @param {string} hashHex Full 64-character SHA-256 hex digest
 * @param {object} [deps] `{ fetchImpl, signal, timeoutMs }`
 * @returns {Promise<{isDuplicate: boolean, item: object|null}>}
 */
export async function layer1HashCheck(hashHex, deps = {}) {
  // A missing hash would drop the sha256 filter and collapse the query to
  // `subject:quarchive`, falsely marking every upload as a duplicate.
  if (!hashHex || typeof hashHex !== 'string' || hashHex.length < 64) {
    console.warn('Layer 1 dedup check skipped: missing or invalid hash')
    return { isDuplicate: false, item: null }
  }

  const url = buildSearchUrl({ filters: { sha256: hashHex }, rows: 1 })

  try {
    const json = await apiJson(url, deps)
    const docs = json?.response?.docs || []
    return docs.length > 0
      ? { isDuplicate: true, item: docs[0] }
      : { isDuplicate: false, item: null }
  } catch (err) {
    console.error('Layer 1 dedup check failed:', err)
    return { isDuplicate: false, item: null }
  }
}

/**
 * Layer 2 — look for an existing item with the same deterministic identifier.
 *
 * @param {string} identifier
 * @param {object} [deps] `{ fetchImpl, signal, timeoutMs }`
 * @returns {Promise<{isDuplicate: boolean, item: object|null}>}
 */
export async function layer2IdentifierCheck(identifier, deps = {}) {
  try {
    const json = await apiJson(buildMetadataUrl(identifier), deps)
    if (json && json.metadata) return { isDuplicate: true, item: json.metadata }
    return { isDuplicate: false, item: null }
  } catch (err) {
    console.error('Layer 2 dedup check failed:', err)
    return { isDuplicate: false, item: null }
  }
}

/**
 * Run both client-side layers in order.
 *
 * @param {{hashHex: string, identifier: string}} args
 * @param {object} [deps]
 * @returns {Promise<{isDuplicate: boolean, item: object|null,
 *   layerTriggered: 1|2|null}>}
 */
export async function runAllDedupLayers({ hashHex, identifier }, deps = {}) {
  const l1 = await layer1HashCheck(hashHex, deps)
  if (l1.isDuplicate) {
    return { isDuplicate: true, item: l1.item, layerTriggered: 1 }
  }

  const l2 = await layer2IdentifierCheck(identifier, deps)
  if (l2.isDuplicate) {
    return { isDuplicate: true, item: l2.item, layerTriggered: 2 }
  }

  return { isDuplicate: false, item: null, layerTriggered: null }
}

/**
 * Compute SHA-256 of a File/Blob.
 *
 * Files <= 10 MB are hashed on the main thread; larger files use
 * workers/hashWorker.js. Bulk upload passes `forceWorker: true` so the UI
 * never blocks, matching useBulkUpload.js.
 *
 * @param {Blob} file
 * @param {object} [options]
 * @param {boolean} [options.forceWorker=false]
 * @param {number} [options.threshold=HASH_WORKER_THRESHOLD_BYTES]
 * @param {Function} [options.workerFactory] `(url, opts) => Worker`
 * @returns {Promise<string>} Lowercase hex digest
 */
export async function hashFile(file, options = {}) {
  const {
    forceWorker = false,
    threshold = HASH_WORKER_THRESHOLD_BYTES,
    workerFactory = (url, opts) => new Worker(url, opts),
  } = options

  const buffer = await file.arrayBuffer()

  if (!forceWorker && file.size <= threshold) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer)
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const url = new URL('../workers/hashWorker.js', import.meta.url)

  return new Promise((resolve, reject) => {
    const worker = workerFactory(url, { type: 'module' })

    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.error) reject(new Error(e.data.error))
      else resolve(e.data.hash)
    }

    worker.onerror = (err) => {
      worker.terminate()
      reject(new Error(err.message || 'Worker error during hashing'))
    }

    worker.postMessage(buffer, [buffer])
  })
}
