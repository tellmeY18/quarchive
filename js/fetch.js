/**
 * Fetch primitives for all network calls.
 *
 * Every request is same-origin-neutral: no cookies or referrer leave the
 * browser, and an AbortController bounds the wait. Caller signals are
 * chained into the internal controller so a keystroke cancellation or a
 * timeout can both stop the request.
 */

import { FETCH_TIMEOUT_MS } from './constants.js'

/**
 * Low-level request helper.
 *
 * @param {string|URL} url
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.headers]
 * @param {*} [options.body]
 * @param {AbortSignal} [options.signal] Caller cancellation
 * @param {number} [options.timeoutMs=15000] Set to 0 to disable the timer
 * @param {Function} [options.fetchImpl=globalThis.fetch] Injectable for tests
 * @returns {Promise<Response>}
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    headers,
    body,
    signal,
    timeoutMs = FETCH_TIMEOUT_MS,
    fetchImpl = globalThis.fetch,
    ...rest
  } = options

  const controller = new AbortController()
  const timer =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null

  const onExternalAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onExternalAbort, { once: true })
  }

  try {
    return await fetchImpl(url, {
      ...rest,
      method,
      headers,
      body,
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
  } finally {
    if (timer !== null) clearTimeout(timer)
    if (signal) signal.removeEventListener?.('abort', onExternalAbort)
  }
}

/**
 * GET a URL with the house fetch policy applied.
 *
 * @param {string|URL} url
 * @param {object} [options] See {@link request}
 * @returns {Promise<Response>}
 */
export function apiGet(url, options = {}) {
  return request(url, { ...options, method: 'GET' })
}

/**
 * POST JSON (or a pre-built FormData/Blob/string body).
 *
 * @param {string|URL} url
 * @param {*} [body] Plain objects are JSON-stringified; FormData, Blob,
 *   URLSearchParams and strings are passed through unchanged.
 * @param {object} [options] See {@link request}
 * @returns {Promise<Response>}
 */
export function apiPost(url, body, options = {}) {
  const isRaw =
    body == null ||
    (typeof FormData !== 'undefined' && body instanceof FormData) ||
    (typeof Blob !== 'undefined' && body instanceof Blob) ||
    (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) ||
    typeof body === 'string'

  const payload = isRaw ? body : JSON.stringify(body)
  const headers = isRaw
    ? options.headers
    : { 'Content-Type': 'application/json', ...(options.headers || {}) }

  return request(url, { ...options, method: 'POST', headers, body: payload })
}

/**
 * GET a URL and parse its JSON body, throwing on non-2xx responses.
 *
 * @param {string|URL} url
 * @param {object} [options] See {@link request}
 * @returns {Promise<*>} Parsed JSON
 */
export async function apiJson(url, options = {}) {
  const res = await apiGet(url, options)
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

/**
 * Helper for injected fetch implementations: abort on an external signal.
 * Kept separate so tests can verify timeout/signal chaining in isolation.
 *
 * @param {AbortSignal} signal
 * @param {AbortController} controller
 * @returns {() => void} Unsubscribe function
 */
export function chainAbort(signal, controller) {
  if (!signal) return () => {}
  if (signal.aborted) {
    controller.abort()
    return () => {}
  }
  const onAbort = () => controller.abort()
  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener?.('abort', onAbort)
}
