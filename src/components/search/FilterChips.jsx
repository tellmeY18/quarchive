import { useCallback } from "react"

const FILTER_GROUPS = [
  {
    label: "Year",
    key: "date",
    chips: [
      { display: "2024", value: "2024" },
      { display: "2023", value: "2023" },
      { display: "2022", value: "2022" },
      { display: "2021", value: "2021" },
      { display: "2020", value: "2020" },
      { display: "2019", value: "2019" },
    ],
  },
  {
    label: "Exam Type",
    key: "exam-type",
    chips: [
      { display: "Main", value: "main" },
      { display: "Supplementary", value: "supplementary" },
      { display: "Model", value: "model" },
      { display: "Improvement", value: "improvement" },
    ],
  },
  {
    label: "Language",
    key: "language",
    chips: [
      { display: "English", value: "en" },
      { display: "Malayalam", value: "ml" },
      { display: "Hindi", value: "hi" },
      { display: "Tamil", value: "ta" },
      { display: "Telugu", value: "te" },
      { display: "Kannada", value: "kn" },
    ],
  },
]

export default function FilterChips({ onFilterChange, activeFilters = {} }) {
  const hasActiveFilters = Object.keys(activeFilters).length > 0

  const handleChipClick = useCallback(
    (groupKey, chipValue) => {
      const next = { ...activeFilters }

      // Radio-like toggle: clicking the already-active chip deselects it
      if (next[groupKey] === chipValue) {
        delete next[groupKey]
      } else {
        next[groupKey] = chipValue
      }

      if (onFilterChange) onFilterChange(next)
    },
    [activeFilters, onFilterChange],
  )

  const handleClearAll = useCallback(() => {
    if (onFilterChange) onFilterChange({})
  }, [onFilterChange])

  return (
    <div className="px-1">
      <div className="flex flex-wrap items-center gap-4">
        {FILTER_GROUPS.map((group) => (
          <div key={group.key} className="flex items-center gap-2">
            <span className="text-sm font-medium text-pyqp-muted">
              {group.label}:
            </span>
            <div className="flex flex-wrap gap-2">
              {group.chips.map((chip) => {
                const isActive = activeFilters[group.key] === chip.value
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handleChipClick(group.key, chip.value)}
                    className={`inline-block px-3 py-1.5 text-sm rounded-full border cursor-pointer transition-colors ${
                      isActive
                        ? "bg-pyqp-accent text-white border-pyqp-accent"
                        : "border-pyqp-border text-pyqp-text-light hover:bg-pyqp-accent hover:text-white hover:border-pyqp-accent"
                    }`}
                  >
                    {chip.display}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {/* Clear all button — visible only when any filter is active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="ml-2 px-3 py-1.5 text-sm rounded-full text-pyqp-muted hover:text-pyqp-text hover:bg-pyqp-bg transition-colors cursor-pointer"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
