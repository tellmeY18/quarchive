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
    { label: 'Universities', value: '\u2014' },
    { label: 'Languages', value: '\u2014' },
    { label: 'States', value: '\u2014' },
  ]

  return (
    <section className="bg-pyqp-accent text-white py-4 md:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex md:grid md:grid-cols-4 gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:overflow-visible">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex-shrink-0 snap-center min-w-[140px] md:min-w-0 text-center"
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-14 bg-white/20 rounded animate-pulse" />
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                </div>
              ) : (
                <>
                  <div className="text-2xl md:text-3xl font-heading font-bold">
                    {typeof stat.value === 'number'
                      ? stat.value.toLocaleString()
                      : stat.value}
                  </div>
                  <div className="text-xs md:text-sm text-white/70 uppercase tracking-wider mt-1">
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
