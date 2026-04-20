import { useCallback } from "react";

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
      { display: "End Semester", value: "end-semester" },
      { display: "Midsemester", value: "midsemester" },
      { display: "Make Up", value: "make-up" },
      { display: "Re-Exam", value: "re-exam" },
      { display: "Save A Year", value: "save-a-year" },
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
];

export default function FilterChips({ onFilterChange, activeFilters = {} }) {
  const hasActiveFilters = Object.keys(activeFilters).length > 0;

  const handleChipClick = useCallback(
    (groupKey, chipValue) => {
      const next = { ...activeFilters };
      if (next[groupKey] === chipValue) {
        delete next[groupKey];
      } else {
        next[groupKey] = chipValue;
      }
      if (onFilterChange) onFilterChange(next);
    },
    [activeFilters, onFilterChange],
  );

  const handleClearAll = useCallback(() => {
    if (onFilterChange) onFilterChange({});
  }, [onFilterChange]);

  return (
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex items-center gap-4 min-w-max md:min-w-0 md:flex-wrap">
        {FILTER_GROUPS.map((group) => (
          <div key={group.key} className="flex items-center gap-2">
            <span className="text-sm font-medium text-pyqp-muted whitespace-nowrap">
              {group.label}:
            </span>
            <div className="flex gap-1.5">
              {group.chips.map((chip) => {
                const isActive = activeFilters[group.key] === chip.value;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => handleChipClick(group.key, chip.value)}
                    className={`inline-block px-3 py-1.5 text-sm rounded-full border cursor-pointer transition-colors whitespace-nowrap ${
                      isActive
                        ? "bg-pyqp-accent text-white border-pyqp-accent"
                        : "border-pyqp-border text-pyqp-text-light hover:bg-pyqp-accent hover:text-white hover:border-pyqp-accent"
                    }`}
                  >
                    {chip.display}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="ml-2 px-3 py-1.5 text-sm rounded-full text-pyqp-muted hover:text-pyqp-text hover:bg-pyqp-bg transition-colors cursor-pointer whitespace-nowrap"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
