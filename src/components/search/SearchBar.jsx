import { useState, useRef, useCallback, useEffect } from "react"

const DEBOUNCE_MS = 300

export default function SearchBar({ onSearch, initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery)
  const timerRef = useRef(null)

  // Sync local state if initialQuery prop changes externally
  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const cancelDebounce = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const fireSearch = useCallback(
    (value) => {
      cancelDebounce()
      if (onSearch) onSearch(value)
    },
    [onSearch, cancelDebounce],
  )

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value
      setQuery(value)
      cancelDebounce()
      timerRef.current = setTimeout(() => {
        if (onSearch) onSearch(value)
      }, DEBOUNCE_MS)
    },
    [onSearch, cancelDebounce],
  )

  const handleClear = useCallback(() => {
    setQuery("")
    fireSearch("")
  }, [fireSearch])

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        fireSearch(query)
      } else if (e.key === "Escape") {
        setQuery("")
        fireSearch("")
      }
    },
    [query, fireSearch],
  )

  // Cleanup timer on unmount
  useEffect(() => {
    return () => cancelDebounce()
  }, [cancelDebounce])

  return (
    <div className="relative">
      {/* Magnifying glass icon */}
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-pyqp-muted"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
        />
      </svg>

      <input
        type="text"
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search by university, course, or year..."
        className="w-full bg-white border border-pyqp-border rounded-xl px-12 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-pyqp-accent/30 focus:border-pyqp-accent shadow-sm"
      />

      {/* Clear button -- visible only when query is non-empty */}
      {query.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-pyqp-muted hover:text-pyqp-text hover:bg-pyqp-bg transition-colors cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  )
}
