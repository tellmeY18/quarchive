import { useState } from "react"
import { Link } from "react-router"

function PlaceholderThumbnail() {
  return (
    <div className="bg-gray-200 aspect-[4/3] flex items-center justify-center">
      <svg
        className="h-12 w-12 text-gray-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
    </div>
  )
}

export default function PaperCard({ title, institution, year, examType, identifier, thumbnail }) {
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Link
      to={`/paper/${identifier}`}
      className="bg-pyqp-card rounded-xl border border-pyqp-border overflow-hidden hover:shadow-lg transition-shadow duration-200 block"
    >
      {thumbnail && !imgFailed ? (
        <div className="aspect-[4/3] overflow-hidden bg-gray-200">
          <img
            src={thumbnail}
            alt={title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <PlaceholderThumbnail />
      )}
      <div className="p-4">
        <h3 className="font-heading font-semibold text-pyqp-text line-clamp-2 leading-snug">
          {title}
        </h3>
        <p className="text-sm text-pyqp-text-light mt-1">{institution}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-pyqp-accent/10 text-pyqp-accent font-medium">
            {year}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-pyqp-border text-pyqp-muted font-medium capitalize">
            {examType}
          </span>
        </div>
      </div>
    </Link>
  )
}
