import { useState, useEffect, useRef } from 'react'
import useWizardStore from '../../../store/wizardStore'
import { layer1HashCheck, layer2IdentifierCheck } from '../../../lib/dedup'
import { buildItemUrl, buildThumbnailUrl } from '../../../lib/archiveOrg'

function Spinner() {
  return (
    <svg
      className="animate-spin h-5 w-5 text-pyqp-accent"
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
  )
}

function CheckIcon() {
  return (
    <svg
      className="h-5 w-5 text-green-600"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function PendingIcon() {
  return (
    <div className="h-5 w-5 rounded-full border-2 border-pyqp-border" />
  )
}

function ChecklistItem({ label, status }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {status === 'done' && <CheckIcon />}
      {status === 'running' && <Spinner />}
      {status === 'pending' && <PendingIcon />}
      <span
        className={
          status === 'done'
            ? 'text-pyqp-text'
            : status === 'running'
              ? 'text-pyqp-text font-medium'
              : 'text-pyqp-muted'
        }
      >
        {label}
      </span>
    </div>
  )
}

function DuplicateCard({ item }) {
  const identifier = item.identifier || ''
  const title = item.title || item.description || identifier
  const institution = item.creator || ''
  const year = item.date || ''
  const examType = item['exam-type'] || item.examType || ''
  const thumbnailUrl = identifier ? buildThumbnailUrl(identifier) : null
  const viewUrl = identifier ? buildItemUrl(identifier) : null
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <div className="flex gap-4 items-start mt-4">
      {thumbnailUrl && !imgFailed ? (
        <img
          src={thumbnailUrl}
          alt={title}
          className="w-24 h-auto rounded-lg border border-pyqp-border object-cover shrink-0"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="w-24 h-20 rounded-lg border border-pyqp-border bg-gray-100 flex items-center justify-center shrink-0">
          <svg
            className="h-8 w-8 text-gray-400"
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
      )}
      <div className="min-w-0">
        <p className="font-heading font-semibold text-pyqp-text leading-snug line-clamp-2">
          {title}
        </p>
        <p className="text-sm text-pyqp-text-light mt-1">
          {[institution, year, examType].filter(Boolean).join(' \u00b7 ')}
        </p>
        {viewUrl && (
          <a
            href={viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-pyqp-accent hover:text-pyqp-accent-hover transition-colors"
          >
            View on Archive.org
            <svg
              className="h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5zm7.25-.75a.75.75 0 01.75-.75h3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V6.31l-5.47 5.47a.75.75 0 11-1.06-1.06l5.47-5.47H12.25a.75.75 0 01-.75-.75z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        )}
      </div>
    </div>
  )
}

export default function StepDedupCheck() {
  const {
    fileHash,
    identifier,
    setStep,
    setDedupStatus,
    setDuplicateItem,
  } = useWizardStore()

  // Track individual layer statuses: 'pending' | 'running' | 'done'
  const [layer1Status, setLayer1Status] = useState('pending')
  const [layer2Status, setLayer2Status] = useState('pending')
  // Overall check result: 'running' | 'clear' | 'duplicate'
  const [checkState, setCheckState] = useState('running')
  const [duplicateData, setDuplicateData] = useState(null)

  // Prevent double-run in React strict mode
  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    setDedupStatus('checking')

    async function runChecks() {
      // Layer 1: Hash check
      setLayer1Status('running')
      const l1 = await layer1HashCheck(fileHash)
      setLayer1Status('done')

      if (l1.isDuplicate) {
        setDuplicateData(l1.item)
        setDuplicateItem(l1.item)
        setDedupStatus('duplicate')
        setLayer2Status('done')
        setCheckState('duplicate')
        return
      }

      // Layer 2: Identifier check
      setLayer2Status('running')
      const l2 = await layer2IdentifierCheck(identifier)
      setLayer2Status('done')

      if (l2.isDuplicate) {
        setDuplicateData(l2.item)
        setDuplicateItem(l2.item)
        setDedupStatus('duplicate')
        setCheckState('duplicate')
        return
      }

      // All clear
      setDedupStatus('clear')
      setCheckState('clear')
    }

    runChecks()
  }, [fileHash, identifier, setDedupStatus, setDuplicateItem])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-pyqp-text">
          Checking for duplicates
        </h2>
        <p className="text-sm text-pyqp-muted mt-1">
          Making sure this paper hasn&apos;t already been archived.
        </p>
      </div>

      {/* Checklist */}
      <div className="bg-pyqp-card rounded-xl border border-pyqp-border p-5">
        <ChecklistItem
          label="Computing file fingerprint..."
          status="done"
        />
        <ChecklistItem
          label="Searching for matching files..."
          status={layer1Status}
        />
        <ChecklistItem
          label="Checking for matching entry..."
          status={layer2Status}
        />
      </div>

      {/* Result: Clear */}
      {checkState === 'clear' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-green-600 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
            <p className="font-medium text-green-800">
              This paper is new. Ready to upload.
            </p>
          </div>
        </div>
      )}

      {/* Result: Duplicate */}
      {checkState === 'duplicate' && duplicateData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="h-5 w-5 text-amber-600 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <p className="font-medium text-amber-800">
              This paper is already archived.
            </p>
          </div>
          <DuplicateCard item={duplicateData} />
        </div>
      )}

      {/* Actions */}
      {checkState !== 'running' && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-pyqp-text-light hover:text-pyqp-text transition-colors cursor-pointer"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Edit Details
          </button>

          {checkState === 'clear' && (
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-pyqp-accent hover:bg-pyqp-accent-hover rounded-lg transition-colors cursor-pointer"
            >
              Upload Paper
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}

          {checkState === 'duplicate' && (
            <p className="text-sm text-pyqp-muted">
              Thanks for trying to contribute!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
