import { useState, useEffect } from 'react'

const STATS_URL =
  'https://archive.org/advancedsearch.php?q=subject:quarchive&output=json&rows=0'

export default function StatsStrip() {
  const [paperCount, setPaperCount] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      try {
        const res = await fetch(STATS_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          setPaperCount(json?.response?.numFound ?? 0)
        }
      } catch {
        // On error, fall back to 0 so the strip still renders
        if (!cancelled) setPaperCount(0)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchStats()
    return () => { cancelled = true }
  }, [])

  const stats = [
    { label: 'Papers Archived', value: paperCount },
    // TODO: Archive.org doesn't support facet counts easily —
    // these will need a separate aggregation strategy (e.g. periodic build-time scrape)
    { label: 'Universities', value: 0 },
    { label: 'Languages', value: 0 },
    { label: 'States', value: 0 },
  ]

  return (
    <section className="bg-pyqp-accent text-white py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((stat) => (
            <div key={stat.label}>
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-9 w-16 bg-white/20 rounded animate-pulse" />
                  <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="text-3xl font-heading font-bold">
                    {stat.value?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-white/70 uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
