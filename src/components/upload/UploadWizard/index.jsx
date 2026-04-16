import { useEffect } from 'react'
import useWizardStore from '../../../store/wizardStore'
import StepMetadata from './StepMetadata'
import StepDedupCheck from './StepDedupCheck'
import StepUpload from './StepUpload'

const STEPS = [
  { number: 1, label: 'Metadata' },
  { number: 2, label: 'Check' },
  { number: 3, label: 'Upload' },
]

function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((s, i) => {
        const isCompleted = currentStep > s.number
        const isCurrent = currentStep === s.number
        const isFuture = currentStep < s.number

        return (
          <div key={s.number} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  isCompleted
                    ? 'bg-pyqp-accent text-white'
                    : isCurrent
                      ? 'bg-pyqp-accent text-white ring-4 ring-pyqp-accent/20'
                      : 'bg-pyqp-border text-pyqp-muted',
                ].join(' ')}
              >
                {isCompleted ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  s.number
                )}
              </div>
              <span
                className={[
                  'mt-2 text-xs font-medium',
                  isFuture ? 'text-pyqp-muted' : 'text-pyqp-text',
                ].join(' ')}
              >
                {s.label}
              </span>
            </div>

            {/* Connector line (not after last step) */}
            {i < STEPS.length - 1 && (
              <div
                className={[
                  'w-16 sm:w-24 h-0.5 mx-2 mb-6 transition-colors',
                  currentStep > s.number ? 'bg-pyqp-accent' : 'bg-pyqp-border',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function UploadWizard() {
  const step = useWizardStore((s) => s.step)
  const uploadStatus = useWizardStore((s) => s.uploadStatus)
  const resetWizard = useWizardStore((s) => s.resetWizard)

  // Warn user before leaving the page if they have progress to lose
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (step > 1 && uploadStatus !== 'success') {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      resetWizard()
    }
  }, [step, uploadStatus, resetWizard])

  return (
    <div className="w-full max-w-2xl mx-auto">
      <StepIndicator currentStep={step} />

      <div className="min-h-80">
        {step === 1 && <StepMetadata />}
        {step === 2 && <StepDedupCheck />}
        {step === 3 && <StepUpload />}
      </div>
    </div>
  )
}
