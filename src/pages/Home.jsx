import { useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import StatsStrip from '../components/layout/StatsStrip'
import SearchBar from '../components/search/SearchBar'
import FilterChips from '../components/search/FilterChips'
import PaperGrid from '../components/search/PaperGrid'
import useArchiveSearch from '../hooks/useArchiveSearch'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlYear = searchParams.get('year')
  const urlExamType = searchParams.get('examType')
  const urlUniversity = searchParams.get('university')
  const urlUniversityName = searchParams.get('universityName')

  const initialFilters = useMemo(() => {
    const f = {}
    if (urlYear) f['date'] = urlYear
    if (urlExamType) f['exam-type'] = urlExamType
    if (urlUniversity) f['subject'] = urlUniversity
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(initialFilters)
  const [universityName, setUniversityName] = useState(urlUniversityName || '')

  const { results, isLoading, error, totalResults, loadMore } =
    useArchiveSearch({ query, filters })

  const hasMore = results.length < totalResults

  const hasQuery = query.trim().length > 0
  const chipFilterKeys = Object.keys(filters).filter((k) => k !== 'subject')
  const hasChipFilters = chipFilterKeys.length > 0
  const hasUniversityFilter = Boolean(filters['subject'])
  const isFiltered = hasQuery || hasChipFilters || hasUniversityFilter

  const handleSearch = useCallback((value) => {
    setQuery(value)
  }, [])

  const handleFilterChange = useCallback(
    (nextFilters) => {
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
    setSearchParams((prev) => {
      prev.delete('university')
      prev.delete('universityName')
      return prev
    })
  }, [setSearchParams])

  let sectionTitle = 'Recent Uploads'
  let resultCountText = ''

  if (hasQuery) {
    sectionTitle = `Search Results for \u201c${query}\u201d`
    resultCountText = `${totalResults} paper${totalResults !== 1 ? 's' : ''} found`
  } else if (isFiltered) {
    sectionTitle = 'Filtered Results'
    resultCountText = `${totalResults} paper${totalResults !== 1 ? 's' : ''} found`
  }

  const emptyMessage = hasQuery
    ? `No papers found for \u201c${query}\u201d`
    : isFiltered
      ? 'No papers match the selected filters'
      : 'No papers uploaded yet. Be the first to contribute!'

  return (
    <>
      {/* Hero Section — compact on mobile */}
      <section className="max-w-4xl mx-auto py-8 md:py-16 px-4 sm:px-6 text-center">
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-pyqp-text">
          Discover Previous Year Question Papers
        </h1>
        <p className="text-base md:text-lg text-pyqp-text-light text-center mt-3 md:mt-4">
          Search, browse, and download university exam papers. Free forever,
          powered by the Internet Archive.
        </p>
        <div className="mt-6 md:mt-8">
          <SearchBar onSearch={handleSearch} initialQuery={query} />
        </div>
      </section>

      <StatsStrip />

      {/* Results Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Filter chips */}
        <div className="mb-6">
          <FilterChips
            activeFilters={filters}
            onFilterChange={handleFilterChange}
          />
        </div>

        {/* University banner */}
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
          <h2 className="font-heading text-xl md:text-2xl font-bold">{sectionTitle}</h2>
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
    </>
  )
}
