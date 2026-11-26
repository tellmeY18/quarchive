/**
 * OCR worker. The only place that loads scribe.js and its WASM assets.
 * All assets are same-origin (/vendor/scribe/) and the instance is reused for
 * the lifetime of the worker. Failures are posted back, never thrown to self.
 */

let scribe = null
let initFailed = false

async function loadScribe(vendorPath) {
  const base = String(vendorPath || '/vendor/scribe/').endsWith('/')
    ? vendorPath
    : `${vendorPath}/`
  const url = new URL(`${base}scribe.js`, self.location.origin).toString()
  const mod = await import(/* @vite-ignore */ url)
  return mod.default || mod.scribe || mod
}

async function handleInit(vendorPath) {
  if (scribe) return { ok: true }
  if (initFailed) return { ok: false, error: 'previous init failed' }
  try {
    scribe = await loadScribe(vendorPath)
    if (typeof scribe.init === 'function') {
      await scribe.init({ ocr: true, font: true })
    }
    return { ok: true }
  } catch (err) {
    initFailed = true
    scribe = null
    return { ok: false, error: err && err.message ? err.message : String(err) }
  }
}

async function clearScribeState() {
  if (typeof scribe.clear === 'function') {
    try {
      await scribe.clear()
    } catch {
      // Non-fatal.
    }
  }
}

async function recognizeAndExport({ maxPages, language }) {
  await scribe.recognize({ langs: [language], mode: 'speed' })

  let text = ''
  if (typeof scribe.exportData === 'function') {
    try {
      text = await scribe.exportData('txt', 0, Math.max(0, maxPages - 1))
    } catch {
      text = ''
    }
  }

  let layout = {}
  try {
    if (scribe.data && scribe.data.ocr && scribe.data.ocr.active) {
      const pages = scribe.data.ocr.active
      layout = { pageCount: Array.isArray(pages) ? pages.length : 0 }
    }
  } catch {
    layout = {}
  }

  return { text: typeof text === 'string' ? text : '', layout }
}

async function handleOcr({ pdfBuffer, maxPages = 2, language = 'eng' }) {
  if (!scribe) throw new Error('scribe not initialised')
  await clearScribeState()
  await scribe.importFiles({ pdfFiles: [pdfBuffer] })
  return recognizeAndExport({ maxPages, language })
}

async function handleOcrImage({
  imageBuffers,
  imageType = 'image/jpeg',
  maxPages = 1,
  language = 'eng',
}) {
  if (!scribe) throw new Error('scribe not initialised')
  if (!Array.isArray(imageBuffers) || imageBuffers.length === 0) {
    throw new Error('no image buffers supplied')
  }
  void imageType // kept for forward compatibility with sniffing importers
  await clearScribeState()
  await scribe.importFiles({ imageFiles: imageBuffers })
  return recognizeAndExport({ maxPages, language })
}

self.addEventListener('message', async (event) => {
  const data = event.data || {}

  if (data.type === 'init') {
    const result = await handleInit(data.vendorPath || '/vendor/scribe/')
    self.postMessage(
      result.ok
        ? { type: 'init-complete' }
        : { type: 'init-error', error: result.error },
    )
    return
  }

  if (data.type === 'ocr' || data.type === 'ocr-image') {
    const { id } = data
    try {
      const result =
        data.type === 'ocr'
          ? await handleOcr(data)
          : await handleOcrImage(data)
      self.postMessage({ type: 'ocr-result', id, ...result })
    } catch (err) {
      self.postMessage({
        type: 'ocr-error',
        id,
        error: err && err.message ? err.message : String(err),
      })
    }
    return
  }

  if (data.type === 'terminate') {
    try {
      if (scribe && typeof scribe.terminate === 'function') {
        await scribe.terminate()
      }
    } catch {
      // Closing anyway.
    }
    self.close()
  }
})
