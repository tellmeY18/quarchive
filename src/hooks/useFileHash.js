import { useState, useCallback } from 'react'

const TEN_MB = 10 * 1024 * 1024

/**
 * Compute SHA-256 on the main thread (files <= 10MB).
 */
async function hashOnMainThread(file) {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Compute SHA-256 in a Web Worker (files > 10MB).
 * Uses Vite-compatible Worker instantiation.
 */
async function hashInWorker(file) {
  const buffer = await file.arrayBuffer()

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/hashWorker.js', import.meta.url),
      { type: 'module' }
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
      reject(new Error(err.message || 'Worker error during hashing'))
    }

    worker.postMessage(buffer, [buffer])
  })
}

/**
 * Hook for computing SHA-256 file hashes.
 *
 * Files <= 10MB are hashed on the main thread.
 * Files > 10MB are hashed in a Web Worker to avoid blocking the UI.
 *
 * @returns {{ hash: string|null, isHashing: boolean, error: string|null, computeHash: (file: File) => Promise<string> }}
 */
export default function useFileHash() {
  const [hash, setHash] = useState(null)
  const [isHashing, setIsHashing] = useState(false)
  const [error, setError] = useState(null)

  const computeHash = useCallback(async (file) => {
    setHash(null)
    setError(null)
    setIsHashing(true)

    try {
      const hexHash = file.size > TEN_MB
        ? await hashInWorker(file)
        : await hashOnMainThread(file)

      setHash(hexHash)
      setIsHashing(false)
      return hexHash
    } catch (err) {
      const message = err.message || 'Failed to compute file hash'
      setError(message)
      setIsHashing(false)
      throw err
    }
  }, [])

  return { hash, isHashing, error, computeHash }
}
