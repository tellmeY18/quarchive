/**
 * App-facing constants shared by the framework-free logic modules.
 * Values mirror the React source so the UI port keeps the same budgets.
 */

/** Valid Archive.org exam-type metadata values (src/lib/metadata.js). */
export const EXAM_TYPES = [
  'main',
  'supplementary',
  'model',
  'improvement',
  'end-semester',
  'midsemester',
  'make-up',
  're-exam',
  'save-a-year',
]

/** Hard upload size cap: 50 MB (src/lib/metadata.js, bulk picker). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024

/** Files at or under this size are hashed on the main thread. */
export const HASH_WORKER_THRESHOLD_BYTES = 10 * 1024 * 1024

/** A4 page size in PDF points, used by imagesToPdf. */
export const PAGE_SIZE = { width: 595, height: 842 }

/** Default upload/API request budget (ms). */
export const FETCH_TIMEOUT_MS = 15_000

/** Debounce for the paper search box (src/hooks/useArchiveSearch.js). */
export const SEARCH_DEBOUNCE_MS = 300

/** Debounce for institution autocomplete (InstitutionSearch.jsx). */
export const INSTITUTION_DEBOUNCE_MS = 350

/** Default / bulk OCR budgets (ms). */
export const OCR_TIMEOUT_MS = 15_000
export const BULK_OCR_TIMEOUT_MS = 8_000

/** Geolocation request budget and cache freshness (ms). */
export const GEO_TIMEOUT_MS = 10_000
export const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Bulk queue warning / hard limits (BulkUpload.jsx). */
export const BULK_SOFT_LIMIT = 30
export const BULK_HARD_LIMIT = 50

/** Bulk upload concurrency and retry schedule (useBulkUpload.js). */
export const BULK_MAX_CONCURRENCY = 3
export const BULK_RETRY_DELAYS_MS = [1000, 4000, 15000]

/** Warm-start cache cap for Wikidata institution lookups. */
export const INSTITUTION_CACHE_MAX = 500
export const REMOTE_QUERY_CACHE_MAX = 64
export const MIN_REMOTE_QUERY_LENGTH = 3
