import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import Navbar from '../components/layout/Navbar'
import Footer from '../components/layout/Footer'
import StatsStrip from '../components/layout/StatsStrip'
import SearchBar from '../components/search/SearchBar'
import FilterChips from '../components/search/FilterChips'
import PaperGrid from '../components/search/PaperGrid'
import useArchiveSearch from '../hooks/useArchiveSearch'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Read URL params once on mount to seed initial state
  const urlYear = searchParams.get('year')
  const urlExamType = searchParams.get('examType')
  const urlUniversity = searchParams.get('university')
  const urlUniversityName = searchParams.get('universityName')

  // Build initial filters from URL params
  const initialFilters = useMemo(() => {
    const f = {}
    if (urlYear) f['date'] = urlYear
    if (urlExamType) f['exam-type'] = urlExamType
    if (urlUniversity) f['subject'] = urlUniversity
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only compute once on mount

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [universityName, setUniversityName] = useState(urlUniversityName || '')

  const { results, isLoading, error, totalResults, loadMore } =
    useArchiveSearch({ query, filters })

  const hasMore = results.length < totalResults

  // Determine whether any user-driven filters are active
  // (excluding the implicit 'subject' filter from URL since that has its own banner)
  const hasQuery = query.trim().length > 0
  const chipFilterKeys = Object.keys(filters).filter((k) => k !== 'subject')
  const hasChipFilters = chipFilterKeys.length > 0
  const hasUniversityFilter = Boolean(filters['subject'])
  const isFiltered = hasQuery || hasChipFilters || hasUniversityFilter

  // Callbacks -----------------------------------------------------------------

  const handleSearch = useCallback((value) => {
    setQuery(value)
  }, [])

  const handleFilterChange = useCallback(
    (nextFilters) => {
      // Preserve the subject (university) filter from URL params unless explicitly cleared
      if (filters['subject'] && !nextFilters['subject']) {
        nextFilters['subject'] = filters['subject']
      }
      setFilters(nextFilters)
    },
    [filters],
  )

  const clearUniversityFilter = useCallback(() => {
    setUniversityName('')
    setFilters((prev) => {
      const next = { ...prev }
      delete next['subject']
      return next
    })
    // Remove university-related URL params
    setSearchParams((prev) => {
      prev.delete('university')
      prev.delete('universityName')
      return prev
    })
  }, [setSearchParams])

  // Section header ------------------------------------------------------------

  let sectionTitle = 'Recent Uploads'
  let resultCountText = ''

  if (hasQuery) {
    sectionTitle = `Search Results for \u201c${query}\u201d`
    resultCountText = `${totalResults} paper${totalResults !== 1 ? 's' : ''} found`
  } else if (isFiltered) {
    sectionTitle = 'Filtered Results'
    resultCountText = `${totalResults} paper${totalResults !== 1 ? 's' : ''} found`
  }

  // Empty-state message
  const emptyMessage = hasQuery
    ? `No papers found for \u201c${query}\u201d`
    : isFiltered
      ? 'No papers match the selected filters'
      : 'No papers uploaded yet. Be the first to contribute!'

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-4xl mx-auto py-16 px-6 text-center">
          <h1 className="font-heading text-4xl md:text-5xl font-bold text-pyqp-text">
            Discover Previous Year Question Papers
          </h1>
          <p className="text-lg text-pyqp-text-light text-center mt-4">
            Search, browse, and download university exam papers. Free forever,
            powered by the Internet Archive.
          </p>
          <div className="mt-8">
            <SearchBar onSearch={handleSearch} initialQuery={query} />
          </div>
        </section>

        <StatsStrip />

        {/* Results Section */}
        <section className="max-w-7xl mx-auto px-6 py-12">
          {/* Filter chips */}
          <div className="mb-6">
            <FilterChips
              activeFilters={filters}
              onFilterChange={handleFilterChange}
            />
          </div>

          {/* University banner (shown when filtered via URL params) */}
          {hasUniversityFilter && universityName && (
            <div className="mb-6 flex items-center gap-3 rounded-lg bg-pyqp-accent/5 border border-pyqp-accent/20 px-4 py-3">
              <span className="text-pyqp-text font-medium">
                Papers from{' '}
                <span className="font-semibold">{universityName}</span>
              </span>
              <button
                type="button"
                onClick={clearUniversityFilter}
                className="ml-auto text-sm text-pyqp-accent hover:text-pyqp-accent/80 underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Section header */}
          <div className="flex items-baseline gap-3 mb-6">
            <h2 className="font-heading text-2xl font-bold">{sectionTitle}</h2>
            {resultCountText && (
              <span className="text-sm text-pyqp-muted">{resultCountText}</span>
            )}
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Paper grid */}
          <PaperGrid
            papers={results}
            loading={isLoading}
            onLoadMore={loadMore}
            hasMore={hasMore}
            emptyMessage={emptyMessage}
          />
        </section>
      </main>
      <Footer />
    </div>
  )
}
