/**
 * Single-paper upload to the same-origin /api/upload Worker proxy.
 *
 * Upload progress is not measurable with plain fetch FormData; the callback
 * is invoked at 0 before the request and at 1 after a successful response.
 */

import { apiPost } from './fetch.js'
import { buildMetadataHeaders } from './metadata.js'

/**
 * Assemble the exact FormData payload expected by functions/api/upload.js.
 *
 * `fields` accepts either `{ identifier, metadata, fileHash, source,
 * ocrAccepted }` or a pre-built `{ identifier, meta }` pair.
 *
 * @param {{file: Blob, fields: object, auth: object}} args
 * @returns {FormData}
 */
export function createUploadForm({ file, fields = {}, auth = {} }) {
  const {
    identifier,
    meta,
    headers,
    metadata = fields,
    fileHash = '',
    source,
    ocrAccepted,
  } = fields

  const metaHeaders =
    meta ?? headers ?? buildMetadataHeaders(metadata, fileHash, { source, ocrAccepted })

  const formData = new FormData()
  formData.append('accessKey', auth.accessKey ?? '')
  formData.append('secretKey', auth.secretKey ?? '')
  formData.append('identifier', identifier ?? '')
  formData.append('file', file)
  formData.append('meta', JSON.stringify(metaHeaders))
  return formData
}

/**
 * POST a pre-built upload FormData. Shared by the single and bulk flows.
 *
 * @param {FormData} formData
 * @param {object} [deps] `{ fetchImpl, signal, timeoutMs }`
 * @returns {Promise<Response>}
 */
export function postUploadForm(formData, deps = {}) {
  return apiPost('/api/upload', formData, deps)
}

/**
 * Upload one paper, mapping failures to the wizard's error codes.
 *
 * @param {object} args
 * @param {Blob} args.file
 * @param {object} [args.fields] Metadata / identifier fields
 * @param {{accessKey:string,secretKey:string}} [args.auth]
 * @param {(progress:number)=>void} [args.onProgress]
 * @param {AbortSignal} [args.signal]
 * @param {Function} [args.fetchImpl] Injected for tests
 * @param {number} [args.timeoutMs]
 * @returns {Promise<{ok: boolean, status: number|null, error: string|null}>}
 */
export async function uploadPaper({
  file,
  fields = {},
  auth = {},
  onProgress,
  signal,
  fetchImpl,
  timeoutMs,
}) {
  onProgress?.(0)

  try {
    const formData = createUploadForm({ file, fields, auth })
    const res = await postUploadForm(formData, { fetchImpl, signal, timeoutMs })

    if (res.ok) {
      onProgress?.(1)
      return { ok: true, status: res.status, error: null }
    }

    const error = res.status === 401
      ? 'session_expired'
      : res.status === 503
        ? 'slow_down'
        : 'rejected'
    return { ok: false, status: res.status, error }
  } catch {
    return { ok: false, status: null, error: 'network' }
  }
}
