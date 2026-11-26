/**
 * Bulk upload state and orchestration, ported from the Zustand store and the
 * useBulkUpload / useBulkOcr hooks. No React: callers pass callbacks (or the
 * bundled plain store) and inject every side effect.
 */

import {
  BULK_HARD_LIMIT,
  BULK_MAX_CONCURRENCY,
  BULK_OCR_TIMEOUT_MS,
  BULK_RETRY_DELAYS_MS,
  BULK_SOFT_LIMIT,
  EXAM_TYPES,
  MAX_FILE_BYTES,
} from './constants.js'
import { hashFile, layer2IdentifierCheck } from './dedup.js'
import { buildMetadataHeaders, makeIdentifier } from './metadata.js'
import { extractMetadata } from './metadataExtract.js'
import { apiPost } from './fetch.js'

export const VALID_EXAM_TYPES = EXAM_TYPES
const CURRENT_YEAR = () => new Date().getFullYear()

let idCounter = 0

/** trim → uppercase → collapse whitespace and hyphens */
export function normaliseBulkCourseCode(code) {
  if (!code || typeof code !== 'string') return ''
  return code.trim().toUpperCase().replace(/[\s-]+/g, '')
}

export const normalizeBulkCourseCode = normaliseBulkCourseCode

export function computeIdentifier(metadata, institution) {
  if (!institution?.qid) return null
  const code = normaliseBulkCourseCode(metadata.courseCode)
  if (!code || !metadata.year || !metadata.examType) return null
  return makeIdentifier({
    wikidataQid: institution.qid,
    courseCode: code,
    year: metadata.year,
    examType: metadata.examType,
  })
}

export function computeIsReady(metadata, institution, nowImpl = CURRENT_YEAR) {
  if (!institution?.qid) return false
  if (!normaliseBulkCourseCode(metadata.courseCode)) return false
  if (!metadata.year || !/^\d{4}$/.test(metadata.year)) return false
  const year = parseInt(metadata.year, 10)
  if (year < 1980 || year > nowImpl() + 1) return false
  return VALID_EXAM_TYPES.includes(metadata.examType)
}

export function computeValidationErrors(metadata, nowImpl = CURRENT_YEAR) {
  const errors = {}
  if (!normaliseBulkCourseCode(metadata.courseCode)) errors.courseCode = 'Required'
  if (!metadata.year) {
    errors.year = 'Required'
  } else if (!/^\d{4}$/.test(metadata.year)) {
    errors.year = 'Must be a 4-digit year'
  } else {
    const year = parseInt(metadata.year, 10)
    if (year < 1980 || year > nowImpl() + 1) {
      errors.year = `Must be 1980-${nowImpl() + 1}`
    }
  }
  if (!VALID_EXAM_TYPES.includes(metadata.examType)) errors.examType = 'Required'
  return errors
}

export function createBulkFileRecord(file, options = {}) {
  const { now = Date.now } = options
  return {
    id: `bulk-${now()}-${++idCounter}`,
    file,
    name: file.name,
    size: file.size,
    thumbnailDataUrl: null,
    thumbnailLoading: true,
    hash: null,
    hashStatus: 'idle',
    ocrStatus: 'idle',
    ocrSuggestions: {
      courseName: null,
      courseCode: null,
      examType: null,
      year: null,
      month: null,
    },
    ocrDismissed: {},
    ocrAccepted: {},
    metadata: {
      program: '',
      courseName: '',
      courseCode: '',
      year: '',
      month: '',
      examType: '',
      semester: '',
      language: 'en',
    },
    identifier: null,
    isReady: false,
    validationErrors: {},
    dedupStatus: null,
    duplicateUrl: null,
    uploadStatus: null,
    uploadProgress: 0,
    uploadError: null,
    archiveUrl: null,
    retryCount: 0,
  }
}

export function createBulkState() {
  return {
    files: [],
    institution: { label: '', qid: '' },
    defaultLanguage: 'en',
    uploadStarted: false,
    isUploading: false,
  }
}

function revalidate(file, institution, nowImpl) {
  return {
    ...file,
    isReady: computeIsReady(file.metadata, institution, nowImpl),
    identifier: computeIdentifier(file.metadata, institution),
    validationErrors: computeValidationErrors(file.metadata, nowImpl),
  }
}

/** Plain, synchronous equivalent of the old Zustand store. */
export function createBulkStore(initialState, options = {}) {
  const { now = Date.now, nowYear = CURRENT_YEAR } = options
  let state = initialState || createBulkState()
  const set = (patch) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
    return state
  }
  const updateFile = (id, patch) =>
    set((current) => ({
      files: current.files.map((file) =>
        file.id === id ? { ...file, ...patch } : file,
      ),
    }))

  return {
    getState: () => state,
    setState: set,
    updateFile,
    addFiles(fileObjects, limits = {}) {
      const {
        softLimit = BULK_SOFT_LIMIT,
        hardLimit = BULK_HARD_LIMIT,
      } = limits
      const before = state.files.length
      set((current) => {
        const seen = new Set(current.files.map((file) => file.name))
        const fresh = []
        for (const file of fileObjects) {
          if (seen.has(file.name)) continue
          if (file.type !== 'application/pdf' || file.size > MAX_FILE_BYTES) {
            continue
          }
          if (current.files.length + fresh.length >= hardLimit) break
          seen.add(file.name)
          fresh.push(createBulkFileRecord(file, { now }))
        }
        if (fresh.length === 0) return current
        return { files: [...current.files, ...fresh] }
      })
      return {
        added: state.files.length - before,
        softLimitExceeded: state.files.length > softLimit,
      }
    },
    removeFile(id) {
      return set((current) => ({
        files: current.files.filter((file) => file.id !== id),
      }))
    },
    clearAll() {
      return set({ files: [], uploadStarted: false, isUploading: false })
    },
    setFileMetadata(id, field, value) {
      return set((current) => ({
        files: current.files.map((file) => {
          if (file.id !== id) return file
          return revalidate(
            { ...file, metadata: { ...file.metadata, [field]: value } },
            current.institution,
            nowYear,
          )
        }),
      }))
    },
    setOcrSuggestions(id, suggestions) {
      return set((current) => ({
        files: current.files.map((file) =>
          file.id === id
            ? {
                ...file,
                ocrSuggestions: { ...file.ocrSuggestions, ...suggestions },
                ocrStatus: 'done',
              }
            : file,
        ),
      }))
    },
    acceptOcrField(id, fieldName, value) {
      return set((current) => ({
        files: current.files.map((file) => {
          if (file.id !== id) return file
          const normalised =
            fieldName === 'courseCode' ? normaliseBulkCourseCode(value) : value
          return revalidate(
            {
              ...file,
              ocrAccepted: { ...file.ocrAccepted, [fieldName]: true },
              metadata: { ...file.metadata, [fieldName]: normalised },
            },
            current.institution,
            nowYear,
          )
        }),
      }))
    },
    dismissOcrField(id, fieldName) {
      return set((current) => ({
        files: current.files.map((file) =>
          file.id === id
            ? {
                ...file,
                ocrDismissed: { ...file.ocrDismissed, [fieldName]: true },
              }
            : file,
        ),
      }))
    },
    setThumbnail(id, dataUrl) {
      return updateFile(id, { thumbnailDataUrl: dataUrl, thumbnailLoading: false })
    },
    setThumbnailLoading(id, loading) {
      return updateFile(id, { thumbnailLoading: loading })
    },
    setInstitutionAndRevalidate(institution) {
      return set((current) => ({
        institution,
        files: current.files.map((file) =>
          revalidate(file, institution, nowYear),
        ),
      }))
    },
    setDefaultLanguage(language) {
      return set({ defaultLanguage: language })
    },
    setUploadStarted(value) {
      return set({ uploadStarted: value })
    },
    setIsUploading(value) {
      return set({ isUploading: value })
    },
    reset() {
      return set(createBulkState())
    },
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Serial OCR over the bulk queue: one file at a time, one shared worker,
 * first page only, 8 s per file. Failures are silent (`ocrStatus: 'skipped'`)
 * and suggestions are never applied to metadata automatically.
 */
export async function runBulkOcr({
  store,
  init = null,
  ocr = null,
  extract = extractMetadata,
  timeoutMs = BULK_OCR_TIMEOUT_MS,
  isActive = () => true,
  schedule = (fn) => setTimeout(fn, 0),
} = {}) {
  if (!store) throw new Error('runBulkOcr needs a bulk store')
  let initialised = false

  for (;;) {
    if (!isActive()) return
    const next = store.getState().files.find((file) => file.ocrStatus === 'idle')
    if (!next) return

    store.updateFile(next.id, { ocrStatus: 'running' })
    try {
      if (init) {
        if (!initialised) {
          await init()
          initialised = true
        }
        if (!isActive()) return
        const { text } = await ocr(next.file, {
          maxPages: 1,
          language: 'eng',
          timeout: timeoutMs,
        })
        const { suggestions } = extract(text || '')
        if (suggestions.courseCode) {
          suggestions.courseCode = normaliseBulkCourseCode(
            suggestions.courseCode,
          )
        }
        if (isActive()) store.setOcrSuggestions(next.id, suggestions)
      } else {
        // No OCR engine available: mark as skipped rather than spinning.
        store.updateFile(next.id, { ocrStatus: 'skipped' })
      }
    } catch (err) {
      console.warn(
        `[bulk] OCR skipped for "${next.file?.name || next.name}":`,
        err && err.message ? err.message : err,
      )
      if (isActive()) store.updateFile(next.id, { ocrStatus: 'skipped' })
    }

    if (!isActive()) return
    // Yield between files so state updates can flush and the stack stays flat.
    await new Promise((resolve) => schedule(resolve))
  }
}

/**
 * Bounded-concurrency upload engine (max 3 PUTs). Hash → in-batch hash
 * dedup → Archive.org identifier check → PUT with retries.
 *
 * The remote layer-1 hash search is intentionally NOT called here: bulk
 * already compares hashes inside the batch, and the IAS3 checksum header
 * enforced by /api/upload catches cross-batch duplicates.
 */
export async function startBulkUpload({
  store,
  auth = {},
  fetchImpl,
  hash = hashFile,
  dedupCheck = layer2IdentifierCheck,
  headers = buildMetadataHeaders,
  sleepImpl = sleep,
  retryDelays = BULK_RETRY_DELAYS_MS,
  concurrency = BULK_MAX_CONCURRENCY,
  timeoutMs = 0,
} = {}) {
  if (!store) throw new Error('startBulkUpload needs a bulk store')

  store.setUploadStarted(true)
  store.setIsUploading(true)
  const readyFiles = store
    .getState()
    .files.filter((file) => file.isReady && file.uploadStatus === null)

  if (readyFiles.length === 0) {
    store.setIsUploading(false)
    return { uploaded: 0, skipped: 0, failed: 0, aborted: false }
  }

  const completedHashes = new Set()
  const counts = { uploaded: 0, skipped: 0, failed: 0, aborted: false }
  let aborted = false
  let queueIndex = 0
  let activeSlots = 0

  await new Promise((resolveAll) => {
    const checkFinished = () => {
      if (queueIndex >= readyFiles.length && activeSlots === 0) resolveAll()
    }

    const dispatchNext = () => {
      while (
        activeSlots < concurrency &&
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

      if (aborted) {
        while (queueIndex < readyFiles.length) {
          const record = readyFiles[queueIndex++]
          store.updateFile(record.id, {
            uploadStatus: 'failed',
            uploadError: 'session_expired',
          })
          counts.failed++
        }
        checkFinished()
      }
    }

    dispatchNext()
  })

  store.setIsUploading(false)
  return counts

  async function processFile(record) {
    if (aborted) {
      store.updateFile(record.id, {
        uploadStatus: 'failed',
        uploadError: 'session_expired',
      })
      counts.failed++
      return
    }

    store.updateFile(record.id, { uploadStatus: 'pending' })

    // Step 1: hash (always off the main thread in bulk).
    let fileHash = record.hash
    if (!fileHash || record.hashStatus !== 'done') {
      store.updateFile(record.id, { hashStatus: 'running' })
      try {
        fileHash = await hash(record.file, { forceWorker: true })
        store.updateFile(record.id, { hash: fileHash, hashStatus: 'done' })
      } catch (err) {
        console.error(`[bulk] Hash failed for "${record.name}":`, err)
        store.updateFile(record.id, {
          uploadStatus: 'failed',
          uploadError: 'Failed to compute file hash',
          hashStatus: 'failed',
        })
        counts.failed++
        return
      }
    }

    if (completedHashes.has(fileHash)) {
      store.updateFile(record.id, {
        uploadStatus: 'skipped',
        dedupStatus: 'duplicate',
        duplicateUrl: 'duplicate-in-batch',
      })
      counts.skipped++
      return
    }

    const identifier = record.identifier
    if (!identifier) {
      store.updateFile(record.id, {
        uploadStatus: 'failed',
        uploadError: 'Missing identifier — fill all required fields',
      })
      counts.failed++
      return
    }

    store.updateFile(record.id, { dedupStatus: 'checking' })
    try {
      const { isDuplicate } = await dedupCheck(identifier)
      if (isDuplicate) {
        store.updateFile(record.id, {
          dedupStatus: 'duplicate',
          duplicateUrl: `https://archive.org/details/${identifier}`,
          uploadStatus: 'skipped',
        })
        counts.skipped++
        return
      }
      store.updateFile(record.id, { dedupStatus: 'ok' })
    } catch (err) {
      console.warn(`[bulk] Layer-2 dedup failed for "${record.name}":`, err)
      store.updateFile(record.id, { dedupStatus: 'error' })
    }

    const institution = store.getState().institution
    const meta = headers(
      { ...record.metadata, institution },
      fileHash,
      { source: 'pdf-upload', ocrAccepted: record.ocrAccepted },
    )

    let lastError = null
    for (let attempt = 0; attempt <= 2; attempt++) {
      if (aborted) {
        store.updateFile(record.id, {
          uploadStatus: 'failed',
          uploadError: 'session_expired',
        })
        counts.failed++
        return
      }
      if (attempt > 0) await sleepImpl(retryDelays[attempt - 1])

      store.updateFile(record.id, {
        uploadStatus: 'uploading',
        retryCount: attempt,
      })

      try {
        const form = new FormData()
        form.append('accessKey', auth.accessKey || '')
        form.append('secretKey', auth.secretKey || '')
        form.append('identifier', identifier)
        form.append('file', record.file)
        form.append('meta', JSON.stringify(meta))

        const res = await apiPost('/api/upload', form, {
          fetchImpl,
          timeoutMs,
        })

        if (res.ok) {
          completedHashes.add(fileHash)
          store.updateFile(record.id, {
            uploadStatus: 'done',
            uploadProgress: 1,
            archiveUrl: `https://archive.org/details/${identifier}`,
          })
          counts.uploaded++
          return
        }

        if (res.status === 401) {
          aborted = true
          counts.aborted = true
          store.updateFile(record.id, {
            uploadStatus: 'failed',
            uploadError: 'session_expired',
          })
          counts.failed++
          for (const file of store.getState().files) {
            if (file.uploadStatus === null || file.uploadStatus === 'pending') {
              store.updateFile(file.id, {
                uploadStatus: 'failed',
                uploadError: 'session_expired',
              })
            }
          }
          return
        }

        if (res.status === 429 || res.status === 503) {
          const retryAfter = parseInt(res.headers?.get?.('Retry-After'), 10)
          if (!Number.isNaN(retryAfter) && retryAfter > 0) {
            await sleepImpl(Math.min(retryAfter * 1000, 60_000))
          }
          lastError = `rate_limited (HTTP ${res.status})`
        } else {
          lastError = `rejected (HTTP ${res.status})`
        }
      } catch {
        lastError = 'network'
      }
    }

    store.updateFile(record.id, {
      uploadStatus: 'failed',
      uploadError: lastError || 'unknown',
    })
    counts.failed++
  }
}
