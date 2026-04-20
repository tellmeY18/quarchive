import { useState, useCallback } from "react";
import useCameraStore from "../../../store/cameraStore";

export default function PageReview({ onConfirm, onRetake }) {
  const { capturedPages, removePage, reorderPages } = useCameraStore();
  const [currentIndex, setCurrentIndex] = useState(0);

  const total = capturedPages.length;
  const current = capturedPages[currentIndex];

  const handleDelete = useCallback(() => {
    if (!current) return;
    removePage(current.id);
    if (currentIndex >= total - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [current, currentIndex, total, removePage]);

  const handleMoveUp = useCallback(() => {
    if (currentIndex <= 0) return;
    const pages = [...capturedPages];
    const temp = pages[currentIndex - 1];
    pages[currentIndex - 1] = pages[currentIndex];
    pages[currentIndex] = temp;
    reorderPages(pages);
    setCurrentIndex(currentIndex - 1);
  }, [currentIndex, capturedPages, reorderPages]);

  const handleMoveDown = useCallback(() => {
    if (currentIndex >= total - 1) return;
    const pages = [...capturedPages];
    const temp = pages[currentIndex + 1];
    pages[currentIndex + 1] = pages[currentIndex];
    pages[currentIndex] = temp;
    reorderPages(pages);
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, total, capturedPages, reorderPages]);

  const handlePrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setCurrentIndex((i) => Math.min(total - 1, i + 1));

  if (total === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-pyqp-muted mb-4">No pages captured</p>
        <button
          type="button"
          onClick={onRetake}
          className="px-5 py-3 bg-pyqp-accent text-white rounded-lg font-medium min-h-[48px]"
        >
          Open Camera
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-pyqp-border"
        style={{
          paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
        }}
      >
        <button
          type="button"
          onClick={onRetake}
          className="text-sm text-pyqp-accent font-medium min-h-[48px] flex items-center"
        >
          <svg
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Retake
        </button>
        <span className="text-sm font-medium text-pyqp-text">
          Page {currentIndex + 1} of {total}
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleMoveUp}
            disabled={currentIndex <= 0}
            className="min-h-[48px] min-w-[44px] flex items-center justify-center text-pyqp-muted disabled:opacity-30"
            aria-label="Move page up"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleMoveDown}
            disabled={currentIndex >= total - 1}
            className="min-h-[48px] min-w-[44px] flex items-center justify-center text-pyqp-muted disabled:opacity-30"
            aria-label="Move page down"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Image preview */}
      <div className="flex-1 relative bg-gray-100 overflow-hidden">
        {current && (
          <img
            src={current.dataUrl}
            alt={`Page ${currentIndex + 1}`}
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
            aria-label="Previous page"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </button>
        )}
        {currentIndex < total - 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center"
            aria-label="Next page"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 4.5l7.5 7.5-7.5 7.5"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Dots */}
      {total > 1 && (
        <div className="flex justify-center gap-1.5 py-2">
          {capturedPages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentIndex ? "bg-pyqp-accent" : "bg-pyqp-border"
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Bottom actions */}
      <div
        className="flex items-center justify-between px-4 py-3 border-t border-pyqp-border"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <button
          type="button"
          onClick={handleDelete}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 font-medium min-h-[48px]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
          Delete
        </button>

        <button
          type="button"
          onClick={onConfirm}
          className="inline-flex items-center gap-2 px-5 py-3 bg-pyqp-accent text-white rounded-lg font-semibold text-sm min-h-[48px]"
        >
          Use These Pages
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
