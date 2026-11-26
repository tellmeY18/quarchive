// Web Worker: SHA-256 digest of an ArrayBuffer, off the main thread.
// Message in: raw ArrayBuffer. Message out: { hash } or { error }.
self.onmessage = async (event) => {
  try {
    const buffer = event.data
    const digest = await crypto.subtle.digest('SHA-256', buffer)
    const hash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    self.postMessage({ hash })
  } catch (err) {
    self.postMessage({ error: err && err.message ? err.message : String(err) })
  }
}
