import { useState, useEffect, useRef, useCallback } from 'react'
import { buildSearchUrl, parseSearchResults } from '../lib/archiveOrg'

const DEBOUNCE_MS = 300

/**
 * Archive.org search hook with debounced queries, pagination, and error handling.
 *
 * @param {Object} options
 * @param {string} options.query  — free-text search term (default '')
 * @param {Object} options.filters — key/value pairs appended as AND clauses (default {})
 * @returns {{ results, isLoading, error, totalResults, page, loadMore }}
 */
export default function useArchiveSearch({ query = '', filters = {} } = {}) {
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [totalResults, setTotalResults] = useState(0)
  const [page, setPage] = useState(1)

  // Ref to hold the debounce timer so we can clear it across renders
  const timerRef = useRef(null)
  // Ref to track the latest fetch so stale responses are discarded
  const fetchIdRef = useRef(0)

  // Serialise filters to a stable string for the effect dependency
  const filterKey = JSON.stringify(filters)

  /**
   * Core fetch function — called for both initial searches and loadMore.
   * `pageNum` decides which page to request.
   * `append` controls whether results are appended (pagination) or replaced.
   */
  const doFetch = useCallback(
    async (pageNum, append = false) => {
      const id = ++fetchIdRef.current
      setIsLoading(true)
      setError(null)

      try {
        let url = buildSearchUrl({ query, filters, page: pageNum })

        // When there is no user query, sort by most-recently-added
        if (!query.trim()) {
          url += '&sort[]=addeddate+desc'
        }

        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`Archive.org returned ${res.status}`)
        }

        const json = await res.json()

        // Guard against stale responses arriving after a newer request
        if (id !== fetchIdRef.current) return

        const parsed = parseSearchResults(json)
        const total = json?.response?.numFound ?? 0

        setTotalResults(total)
        setResults((prev) => (append ? [...prev, ...parsed] : parsed))
      } catch (err) {
        if (id !== fetchIdRef.current) return
        setError(err.message || 'Search failed')
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, filterKey],
  )

  // Debounced effect: triggers whenever query or filters change
  useEffect(() => {
    // Reset to page 1 whenever search params change
    setPage(1)

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(() => {
      doFetch(1, false)
    }, DEBOUNCE_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [doFetch])

  /**
   * Load the next page of results and append them to the existing list.
   */
  const loadMore = useCallback(() => {
    const nextPage = page + 1
    setPage(nextPage)
    doFetch(nextPage, true)
  }, [page, doFetch])

  return { results, isLoading, error, totalResults, page, loadMore }
}
