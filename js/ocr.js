/**
 * Main-thread OCR client.
 *
 * One module worker is reused for the whole page session; every call has a
 * request id and a hard timeout. Failures reject locally so callers can
 * silently skip OCR suggestions. Text never leaves the device.
 */

import { OCR_TIMEOUT_MS, BULK_OCR_TIMEOUT_MS } from './constants.js'

let ocrWorker = null
let initPromise = null
let initState = 'pending'
const pendingOcr = new Map()
let nextRequestId = 1

function wireWorker(worker) {
  worker.addEventListener('message', (event) => {
    const data = event.data || {}
    if (data.type === 'ocr-result' || data.type === 'ocr-error') {
      const entry = pendingOcr.get(data.id)
      if (!entry) return
      pendingOcr.delete(data.id)
      clearTimeout(entry.timeoutId)
      if (data.type === 'ocr-result') {
        entry.resolve({ text: data.text || '', layout: data.layout || {} })
      } else {
        entry.reject(new Error(data.error || 'OCR failed'))
      }
    }
  })

  worker.addEventListener('error', (err) => {
    initState = 'failed'
    const message = err && err.message ? err.message : 'OCR worker crashed'
    for (const [, entry] of pendingOcr) {
      clearTimeout(entry.timeoutId)
      entry.reject(new Error(message))
    }
    pendingOcr.clear()
  })
}

/** Initialise (or reuse) the single OCR worker. Idempotent. */
export function initScribe(options = {}) {
  if (initPromise) return initPromise

  const {
    vendorPath = '/vendor/scribe/',
    workerFactory = (url, opts) => new Worker(url, opts),
    workerUrl = new URL('../workers/ocrWorker.js', import.meta.url),
  } = options

  initPromise = new Promise((resolve, reject) => {
    let worker
    try {
      worker = workerFactory(workerUrl, { type: 'module' })
    } catch (err) {
      initState = 'failed'
      initPromise = null
      reject(err)
      return
    }
    ocrWorker = worker

    const initHandler = (event) => {
      const data = event.data || {}
      if (data.type === 'init-complete') {
        worker.removeEventListener('message', initHandler)
        initState = 'ready'
        resolve()
      } else if (data.type === 'init-error') {
        worker.removeEventListener('message', initHandler)
        initState = 'failed'
        reject(new Error(data.error || 'scribe init failed'))
      }
    }
    const errorHandler = (err) => {
      worker.removeEventListener('error', errorHandler)
      initState = 'failed'
      reject(new Error(err && err.message ? err.message : 'worker failed to start'))
    }
    worker.addEventListener('message', initHandler)
    worker.addEventListener('error', errorHandler)
    wireWorker(worker)
    worker.postMessage({ type: 'init', vendorPath })
  })

  return initPromise
}

function sendOcr(message, transferables, timeout) {
  if (!ocrWorker || initState !== 'ready') {
    return Promise.reject(new Error('OCR worker not initialised'))
  }
  const id = nextRequestId++
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (pendingOcr.has(id)) {
        pendingOcr.delete(id)
        reject(new Error('OCR timeout'))
      }
    }, timeout)
    pendingOcr.set(id, { resolve, reject, timeoutId })
    try {
      ocrWorker.postMessage({ ...message, id }, transferables)
    } catch (err) {
      pendingOcr.delete(id)
      clearTimeout(timeoutId)
      reject(err)
    }
  })
}

/** OCR the first pages of a PDF. Default budget: 15 seconds. */
export async function ocrFirstPages(pdfBlob, options = {}) {
  const {
    maxPages = 2,
    language = 'eng',
    timeout = OCR_TIMEOUT_MS,
  } = options
  const pdfBuffer = await pdfBlob.arrayBuffer()
  return sendOcr(
    { type: 'ocr', pdfBuffer, maxPages, language },
    [pdfBuffer],
    timeout,
  )
}

/** OCR up to `maxPages` raw image Blobs (camera path). First page by default. */
export async function ocrFirstImage(imageBlobs, options = {}) {
  const {
    maxPages = 1,
    language = 'eng',
    timeout = OCR_TIMEOUT_MS,
  } = options
  const blobs = Array.isArray(imageBlobs) ? imageBlobs : [imageBlobs]
  if (blobs.length === 0) throw new Error('no image blobs supplied')

  const imageBuffers = await Promise.all(blobs.map((blob) => blob.arrayBuffer()))
  const imageType = blobs[0]?.type || 'image/jpeg'
  return sendOcr(
    { type: 'ocr-image', imageBuffers, imageType, maxPages, language },
    imageBuffers,
    timeout,
  )
}

/** Tear down the worker and fail any in-flight calls. Safe to call twice. */
export function terminateScribe() {
  if (!ocrWorker) return
  for (const [, entry] of pendingOcr) {
    clearTimeout(entry.timeoutId)
    entry.reject(new Error('OCR worker terminated'))
  }
  pendingOcr.clear()
  try {
    ocrWorker.postMessage({ type: 'terminate' })
  } catch {
    // Closing anyway.
  }
  try {
    ocrWorker.terminate()
  } catch {
    // Closing anyway.
  }
  ocrWorker = null
  initPromise = null
  initState = 'pending'
}

/** Thin object API for callers that prefer a client instance. */
export class OcrClient {
  init(options) {
    return initScribe(options)
  }
  ocrPdf(blob, options) {
    return ocrFirstPages(blob, options)
  }
  ocrImage(blobs, options) {
    return ocrFirstImage(blobs, options)
  }
  terminate() {
    terminateScribe()
  }
}

export const runOcrOnPdf = ocrFirstPages
export const runOcrOnImage = ocrFirstImage
export const BULK_OCR_BUDGET_MS = BULK_OCR_TIMEOUT_MS
