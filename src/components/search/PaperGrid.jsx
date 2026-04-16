import PaperCard from "./PaperCard"

function SkeletonCard() {
  return (
    <div className="bg-pyqp-card rounded-xl border border-pyqp-border overflow-hidden">
      <div className="bg-gray-200 aspect-[4/3] animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        <div className="flex gap-2 mt-3">
          <div className="h-5 w-12 bg-gray-200 rounded-full animate-pulse" />
          <div className="h-5 w-20 bg-gray-200 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <svg
        className="h-16 w-16 text-gray-300 mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <p className="text-pyqp-muted text-lg">{message}</p>
    </div>
  )
}

export default function PaperGrid({
  papers = [],
  loading = false,
  emptyMessage = "No papers found",
  onLoadMore,
  hasMore = false,
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (papers.length === 0) {
    return <EmptyState message={emptyMessage} />
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {papers.map((paper) => (
          <PaperCard key={paper.identifier} {...paper} />
        ))}
      </div>
      {onLoadMore && hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={onLoadMore}
            className="px-6 py-2.5 rounded-lg border border-pyqp-border bg-pyqp-card text-pyqp-text font-medium hover:bg-pyqp-accent/5 hover:border-pyqp-accent/30 transition-colors duration-200"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}
