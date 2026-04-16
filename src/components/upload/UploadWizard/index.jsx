import { useEffect } from 'react'
import useWizardStore from '../../../store/wizardStore'
import StepSource from './StepSource'
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
    <div className="flex items-center justify-center mb-8 md:mb-10">
      {STEPS.map((s, i) => {
        const isCompleted = currentStep > s.number
        const isCurrent = currentStep === s.number
        const isFuture = currentStep < s.number

        return (
          <div key={s.number} className="flex items-center">
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
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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

            {i < STEPS.length - 1 && (
              <div
                className={[
                  'w-12 sm:w-16 md:w-24 h-0.5 mx-2 mb-6 transition-colors',
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

export default function UploadWizard({ onOpenCamera }) {
  const step = useWizardStore((s) => s.step)
  const file = useWizardStore((s) => s.file)
  const source = useWizardStore((s) => s.source)
  const uploadStatus = useWizardStore((s) => s.uploadStatus)
  const setStep = useWizardStore((s) => s.setStep)
  const setSource = useWizardStore((s) => s.setSource)
  const resetWizard = useWizardStore((s) => s.resetWizard)

  // If file is already set (from camera), ensure we're at metadata step
  useEffect(() => {
    if (file && source === 'camera' && step < 1) {
      setStep(1)
    }
  }, [file, source, step, setStep])

  // Warn before leaving with progress
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

  // Show source selection if no file and no source chosen
  if (!file && !source) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <StepSource
          onSelectCamera={() => {
            if (onOpenCamera) {
              onOpenCamera()
            }
          }}
          onSelectPdf={() => {
            setSource('pdf_upload')
            setStep(1)
          }}
        />
      </div>
    )
  }

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
