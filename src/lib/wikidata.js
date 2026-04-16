/**
 * Wikidata SPARQL templates and parsers for institution lookup.
 * Fetches universities live from Wikidata and caches in localStorage.
 */

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

const CACHE_KEY = 'quarchive_universities_cache'
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

export function buildUniversitySparql(searchTerm = '', limit = 1000) {
  const filter = searchTerm
    ? `FILTER(CONTAINS(LCASE(?itemLabel), LCASE("${searchTerm.replace(/"/g, '\\"')}"))) .`
    : ''

  return `
SELECT ?item ?itemLabel ?itemAltLabel WHERE {
  ?item wdt:P31 wd:Q3918.
  ?item wdt:P17 wd:Q668.
  ${filter}
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en,ml,hi,ta,te,kn".
  }
}
ORDER BY ?itemLabel
LIMIT ${limit}
`.trim()
}

/**
 * Parse Wikidata SPARQL JSON results into a flat array of university objects.
 */
export function parseWikidataResults(json) {
  const bindings = json?.results?.bindings || []

  return bindings
    .map((b) => {
      const uri = b.item?.value || ''
      const qid = uri.split('/').pop() || ''
      const label = b.itemLabel?.value || ''

      return {
        label,
        qid,
        altLabel: b.itemAltLabel?.value || '',
      }
    })
    .filter((r) => r.label && r.qid && !/^Q\d+$/.test(r.label))
}

/**
 * Get the full university list — from localStorage cache if fresh,
 * otherwise fetched live from Wikidata SPARQL.
 *
 * @returns {Promise<Array<{label: string, qid: string, altLabel?: string}>>}
 */
export async function getUniversityList() {
  // Try cache first
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data) && data.length > 0) {
        return data
      }
    }
  } catch {
    // Cache read failed — proceed to fetch
  }

  // Fetch live from Wikidata
  const data = await fetchUniversitiesFromWikidata()

  // Cache the result
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }))
  } catch {
    // localStorage full or unavailable — no-op
  }

  return data
}

/**
 * Fetch the full list of Indian universities from Wikidata SPARQL.
 */
async function fetchUniversitiesFromWikidata() {
  const sparql = buildUniversitySparql('', 1000)
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
    },
  })

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL query failed: ${res.status}`)
  }

  const json = await res.json()
  return parseWikidataResults(json)
}

/**
 * Search universities from the cached/fetched list.
 * Performs case-insensitive substring matching on label and altLabel.
 *
 * @param {string} query - Search string
 * @param {Array<{label: string, qid: string, altLabel?: string}>} list - The university list
 * @returns {Array<{label: string, qid: string, altLabel?: string}>}
 */
export function searchUniversitiesLocal(query, list) {
  if (!query || !query.trim()) return list.slice(0, 20)

  const q = query.toLowerCase().trim()
  return list.filter((item) => {
    const labelMatch = item.label?.toLowerCase().includes(q)
    const altMatch = item.altLabel?.toLowerCase().includes(q)
    return labelMatch || altMatch
  })
}

/**
 * Search universities via live Wikidata SPARQL query.
 * Used as a fallback when local search returns zero matches.
 * NOTE: Debounce enforcement (500ms) should be handled in the calling hook, not here.
 *
 * @param {string} query - Search term
 * @returns {Promise<Array<{label: string, qid: string, altLabel?: string}>>}
 */
export async function searchUniversitiesRemote(query) {
  const sparql = buildUniversitySparql(query, 50)
  const url = `${WIKIDATA_SPARQL_ENDPOINT}?query=${encodeURIComponent(sparql)}`

  const res = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
    },
  })

  if (!res.ok) {
    throw new Error(`Wikidata SPARQL query failed: ${res.status}`)
  }

  const json = await res.json()
  return parseWikidataResults(json)
}
