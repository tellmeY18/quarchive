import { useState, useEffect } from "react";
import { Link } from "react-router";
import { getInstitutionList } from "../lib/wikidata";

const INITIAL_SHOW_COUNT = 12;

const examTypes = [
  { label: "Main", value: "main" },
  { label: "Supplementary", value: "supplementary" },
  { label: "Model", value: "model" },
  { label: "Improvement", value: "improvement" },
  { label: "End Semester", value: "end-semester" },
  { label: "Midsemester", value: "midsemester" },
  { label: "Make Up", value: "make-up" },
  { label: "Re-Exam", value: "re-exam" },
  { label: "Save A Year", value: "save-a-year" },
];

function generateYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= 2015; y--) {
    years.push(String(y));
  }
  return years;
}

function SkeletonCard() {
  return (
    <div className="bg-pyqp-card border border-pyqp-border rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-pyqp-border rounded w-3/4 mx-auto" />
      <div className="h-3 bg-pyqp-border rounded w-1/2 mx-auto mt-2" />
    </div>
  );
}

export default function Browse() {
  const [universities, setUniversities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const years = generateYears();

  useEffect(() => {
    let cancelled = false;

    async function loadUniversities() {
      try {
        setLoading(true);
        setError(null);
        const list = await getInstitutionList();
        if (!cancelled) {
          setUniversities(list);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load universities");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadUniversities();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleUniversities = showAll
    ? universities
    : universities.slice(0, INITIAL_SHOW_COUNT);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      <h1 className="font-heading text-2xl md:text-3xl font-bold">
        Browse Papers
      </h1>
      <p className="text-pyqp-text-light mt-2">
        Find question papers by university, year, or exam type.
      </p>

      {/* By University */}
      <section className="mt-8 md:mt-10">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-4">
          By University
        </h2>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {Array.from({ length: INITIAL_SHOW_COUNT }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p>{error}</p>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                getInstitutionList()
                  .then(setUniversities)
                  .catch((err) =>
                    setError(err.message || "Failed to load universities"),
                  )
                  .finally(() => setLoading(false));
              }}
              className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {visibleUniversities.map((uni) => (
                <Link
                  key={uni.qid}
                  to={`/?university=${encodeURIComponent(uni.qid)}&universityName=${encodeURIComponent(uni.label)}`}
                  className="bg-pyqp-card border border-pyqp-border rounded-lg p-4 text-center hover:border-pyqp-accent hover:shadow-sm transition-all cursor-pointer min-h-[48px] flex flex-col items-center justify-center"
                >
                  <span className="font-medium text-pyqp-text">
                    {uni.label}
                  </span>
                  {uni.altLabel && (
                    <span className="block text-sm text-pyqp-text-light mt-1">
                      {uni.altLabel}
                    </span>
                  )}
                </Link>
              ))}
            </div>
            {universities.length > INITIAL_SHOW_COUNT && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => setShowAll((prev) => !prev)}
                  className="text-pyqp-accent hover:underline font-medium text-sm min-h-[48px]"
                >
                  {showAll
                    ? "Show fewer"
                    : `Show all ${universities.length} universities`}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* By Year */}
      <section className="mt-8 md:mt-10">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-4">
          By Year
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {years.map((year) => (
            <Link
              key={year}
              to={`/?year=${year}`}
              className="bg-pyqp-card border border-pyqp-border rounded-lg p-4 text-center hover:border-pyqp-accent hover:shadow-sm transition-all cursor-pointer font-medium text-pyqp-text min-h-[48px] flex items-center justify-center"
            >
              {year}
            </Link>
          ))}
        </div>
      </section>

      {/* By Exam Type */}
      <section className="mt-8 md:mt-10">
        <h2 className="font-heading text-lg md:text-xl font-semibold mb-4">
          By Exam Type
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {examTypes.map((type) => (
            <Link
              key={type.value}
              to={`/?examType=${type.value}`}
              className="bg-pyqp-card border border-pyqp-border rounded-lg p-4 text-center hover:border-pyqp-accent hover:shadow-sm transition-all cursor-pointer font-medium text-pyqp-text min-h-[48px] flex items-center justify-center"
            >
              {type.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
