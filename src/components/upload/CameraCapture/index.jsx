import { useState, useCallback, useEffect } from "react";
import useCameraStore from "../../../store/cameraStore";
import useToastStore from "../../../store/toastStore";
import useImageToPdf from "../../../hooks/useImageToPdf";
import Viewfinder from "./Viewfinder";
import PageReview from "./PageReview";
import PdfPreview from "./PdfPreview";

export default function CameraCapture({ onComplete, onCancel }) {
  const [phase, setPhase] = useState("capture");
  const { capturedPages, pdfBlob, reset, cameraError } = useCameraStore();
  const { convert } = useImageToPdf();
  // Toast channel for the transitions this component owns — mainly the
  // PDF-assembly step, which can take multiple seconds on budget Android
  // for a 5-page scan. The inline "Creating PDF..." overlay in PdfPreview
  // still handles the primary visual; the toast exists as a secondary,
  // persistent cue so the user knows we haven't frozen even if the
  // spinner momentarily stalls on a slow pdf-lib encode.
  const pushToast = useToastStore((s) => s.pushToast);
  const clearToast = useToastStore((s) => s.clearToast);

  useEffect(() => {
    return () => {
      useCameraStore.getState().capturedPages.forEach((p) => {
        if (p.dataUrl) URL.revokeObjectURL(p.dataUrl);
      });
    };
  }, []);

  const handleViewfinderDone = useCallback(() => {
    if (capturedPages.length === 0) {
      onCancel?.();
      return;
    }
    setPhase("review");
  }, [capturedPages.length, onCancel]);

  const handleReviewConfirm = useCallback(async () => {
    setPhase("review");
    const blobs = capturedPages.map((p) => p.blob);
    // Persistent busy toast spans the full pdf-lib + compression run.
    // Scales the message with page count so users with 5+ pages get
    // a clearer expectation than a generic spinner.
    const pageCount = blobs.length;
    const busyToastId = pushToast({
      message:
        pageCount > 1
          ? `Creating PDF from ${pageCount} pages…`
          : "Creating PDF…",
      variant: "busy",
      duration: 0,
    });
    try {
      await convert(blobs);
      pushToast({
        message: "PDF ready",
        variant: "success",
        duration: 1500,
      });
      setPhase("preview");
    } catch (err) {
      // PDF assembly is the last step before upload — a failure here
      // leaves the user with nothing unless we tell them. Dump them
      // back to the review screen so they can retry without re-capturing.
      console.warn("[CameraCapture] PDF assembly failed:", err);
      pushToast({
        message: "Couldn't create the PDF — please try again",
        variant: "error",
        duration: 4000,
      });
      setPhase("review");
    } finally {
      clearToast(busyToastId);
    }
  }, [capturedPages, convert, pushToast, clearToast]);

  const handleReviewRetake = useCallback(() => {
    setPhase("capture");
  }, []);

  const handlePreviewConfirm = useCallback(() => {
    if (pdfBlob) {
      onComplete?.(pdfBlob);
    }
  }, [pdfBlob, onComplete]);

  const handlePreviewRetake = useCallback(() => {
    reset();
    setPhase("capture");
  }, [reset]);

  if (cameraError === "permission_denied") {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-black/90 fixed inset-0 z-[60] text-center">
        <h2 className="text-white text-xl font-bold mb-4">
          Camera Permission Denied
        </h2>
        <p className="text-white/70 mb-8">
          Please enable camera access in your browser settings to scan papers,
          or fallback to PDF upload.
        </p>
        <button
          onClick={onCancel}
          className="bg-pyqp-accent text-white px-6 py-3 rounded-lg font-semibold min-h-[48px]"
        >
          Upload PDF instead
        </button>
      </div>
    );
  }

  if (cameraError === "not_supported") {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-black/90 fixed inset-0 z-[60] text-center">
        <h2 className="text-white text-xl font-bold mb-4">
          Camera Not Supported
        </h2>
        <p className="text-white/70 mb-8">
          Your device doesnt support camera access. Please upload a PDF.
        </p>
        <button
          onClick={onCancel}
          className="bg-pyqp-accent text-white px-6 py-3 rounded-lg font-semibold min-h-[48px]"
        >
          Upload PDF instead
        </button>
      </div>
    );
  }

  if (phase === "capture") {
    return <Viewfinder onDone={handleViewfinderDone} />;
  }

  if (phase === "review") {
    return (
      <PageReview
        onConfirm={handleReviewConfirm}
        onRetake={handleReviewRetake}
      />
    );
  }

  return (
    <PdfPreview
      onConfirm={handlePreviewConfirm}
      onRetake={handlePreviewRetake}
    />
  );
}
