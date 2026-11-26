/**
 * Archive.org URL builders, search parsing and data access.
 *
 * Pure builders are injected with nothing; network helpers accept
 * `{ fetchImpl, signal, timeoutMs }` so node:test can exercise them.
 * Every search is scoped to `subject:quarchive` — that clause is mandatory
 * and cannot be removed by caller-supplied filters.
 */

import { apiJson } from './fetch.js'

const ARCHIVE_BASE = 'https://archive.org'
const ARCHIVE_S3 = 'https://s3.us.archive.org'
const SEARCH_ENDPOINT = `${ARCHIVE_BASE}/advancedsearch.php`

const SEARCH_FIELDS = [
  'identifier',
  'title',
  'creator',
  'date',
  'subject',
  'description',
  'language',
  'exam-type',
  'course-code',
  'semester',
  'program',
]

/** @param {string} identifier @returns {string} Item details URL */
export function paperItemUrl(identifier) {
  return `${ARCHIVE_BASE}/details/${encodeURIComponent(identifier)}`
}

/** Alias used by the dedup layer when linking to an existing item. */
export const buildItemUrl = paperItemUrl

/**
 * @param {string} identifier
 * @param {string} filename
 * @returns {string} Direct download URL
 */
export function paperDownloadUrl(identifier, filename) {
  return `${ARCHIVE_BASE}/download/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`
}
export const buildDownloadUrl = paperDownloadUrl

/** @param {string} identifier @returns {string} Thumbnail service URL */
export function paperThumbnail(identifier) {
  return `${ARCHIVE_BASE}/services/img/${encodeURIComponent(identifier)}`
}
export const buildThumbnailUrl = paperThumbnail

/** @param {string} identifier @returns {string} Metadata API URL */
export function buildMetadataUrl(identifier) {
  return `${ARCHIVE_BASE}/metadata/${encodeURIComponent(identifier)}`
}

/** @param {string} identifier @param {string} filename @returns {string} IAS3 URL */
export function buildIAS3Url(identifier, filename) {
  return `${ARCHIVE_S3}/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`
}

/**
 * Build an advancedsearch.php URL. Kept byte-identical to the React source.
 *
 * @param {object} [options]
 * @param {string} [options.query=''] Free-text query, appended as an AND clause
 * @param {Object<string,string>} [options.filters={}] Additional AND clauses
 * @param {number} [options.rows=20]
 * @param {number} [options.page=1]
 * @returns {string}
 */
export function buildSearchUrl({ query = '', filters = {}, rows = 20, page = 1 } = {}) {
  let q = 'subject:quarchive'

  for (const [key, value] of Object.entries(filters)) {
    if (value) q += ` AND ${key}:${value}`
  }

  if (query.trim()) q += ` AND ${query.trim()}`

  const params = new URLSearchParams()
  params.set('q', q)
  params.set('output', 'json')
  params.set('rows', String(rows))
  params.set('page', String(page))

  for (const field of SEARCH_FIELDS) params.append('fl[]', field)

  return `${SEARCH_ENDPOINT}?${params.toString()}`
}

/** URL used by the paper-count strip (src/components/layout/StatsStrip.jsx). */
export function buildStatsUrl() {
  return `${SEARCH_ENDPOINT}?q=subject:quarchive&output=json&rows=0`
}

/**
 * Parse advancedsearch response docs into the shape used by paper cards.
 * examType falls back to the 5th segment of the identifier formula.
 *
 * @param {*} json
 * @returns {Array<object>}
 */
export function parseSearchResults(json) {
  const docs = json?.response?.docs || []

  return docs.map((doc) => {
    const subjects = Array.isArray(doc.subject) ? doc.subject : [doc.subject].filter(Boolean)
    const qid = subjects.find((s) => /^Q\d+$/.test(s)) || ''
    const identifier = doc.identifier || ''

    let examType = doc['exam-type'] || ''
    if (!examType && identifier) {
      const parts = identifier.split('--')
      if (parts.length >= 5) examType = parts[4]
    }

    return {
      identifier,
      title: doc.title || '',
      institution: doc.creator || '',
      year: doc.date || '',
      description: doc.description || '',
      language: doc.language || '',
      qid,
      subjects,
      examType,
      thumbnail: paperThumbnail(identifier),
      courseCode: doc['course-code'] || '',
      semester: doc.semester || '',
      program: doc.program || '',
    }
  })
}

/**
 * Search Archive.org.
 *
 * @param {object} [options]
 * @param {string} [options.query=''] Free-text query
 * @param {Object<string,string>} [options.filters={}] AND filters (date,
 *   exam-type, subject, …)
 * @param {number} [options.rows=20]
 * @param {number} [options.page=1]
 * @param {AbortSignal} [options.signal]
 * @param {Function} [options.fetchImpl]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<{results: Array, totalResults: number, page: number}>}
 */
export async function searchPapers({
  query = '',
  filters = {},
  rows = 20,
  page = 1,
  ...deps
} = {}) {
  let url = buildSearchUrl({ query, filters, rows, page })

  // Matches useArchiveSearch.js: most-recently-added first when unfiltered.
  if (!query.trim()) url += '&sort[]=addeddate+desc'

  const json = await apiJson(url, deps)
  return {
    results: parseSearchResults(json),
    totalResults: json?.response?.numFound ?? 0,
    page,
  }
}

/**
 * Fetch raw Archive.org metadata for one identifier.
 *
 * @param {string} identifier
 * @param {object} [deps] `{ fetchImpl, signal, timeoutMs }`
 * @returns {Promise<object|null>} The `metadata` object, or null on failure
 */
export async function getPaperMetadata(identifier, deps = {}) {
  if (!identifier) return null
  try {
    const json = await apiJson(buildMetadataUrl(identifier), deps)
    return json?.metadata || null
  } catch {
    // Missing items and network failures are indistinguishable to callers.
    return null
  }
}

/**
 * Total number of papers tagged `quarchive`.
 *
 * @param {object} [deps] `{ fetchImpl, signal, timeoutMs }`
 * @returns {Promise<number>} numFound, or 0 when the request fails
 */
export async function archiveCount(deps = {}) {
  try {
    const json = await apiJson(buildStatsUrl(), deps)
    return json?.response?.numFound ?? 0
  } catch {
    return 0
  }
}
