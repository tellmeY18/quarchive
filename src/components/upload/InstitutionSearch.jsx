import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getUniversityList,
  searchUniversitiesLocal,
  searchUniversitiesRemote,
} from '../../lib/wikidata'

export default function InstitutionSearch({ value, onChange }) {
  const [query, setQuery] = useState('')
  const [universityList, setUniversityList] = useState([])
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [isLoadingRemote, setIsLoadingRemote] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const remoteFallbackTimer = useRef(null)

  const isSelected = value && value.qid

  // Load the full university list on mount
  useEffect(() => {
    let cancelled = false
    setIsLoadingList(true)
    getUniversityList()
      .then((list) => {
        if (!cancelled) {
          setUniversityList(list)
          setIsLoadingList(false)
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoadingList(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup remote fallback timer on unmount
  useEffect(() => {
    return () => {
      if (remoteFallbackTimer.current) {
        clearTimeout(remoteFallbackTimer.current)
      }
    }
  }, [])

  // Handle input change: local filter + remote fallback
  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value
      setQuery(val)
      setHighlightIndex(-1)

      // Cancel any pending remote fallback
      if (remoteFallbackTimer.current) {
        clearTimeout(remoteFallbackTimer.current)
        remoteFallbackTimer.current = null
      }

      if (!val.trim()) {
        setResults([])
        setIsOpen(false)
        setIsLoadingRemote(false)
        return
      }

      // Local search: synchronous, no debounce needed
      const localResults = searchUniversitiesLocal(val, universityList)
      setResults(localResults.slice(0, 10))
      setIsOpen(true)

      // If local search returns nothing, schedule remote fallback after 500ms
      if (localResults.length === 0) {
        remoteFallbackTimer.current = setTimeout(async () => {
          setIsLoadingRemote(true)
          try {
            const remoteResults = await searchUniversitiesRemote(val)
            setResults(remoteResults.slice(0, 10))
            setIsOpen(true)
          } catch {
            setResults([])
          } finally {
            setIsLoadingRemote(false)
          }
        }, 500)
      }
    },
    [universityList],
  )

  // Select an item
  const handleSelect = useCallback(
    (item) => {
      onChange({ label: item.label, qid: item.qid })
      setQuery('')
      setResults([])
      setIsOpen(false)
      setHighlightIndex(-1)
    },
    [onChange],
  )

  // Clear selection
  const handleClear = useCallback(() => {
    onChange({ label: '', qid: '' })
    setQuery('')
    setResults([])
    setIsOpen(false)
    setHighlightIndex(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [onChange])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen || results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightIndex((prev) => {
            const next = prev < results.length - 1 ? prev + 1 : 0
            scrollToItem(next)
            return next
          })
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightIndex((prev) => {
            const next = prev > 0 ? prev - 1 : results.length - 1
            scrollToItem(next)
            return next
          })
          break
        case 'Enter':
          e.preventDefault()
          if (highlightIndex >= 0 && highlightIndex < results.length) {
            handleSelect(results[highlightIndex])
          }
          break
        case 'Escape':
          setIsOpen(false)
          setHighlightIndex(-1)
          break
      }
    },
    [isOpen, results, highlightIndex, handleSelect],
  )

  // Scroll highlighted item into view
  function scrollToItem(index) {
    if (!listRef.current) return
    const items = listRef.current.querySelectorAll('[data-institution-item]')
    if (items[index]) {
      items[index].scrollIntoView({ block: 'nearest' })
    }
  }

  // Show selected chip state
  if (isSelected) {
    return (
      <div ref={containerRef}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-pyqp-accent/10 border border-pyqp-accent/20 px-3 py-1.5 text-sm text-pyqp-text">
            <span className="font-medium">{value.label}</span>
            <span className="text-xs text-pyqp-muted">({value.qid})</span>
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear institution selection"
              className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full text-pyqp-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.trim() && results.length > 0) setIsOpen(true) }}
          placeholder={isLoadingList ? 'Loading universities...' : 'Start typing university name...'}
          disabled={isLoadingList}
          className="w-full rounded-lg border border-pyqp-border bg-pyqp-card pl-9 pr-3 py-2 text-sm text-pyqp-text placeholder:text-pyqp-muted focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="institution-listbox"
          aria-activedescendant={highlightIndex >= 0 ? 'institution-option-' + highlightIndex : undefined}
        />
        {isLoadingRemote && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-pyqp-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
      </div>

      {isOpen && (
        <ul
          id="institution-listbox"
          ref={listRef}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-pyqp-border bg-pyqp-card shadow-lg"
        >
          {results.length === 0 && !isLoadingRemote && (
            <li className="px-3 py-3 text-sm text-pyqp-muted text-center">
              No universities found. Try a different search term.
            </li>
          )}
          {results.length === 0 && isLoadingRemote && (
            <li className="px-3 py-3 text-sm text-pyqp-muted text-center flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-pyqp-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching Wikidata...
            </li>
          )}
          {results.map((item, index) => (
            <li
              key={item.qid}
              id={'institution-option-' + index}
              data-institution-item
              role="option"
              aria-selected={highlightIndex === index}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={'px-3 py-2.5 cursor-pointer transition-colors ' + (
                highlightIndex === index
                  ? 'bg-pyqp-accent/10 text-pyqp-text'
                  : 'hover:bg-pyqp-bg text-pyqp-text'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.altLabel && (
                    <div className="text-xs text-pyqp-muted truncate mt-0.5">
                      {item.altLabel}
                    </div>
                  )}
                </div>
                <span className="shrink-0 inline-block rounded bg-pyqp-bg border border-pyqp-border px-1.5 py-0.5 text-[10px] font-mono text-pyqp-muted">
                  {item.qid}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
