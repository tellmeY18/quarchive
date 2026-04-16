import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  getInstitutionList,
  searchInstitutionsLocal,
  searchInstitutionsRemote,
} from "../../lib/wikidata";
import useGeolocation from "../../hooks/useGeolocation";
import { INDIAN_STATES } from "../../lib/indianStates";

export default function InstitutionSearch({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [institutionList, setInstitutionList] = useState([]);
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);

  const [highlightIndex, setHighlightIndex] = useState(-1);

  const [targetStateQid, setTargetStateQid] = useState("");
  const [didUserPickState, setDidUserPickState] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const remoteFallbackTimer = useRef(null);

  const {
    state: detectedState,
    status: geoStatus,
    isSupported: isGeoSupported,
    detect,
    retry,
  } = useGeolocation();

  const isSelected = value && value.qid;

  const effectiveStateQid = didUserPickState
    ? targetStateQid
    : detectedState?.qid || "";

  const effectiveStateObj = useMemo(
    () => INDIAN_STATES.find((s) => s.qid === effectiveStateQid) || null,
    [effectiveStateQid],
  );

  // Background preload only; never blocks the input
  useEffect(() => {
    let cancelled = false;

    async function preload() {
      setIsLoadingList(true);
      try {
        const list = effectiveStateQid
          ? await getInstitutionList(effectiveStateQid)
          : await getInstitutionList();

        if (!cancelled) {
          setInstitutionList(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) {
          setInstitutionList([]);
        }
      } finally {
        if (!cancelled) setIsLoadingList(false);
      }
    }

    preload();

    return () => {
      cancelled = true;
    };
  }, [effectiveStateQid]);

  // Keep filtered results fresh when preload completes while user is typing
  useEffect(() => {
    if (!query.trim()) return;
    const localResults = searchInstitutionsLocal(query, institutionList);
    setResults(localResults.slice(0, 10));
  }, [institutionList, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (remoteFallbackTimer.current)
        clearTimeout(remoteFallbackTimer.current);
    };
  }, []);

  const handleInputChange = useCallback(
    (e) => {
      const val = e.target.value;
      setQuery(val);
      setHighlightIndex(-1);

      if (remoteFallbackTimer.current) {
        clearTimeout(remoteFallbackTimer.current);
        remoteFallbackTimer.current = null;
      }

      if (!val.trim()) {
        setResults([]);
        setIsOpen(false);
        setIsLoadingRemote(false);
        return;
      }

      // 1) Immediate local search against whatever we have
      const localResults = searchInstitutionsLocal(val, institutionList);
      setResults(localResults.slice(0, 10));
      setIsOpen(true);

      // 2) Always do remote search (debounced) so typing works even before preload finishes
      remoteFallbackTimer.current = setTimeout(async () => {
        setIsLoadingRemote(true);
        try {
          const remoteResults = await searchInstitutionsRemote(
            val,
            effectiveStateQid || null,
          );
          setResults(remoteResults.slice(0, 10));
          setIsOpen(true);
        } catch {
          // keep local results
        } finally {
          setIsLoadingRemote(false);
        }
      }, 500);
    },
    [institutionList, effectiveStateQid],
  );

  const handleSelect = useCallback(
    (item) => {
      onChange({ label: item.label, qid: item.qid });
      setQuery("");
      setResults([]);
      setIsOpen(false);
      setHighlightIndex(-1);
    },
    [onChange],
  );

  const handleClearSelection = useCallback(() => {
    onChange({ label: "", qid: "" });
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHighlightIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onChange]);

  const handleStateChange = useCallback((e) => {
    const qid = e.target.value;
    setDidUserPickState(true);
    setTargetStateQid(qid);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  const useDetectedState = useCallback(() => {
    setDidUserPickState(false);
    setTargetStateQid("");
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setHighlightIndex(-1);
  }, []);

  const handleUseMyLocation = useCallback(async () => {
    await detect();
  }, [detect]);

  const handleRetryLocation = useCallback(async () => {
    await retry();
  }, [retry]);

  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen || results.length === 0) {
        if (e.key === "Escape") setIsOpen(false);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightIndex((prev) => {
            const next = prev < results.length - 1 ? prev + 1 : 0;
            scrollToItem(next);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightIndex((prev) => {
            const next = prev > 0 ? prev - 1 : results.length - 1;
            scrollToItem(next);
            return next;
          });
          break;
        case "Enter":
          e.preventDefault();
          if (highlightIndex >= 0 && highlightIndex < results.length) {
            handleSelect(results[highlightIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setHighlightIndex(-1);
          break;
      }
    },
    [isOpen, results, highlightIndex, handleSelect],
  );

  function scrollToItem(index) {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-institution-item]");
    if (items[index]) {
      items[index].scrollIntoView({ block: "nearest" });
    }
  }

  const geoLabel = (() => {
    if (!isGeoSupported) return "Location not supported in this browser";
    if (geoStatus === "idle")
      return "Use location to focus results by your state";
    if (geoStatus === "detecting") return "Detecting your location...";
    if (geoStatus === "denied") return "Location permission denied";
    if (geoStatus === "error") return "Could not detect location";
    if (detectedState?.name) return `Detected region: ${detectedState.name}`;
    return "Region not detected";
  })();

  const inputPlaceholder = effectiveStateObj
    ? `Start typing institution name in ${effectiveStateObj.name}...`
    : "Start typing university / college name...";

  return (
    <div ref={containerRef} className="relative space-y-3">
      {/* Region controls - always visible, even after selection */}
      <div className="rounded-lg border border-pyqp-border bg-pyqp-bg p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-pyqp-muted">{geoLabel}</span>

          {geoStatus === "detected" && detectedState?.name && (
            <span className="inline-flex items-center rounded-full border border-emerald-300/60 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
              Location detected: {detectedState.name}
            </span>
          )}

          {effectiveStateObj && (
            <span className="inline-flex items-center rounded-full border border-pyqp-accent/30 bg-pyqp-accent/10 px-2 py-0.5 text-[11px] text-pyqp-text">
              Targeting: {effectiveStateObj.name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isGeoSupported && (
            <button
              type="button"
              onClick={
                geoStatus === "detected"
                  ? handleRetryLocation
                  : handleUseMyLocation
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-pyqp-accent/40 bg-pyqp-accent px-3 py-2 text-sm font-medium text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 transition-colors"
            >
              <span aria-hidden="true">📍</span>
              {geoStatus === "detecting"
                ? "Detecting location..."
                : geoStatus === "detected"
                  ? "Update location"
                  : "Use my location"}
            </button>
          )}

          {(geoStatus === "denied" || geoStatus === "error") && (
            <button
              type="button"
              onClick={handleRetryLocation}
              className="inline-flex items-center rounded-lg border border-pyqp-border bg-pyqp-card px-3 py-2 text-sm text-pyqp-text hover:bg-pyqp-bg transition-colors"
            >
              Retry location
            </button>
          )}
        </div>

        <p className="text-[11px] text-pyqp-muted">
          We only use your location to infer your state and focus institution
          search results.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-center">
          <div className="relative">
            <select
              value={effectiveStateQid}
              onChange={handleStateChange}
              className="w-full rounded-lg border border-pyqp-border bg-pyqp-card px-3 py-2 pr-8 text-sm text-pyqp-text focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent transition-colors appearance-none cursor-pointer"
              aria-label="Target state for institution search"
            >
              <option value="">All India</option>
              {INDIAN_STATES.map((state) => (
                <option key={state.qid} value={state.qid}>
                  {state.name}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </div>

          {didUserPickState && detectedState?.qid && (
            <button
              type="button"
              onClick={useDetectedState}
              className="text-xs rounded-md border border-pyqp-border px-2.5 py-1.5 text-pyqp-text hover:bg-pyqp-card transition-colors"
            >
              Use detected: {detectedState.name}
            </button>
          )}
        </div>
      </div>

      {isSelected && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-pyqp-accent/10 border border-pyqp-accent/20 px-3 py-1.5 text-sm text-pyqp-text">
            <span className="font-medium">{value.label}</span>
            <span className="text-xs text-pyqp-muted">({value.qid})</span>
            <button
              type="button"
              onClick={handleClearSelection}
              aria-label="Clear institution selection"
              className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full text-pyqp-muted hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        </div>
      )}

      {/* Search input - never disabled */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted"
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
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.trim() && results.length > 0) setIsOpen(true);
          }}
          placeholder={inputPlaceholder}
          className="w-full rounded-lg border border-pyqp-border bg-pyqp-card pl-9 pr-9 py-2 text-sm text-pyqp-text placeholder:text-pyqp-muted focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent transition-colors"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="institution-listbox"
          aria-activedescendant={
            highlightIndex >= 0
              ? `institution-option-${highlightIndex}`
              : undefined
          }
        />

        {(isLoadingRemote || isLoadingList) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="animate-spin h-4 w-4 text-pyqp-accent"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
      </div>

      {(isLoadingList || isLoadingRemote) && (
        <p className="text-xs text-pyqp-muted">
          {isLoadingRemote
            ? "Searching live results..."
            : effectiveStateObj
              ? `Loading cached institutions for ${effectiveStateObj.name}...`
              : "Loading cached institutions..."}
        </p>
      )}

      {isOpen && (
        <ul
          id="institution-listbox"
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-pyqp-border bg-pyqp-card shadow-lg"
        >
          {results.length === 0 && !isLoadingRemote && (
            <li className="px-3 py-3 text-sm text-pyqp-muted text-center">
              No institutions found. Try a different search term.
            </li>
          )}

          {results.length === 0 && isLoadingRemote && (
            <li className="px-3 py-3 text-sm text-pyqp-muted text-center flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-4 w-4 text-pyqp-accent"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Searching Wikidata...
            </li>
          )}

          {results.map((item, index) => (
            <li
              key={item.qid}
              id={`institution-option-${index}`}
              data-institution-item
              role="option"
              aria-selected={highlightIndex === index}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setHighlightIndex(index)}
              className={`px-3 py-2.5 cursor-pointer transition-colors ${
                highlightIndex === index
                  ? "bg-pyqp-accent/10 text-pyqp-text"
                  : "hover:bg-pyqp-bg text-pyqp-text"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {item.label}
                  </div>

                  {item.altLabel && (
                    <div className="text-xs text-pyqp-muted truncate mt-0.5">
                      {item.altLabel}
                    </div>
                  )}

                  {item.location && (
                    <div className="text-[11px] text-pyqp-muted mt-1">
                      {item.location}
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
  );
}
