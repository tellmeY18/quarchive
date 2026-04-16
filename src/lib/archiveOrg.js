/**
 * Archive.org URL builders and helper functions.
 * All functions are pure — no side effects, no fetch calls.
 */

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

export function buildItemUrl(identifier) {
  return `${ARCHIVE_BASE}/details/${encodeURIComponent(identifier)}`
}

export function buildDownloadUrl(identifier, filename) {
  return `${ARCHIVE_BASE}/download/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`
}

export function buildThumbnailUrl(identifier) {
  return `${ARCHIVE_BASE}/services/img/${encodeURIComponent(identifier)}`
}

export function buildMetadataUrl(identifier) {
  return `${ARCHIVE_BASE}/metadata/${encodeURIComponent(identifier)}`
}

export function buildIAS3Url(identifier, filename) {
  return `${ARCHIVE_S3}/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`
}

export function buildSearchUrl({ query = '', filters = {}, rows = 20, page = 1 } = {}) {
  let q = 'subject:quarchive'

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      q += ` AND ${key}:${value}`
    }
  }

  if (query.trim()) {
    q += ` AND ${query.trim()}`
  }

  const params = new URLSearchParams()
  params.set('q', q)
  params.set('output', 'json')
  params.set('rows', String(rows))
  params.set('page', String(page))

  for (const field of SEARCH_FIELDS) {
    params.append('fl[]', field)
  }

  return `${SEARCH_ENDPOINT}?${params.toString()}`
}

export function parseSearchResults(json) {
  const docs = json?.response?.docs || []

  return docs.map((doc) => {
    const subjects = Array.isArray(doc.subject) ? doc.subject : [doc.subject].filter(Boolean)
    const qid = subjects.find((s) => /^Q\d+$/.test(s)) || ''
    const identifier = doc.identifier || ''

    // Extract examType from metadata field, falling back to parsing from identifier
    // Identifier pattern: quarchive--{qid}--{slug}--{year}--{examType}
    let examType = doc['exam-type'] || ''
    if (!examType && identifier) {
      const parts = identifier.split('--')
      if (parts.length >= 5) {
        examType = parts[4]
      }
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
      thumbnail: buildThumbnailUrl(identifier),
      courseCode: doc['course-code'] || '',
      semester: doc.semester || '',
      program: doc.program || '',
    }
  })
}
