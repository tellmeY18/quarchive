// Web Worker: computes SHA-256 hash of an ArrayBuffer off the main thread.
// Used by useFileHash for files larger than 10MB.
self.onmessage = async (e) => {
  try {
    const buffer = e.data
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    self.postMessage({ hash: hashHex })
  } catch (err) {
    self.postMessage({ error: err.message })
  }
}
