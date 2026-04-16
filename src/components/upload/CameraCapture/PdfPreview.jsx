import useCameraStore from '../../../store/cameraStore'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function PdfPreview({ onConfirm, onRetake }) {
  const { capturedPages, pdfBlob, pdfSize, converting, convertProgress } =
    useCameraStore()

  if (converting) {
    const pct = Math.round(convertProgress * 100)
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <svg
          className="animate-spin h-10 w-10 text-pyqp-accent mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-pyqp-text font-medium mb-2">Creating PDF...</p>
        <div className="w-48 h-2 bg-pyqp-border rounded-full overflow-hidden">
          <div
            className="h-full bg-pyqp-accent rounded-full transition-all duration-300"
            style={{ width: pct + '%' }}
          />
        </div>
        <p className="text-sm text-pyqp-muted mt-2">{pct}%</p>
      </div>
    )
  }

  if (!pdfBlob) {
    return (
      <div className="text-center py-12">
        <p className="text-pyqp-muted">No PDF generated yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 py-6">
      {/* Success card */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
        <svg className="h-12 w-12 text-green-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <h3 className="font-heading text-lg font-semibold text-green-800 mb-1">
          PDF Ready
        </h3>
        <p className="text-sm text-green-700">
          {capturedPages.length} page{capturedPages.length !== 1 ? 's' : ''} &middot; {formatSize(pdfSize)}
        </p>
      </div>

      {/* Page thumbnails */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
        {capturedPages.map((page, i) => (
          <img
            key={page.id}
            src={page.dataUrl}
            alt={`Page ${i + 1}`}
            className="h-24 w-auto rounded-lg border border-pyqp-border flex-shrink-0 object-cover"
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 border border-pyqp-border text-pyqp-text rounded-lg font-medium min-h-[48px]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Retake
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 bg-pyqp-accent text-white rounded-lg font-semibold min-h-[48px]"
        >
          Looks Good
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  )
}
