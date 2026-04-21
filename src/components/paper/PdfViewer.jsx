import { useState, useEffect, useRef, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";

// Set up the PDF.js worker from CDN matching our installed version
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://unpkg.com/pdfjs-dist@" +
  pdfjsLib.version +
  "/build/pdf.worker.min.mjs";

/**
 * Route Archive.org download URLs through our server-side CORS proxy
 * (/api/pdf?url=...) so that pdfjs-dist can fetch the file without
 * being blocked by missing Access-Control-Allow-Origin headers on the
 * ia*.us.archive.org storage servers that Archive.org redirects to.
 */
function getProxiedUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "archive.org" ||
      parsed.hostname.endsWith(".archive.org")
    ) {
      return `/api/pdf?url=${encodeURIComponent(url)}`;
    }
  } catch {
    // Not a valid absolute URL — return as-is and let pdf.js handle it.
  }
  return url;
}

export default function PdfViewer({ url }) {
  const proxiedUrl = getProxiedUrl(url);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Handle missing URL outside the effect
  const hasUrl = Boolean(url);

  // Load the PDF document
  useEffect(() => {
    if (!hasUrl) return;

    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument(proxiedUrl);

    loadingTask.promise
      .then((pdfDoc) => {
        if (cancelled) {
          pdfDoc.destroy();
          return;
        }
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setCurrentPage(1);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("PDF load error:", err);
        setError("Could not load PDF preview");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [url, hasUrl]);

  // Render the current page to canvas
  const renderPage = useCallback(async (pageNum) => {
    const pdfDoc = pdfDocRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!pdfDoc || !canvas || !container) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page = await pdfDoc.getPage(pageNum);

      // Scale to fit container width
      const containerWidth = container.clientWidth;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });

      // Set canvas dimensions (use devicePixelRatio for sharp rendering)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = Math.floor(viewport.width) + "px";
      canvas.style.height = Math.floor(viewport.height) + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);

      const renderTask = page.render({
        canvasContext: ctx,
        viewport,
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
    } catch (err) {
      if (err?.name !== "RenderingCancelledException") {
        console.error("Page render error:", err);
      }
    }
  }, []);

  // Re-render when page changes or when PDF finishes loading
  useEffect(() => {
    if (!loading && !error && numPages > 0) {
      renderPage(currentPage);
    }
  }, [currentPage, loading, error, numPages, renderPage]);

  // Re-render on window resize to stay fitted to container
  useEffect(() => {
    if (loading || error || numPages === 0) return;

    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => renderPage(currentPage), 150);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
    };
  }, [currentPage, loading, error, numPages, renderPage]);

  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage((p) => Math.min(numPages, p + 1));

  // --- No URL provided ---
  if (!url) {
    return (
      <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-12 flex flex-col items-center justify-center min-h-75">
        <p className="text-pyqp-muted">No PDF URL provided</p>
      </div>
    );
  }

  // --- Loading state ---
  if (loading) {
    return (
      <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-12 flex flex-col items-center justify-center min-h-100">
        <svg
          className="animate-spin h-8 w-8 text-pyqp-accent mb-4"
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <p className="text-pyqp-muted text-sm">Loading PDF preview…</p>
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div className="bg-pyqp-card border border-pyqp-border rounded-xl p-12 flex flex-col items-center justify-center min-h-75">
        <svg
          className="h-10 w-10 text-red-400 mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p className="text-pyqp-text font-medium mb-2">{error}</p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-pyqp-accent hover:text-pyqp-accent-hover underline"
          >
            Download directly →
          </a>
        )}
      </div>
    );
  }

  // --- Loaded: canvas + navigation ---
  return (
    <div className="bg-pyqp-card border border-pyqp-border rounded-xl overflow-hidden">
      {/* Page navigation bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pyqp-border bg-pyqp-bg/50">
        <button
          onClick={goToPrev}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-pyqp-card border border-pyqp-border text-pyqp-text hover:bg-pyqp-border/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
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
              d="M15.75 19.5L8.25 12l7.5-7.5"
            />
          </svg>
          Prev
        </button>

        <span className="text-sm text-pyqp-text-light font-medium">
          Page {currentPage} of {numPages}
        </span>

        <button
          onClick={goToNext}
          disabled={currentPage >= numPages}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-pyqp-card border border-pyqp-border text-pyqp-text hover:bg-pyqp-border/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
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
              d="M8.25 4.5l7.5 7.5-7.5 7.5"
            />
          </svg>
        </button>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full flex justify-center bg-gray-100 p-4"
      >
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
