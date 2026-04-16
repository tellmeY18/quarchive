import { useState, useEffect, Suspense, lazy } from 'react'
import { useParams, Link } from 'react-router'
import {
  buildMetadataUrl,
  buildDownloadUrl,
  buildItemUrl,
} from '../lib/archiveOrg'

const PdfViewer = lazy(() => import('../components/paper/PdfViewer'))

function metaStr(value) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

function findPdfFile(files) {
  if (!Array.isArray(files)) return null
  return (
    files.find((f) => f.format === 'Text PDF') ||
    files.find((f) => f.name?.toLowerCase().endsWith('.pdf')) ||
    null
  )
}

const LANGUAGE_NAMES = {
  en: 'English',
  ml: 'Malayalam',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  kn: 'Kannada',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
  or: 'Odia',
  ur: 'Urdu',
}

function getLanguageLabel(code) {
  if (!code) return null
  const c = code.toLowerCase().trim()
  return LANGUAGE_NAMES[c] || code
}

function PaperSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12 animate-pulse">
      <div className="h-4 w-48 bg-pyqp-border rounded mb-6" />
      <div className="h-8 w-3/4 bg-pyqp-border rounded mb-3" />
      <div className="h-5 w-1/2 bg-pyqp-border rounded mb-6" />
      <div className="flex gap-3 mb-8">
        <div className="h-7 w-16 bg-pyqp-border rounded-full" />
        <div className="h-7 w-24 bg-pyqp-border rounded-full" />
        <div className="h-7 w-20 bg-pyqp-border rounded-full" />
        <div className="h-7 w-20 bg-pyqp-border rounded-full" />
      </div>
      <div className="flex gap-4 mb-10">
        <div className="h-10 w-36 bg-pyqp-border rounded-lg" />
        <div className="h-10 w-44 bg-pyqp-border rounded-lg" />
      </div>
      <div className="bg-pyqp-card border border-pyqp-border rounded-xl aspect-3/4" />
    </div>
  )
}

function PaperNotFound() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16 md:py-24 text-center">
      <svg
        className="h-16 w-16 text-pyqp-muted mx-auto mb-6"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
        />
      </svg>
      <h1 className="font-heading text-2xl font-bold text-pyqp-text mb-2">Paper not found</h1>
      <p className="text-pyqp-text-light mb-8">
        This paper may have been removed or the link may be incorrect.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-pyqp-accent text-white rounded-lg font-medium hover:bg-pyqp-accent-hover transition-colors min-h-[48px]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Home
      </Link>
    </div>
  )
}

function PdfViewerFallback() {
  return (
    <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-12 flex flex-col items-center justify-center min-h-100">
      <svg
        className="animate-spin h-8 w-8 text-pyqp-accent mb-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p className="text-pyqp-muted text-sm">Loading PDF viewer…</p>
    </div>
  )
}

export default function Paper() {
  const { identifier } = useParams()

  const [paper, setPaper] = useState(null)
  const [pdfFilename, setPdfFilename] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!identifier) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchMetadata() {
      try {
        const res = await fetch(buildMetadataUrl(identifier))
        if (!res.ok) {
          if (!cancelled) setNotFound(true)
          return
        }

        const data = await res.json()

        if (data.error || !data.metadata) {
          if (!cancelled) setNotFound(true)
          return
        }

        const meta = data.metadata
        const pdfFile = findPdfFile(data.files)

        if (!cancelled) {
          setPaper({
            title: metaStr(meta.title),
            description: metaStr(meta.description),
            institution: metaStr(meta.creator),
            year: metaStr(meta.date),
            language: metaStr(meta.language),
            examType: metaStr(meta['exam-type']),
            semester: metaStr(meta.semester),
            courseCode: metaStr(meta['course-code']),
            program: metaStr(meta.program),
            subjects: Array.isArray(meta.subject) ? meta.subject : [meta.subject].filter(Boolean),
          })
          setPdfFilename(pdfFile?.name || null)
        }
      } catch (err) {
        console.error('Failed to fetch paper metadata:', err)
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMetadata()
    return () => { cancelled = true }
  }, [identifier])

  const downloadUrl = pdfFilename ? buildDownloadUrl(identifier, pdfFilename) : null
  const archiveUrl = buildItemUrl(identifier)
  const displayTitle = paper?.description || paper?.title || identifier

  if (loading) return <PaperSkeleton />
  if (notFound) return <PaperNotFound />

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-pyqp-muted mb-6">
        <Link to="/" className="hover:text-pyqp-accent transition-colors">Home</Link>
        {paper.institution && (
          <>
            {' \u203A '}
            <span className="text-pyqp-text-light">{paper.institution}</span>
          </>
        )}
        {paper.courseCode && (
          <>
            {' \u203A '}
            <span className="text-pyqp-text-light">{paper.courseCode}</span>
          </>
        )}
      </nav>

      {/* Title */}
      <h1 className="font-heading text-xl sm:text-2xl md:text-3xl font-bold text-pyqp-text leading-snug">
        {displayTitle}
      </h1>

      {paper.institution && (
        <p className="text-pyqp-text-light mt-2">{paper.institution}</p>
      )}

      {/* Metadata chips */}
      <div className="mt-4 md:mt-5 flex flex-wrap gap-2">
        {paper.year && (
          <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1 rounded-full bg-pyqp-accent/10 text-pyqp-accent font-medium">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            {paper.year}
          </span>
        )}
        {paper.examType && (
          <span className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-pyqp-border text-pyqp-text-light font-medium capitalize">
            {paper.examType}
          </span>
        )}
        {paper.semester && (
          <span className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-pyqp-border text-pyqp-text-light font-medium">
            Semester {paper.semester}
          </span>
        )}
        {paper.language && (
          <span className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-pyqp-border text-pyqp-text-light font-medium">
            {getLanguageLabel(paper.language)}
          </span>
        )}
        {paper.program && (
          <span className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-pyqp-border text-pyqp-text-light font-medium">
            {paper.program}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-6 md:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-pyqp-accent text-white rounded-lg font-medium hover:bg-pyqp-accent-hover transition-colors min-h-[48px]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download PDF
          </a>
        )}
        <a
          href={archiveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-pyqp-card border border-pyqp-border text-pyqp-text rounded-lg font-medium hover:bg-pyqp-border/50 transition-colors min-h-[48px]"
        >
          View on Archive.org
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
        </a>
      </div>

      {/* PDF Viewer */}
      {downloadUrl && (
        <div className="mt-8 md:mt-10">
          <Suspense fallback={<PdfViewerFallback />}>
            <PdfViewer url={downloadUrl} />
          </Suspense>
        </div>
      )}

      {!downloadUrl && (
        <div className="mt-8 md:mt-10 bg-pyqp-card border border-pyqp-border rounded-xl p-8 md:p-12 text-center">
          <p className="text-pyqp-muted">
            No PDF preview available for this paper.
          </p>
          <a
            href={archiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-3 text-sm text-pyqp-accent hover:text-pyqp-accent-hover underline"
          >
            View all files on Archive.org →
          </a>
        </div>
      )}
    </div>
  )
}
