/**
 * Hash-route parser/formatter. The URL is state: no History API rewrites
 * are needed on static hosting.
 *
 * Supported routes: `#/`, `#/browse`, `#/upload`, `#/upload/bulk`,
 * `#/paper/:id`, `#/about`. Query params: q, university, universityName,
 * year, examType. Anything else falls back to home.
 */

/** @typedef {{view: string, params: Object<string,string>}} Route */

export const VIEWS = ['home', 'browse', 'upload', 'upload/bulk', 'paper', 'about']
export const QUERY_KEYS = ['q', 'university', 'universityName', 'year', 'examType']

const PATH_FOR_VIEW = {
  home: '',
  browse: 'browse',
  upload: 'upload',
  'upload/bulk': 'upload/bulk',
  paper: 'paper',
  about: 'about',
}

const VIEW_FOR_PATH = Object.fromEntries(
  Object.entries(PATH_FOR_VIEW).map(([view, path]) => [path, view]),
)

/** @returns {Route} */
export function homeRoute() {
  return { view: 'home', params: {} }
}

/**
 * Parse a hash (or bare path) into a route.
 *
 * @param {string} [hash=globalThis.location?.hash ?? '']
 * @returns {Route} Malformed routes become `{ view: 'home', params: {} }`
 */
export function parseHash(hash = globalThis.location?.hash ?? '') {
  try {
    let raw = String(hash || '').trim()
    if (raw.startsWith('#')) raw = raw.slice(1)
    if (raw.startsWith('?')) raw = `/${raw}`

    const question = raw.indexOf('?')
    const pathPart = question === -1 ? raw : raw.slice(0, question)
    const queryPart = question === -1 ? '' : raw.slice(question + 1)

    const path = pathPart.replace(/^\//, '').replace(/\/+$/, '')
    const segments = path ? path.split('/') : []

    let view
    let id

    if (segments.length === 0) {
      view = 'home'
    } else if (segments[0] === 'paper') {
      if (segments.length !== 2 || !segments[1]) return homeRoute()
      id = decodeURIComponent(segments[1])
      if (!id) return homeRoute()
      view = 'paper'
    } else {
      // Known multi-segment views (currently only `upload/bulk`).
      if (segments.length < 1 || segments.length > 2) return homeRoute()
      const path = decodeURIComponent(segments.join('/'))
      view = VIEW_FOR_PATH[path]
      if (!view) return homeRoute()
    }

    const params = {}
    if (id) params.id = id

    const search = new URLSearchParams(queryPart)
    for (const key of QUERY_KEYS) {
      const value = search.get(key)
      if (value !== null && value !== '') params[key] = value
    }

    return { view, params }
  } catch {
    return homeRoute()
  }
}

/**
 * Format a route back into a hash URL. Unknown views and paper routes without
 * an id fall back to home.
 *
 * @param {Route} route
 * @returns {string}
 */
export function formatRoute(route) {
  if (!route || typeof route !== 'object') return '#/'

  const view = route.view === '/' ? 'home' : route.view
  if (!Object.prototype.hasOwnProperty.call(PATH_FOR_VIEW, view)) return '#/'
  if (view === 'paper' && !route.params?.id) return '#/'

  const path = view === 'paper'
    ? `paper/${encodeURIComponent(route.params.id)}`
    : PATH_FOR_VIEW[view]

  const search = new URLSearchParams()
  for (const key of QUERY_KEYS) {
    const value = route.params?.[key]
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }

  const query = search.toString()
  return `#/${path}${query ? `?${query}` : ''}`
}

/**
 * Parse the current location's hash.
 *
 * @param {{hash?:string,pathname?:string}} [location=globalThis.location]
 * @returns {Route}
 */
export function routeFromLocation(location = globalThis.location) {
  return parseHash(location?.hash || location?.pathname || '')
}

/**
 * Map route params to the Archive.org filter shape used by Home.jsx.
 *
 * @param {Route} route
 * @returns {Object<string,string>}
 */
export function filtersFromRoute(route) {
  const filters = {}
  const params = route?.params || {}
  if (params.year) filters.date = params.year
  if (params.examType) filters['exam-type'] = params.examType
  if (params.university) filters.subject = params.university
  return filters
}

/**
 * Map route params to the free-text search query.
 *
 * @param {Route} route
 * @returns {string}
 */
export function queryFromRoute(route) {
  return route?.params?.q || ''
}
