import { useState, useCallback, useRef } from "react";
import useWizardStore from "../../../store/wizardStore";
import {
  buildIdentifier,
  validateMetadata,
  validatePdfMagic,
} from "../../../lib/metadata";
import { normaliseCourseCodeForSlug } from "../../../lib/metadataExtract";
import InstitutionSearch from "../InstitutionSearch";
import { useOcrPrefill } from "../../../hooks/useOcrPrefill";

const CURRENT_YEAR = new Date().getFullYear();

const YEARS = Array.from(
  { length: CURRENT_YEAR - 2000 + 1 },
  (_, i) => CURRENT_YEAR - i,
);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EXAM_TYPES = [
  { value: "main", label: "Main" },
  { value: "supplementary", label: "Supplementary" },
  { value: "model", label: "Model" },
  { value: "improvement", label: "Improvement" },
  { value: "end-semester", label: "End Semester" },
  { value: "midsemester", label: "Midsemester" },
  { value: "make-up", label: "Make Up" },
  { value: "re-exam", label: "Re-Exam" },
  { value: "save-a-year", label: "Save A Year" },
];

const SEMESTERS = [
  { value: "1", label: "Semester 1" },
  { value: "2", label: "Semester 2" },
  { value: "3", label: "Semester 3" },
  { value: "4", label: "Semester 4" },
  { value: "5", label: "Semester 5" },
  { value: "6", label: "Semester 6" },
  { value: "7", label: "Semester 7" },
  { value: "8", label: "Semester 8" },
  { value: "annual", label: "Annual" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ml", label: "Malayalam" },
  { value: "hi", label: "Hindi" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "kn", label: "Kannada" },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export default function StepMetadata() {
  const {
    metadata,
    file,
    pdfBlob,
    ocrStatus,
    ocrSuggestions,
    ocrDismissed,
    setMetadata,
    setFile,
    setIdentifier,
    setStep,
    dismissOcrSuggestion,
    acceptOcrSuggestion,
  } = useWizardStore();
  const [errors, setErrors] = useState([]);
  const [fileError, setFileError] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Trigger OCR when PDF is ready (Phase 8)
  useOcrPrefill(pdfBlob, true);

  // Compute identifier preview live (with normalization)
  const identifierPreview =
    metadata.institution?.qid && metadata.year && metadata.examType
      ? buildIdentifier({
          wikidataQid: metadata.institution.qid,
          courseCode:
            normaliseCourseCodeForSlug(metadata.courseCode) ||
            metadata.courseName ||
            "paper",
          year: metadata.year,
          examType: metadata.examType,
        })
      : "";

  // File validation helper
  const handleFileSelect = useCallback(
    async (selectedFile) => {
      setFileError(null);

      if (!selectedFile) return;

      // Check MIME type
      if (selectedFile.type !== "application/pdf") {
        setFileError("Only PDF files are accepted.");
        return;
      }

      // Check size
      if (selectedFile.size > MAX_FILE_SIZE) {
        setFileError(
          "File size must be under 50MB. Current size: " +
            (selectedFile.size / 1024 / 1024).toFixed(1) +
            "MB.",
        );
        return;
      }

      // Validate PDF magic bytes
      const isValidPdf = await validatePdfMagic(selectedFile);
      if (!isValidPdf) {
        setFileError("This file does not appear to be a valid PDF.");
        return;
      }

      setFile(selectedFile);
    },
    [setFile],
  );

  // Drop zone handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer?.files?.[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect],
  );

  const handleFileInputChange = useCallback(
    (e) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) handleFileSelect(selectedFile);
    },
    [handleFileSelect],
  );

  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setFile]);

  // Submit handler
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setIsSubmitting(true);
      setErrors([]);

      // Validate metadata
      const result = validateMetadata(metadata, file);
      if (!result.valid) {
        setErrors(result.errors);
        setIsSubmitting(false);
        return;
      }

      // Validate PDF magic bytes
      if (file) {
        const isValidPdf = await validatePdfMagic(file);
        if (!isValidPdf) {
          setErrors(["The selected file is not a valid PDF."]);
          setIsSubmitting(false);
          return;
        }
      }

      // Compute identifier and advance (with normalization)
      const identifier = buildIdentifier({
        wikidataQid: metadata.institution.qid,
        courseCode:
          normaliseCourseCodeForSlug(metadata.courseCode) ||
          metadata.courseName ||
          "paper",
        year: metadata.year,
        examType: metadata.examType,
      });
      setIdentifier(identifier);
      setStep(2);
      setIsSubmitting(false);
    },
    [metadata, file, setIdentifier, setStep],
  );

  const inputClasses =
    "w-full rounded-lg border border-pyqp-border bg-pyqp-card px-3 py-2 text-sm text-pyqp-text placeholder:text-pyqp-muted focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent transition-colors";
  const labelClasses = "block text-sm font-medium text-pyqp-text mb-1.5";
  const selectClasses =
    "w-full rounded-lg border border-pyqp-border bg-pyqp-card px-3 py-2 text-sm text-pyqp-text focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 focus:border-pyqp-accent transition-colors appearance-none cursor-pointer";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="border-b border-pyqp-border pb-4 mb-6">
        <h2 className="font-heading text-xl font-bold text-pyqp-text">
          Upload a Question Paper
        </h2>
        <p className="mt-1 text-sm text-pyqp-muted">
          Fill in the paper details below. Fields marked with * are required.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Institution - full width */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            University / Institution <span className="text-red-500">*</span>
          </label>
          <InstitutionSearch
            value={metadata.institution}
            onChange={(inst) => setMetadata("institution", inst)}
          />
          <p className="mt-1 text-xs text-pyqp-muted">
            Search powered by Wikidata. Start typing to find your university.
          </p>
        </div>

        {/* Program */}
        <div>
          <label htmlFor="meta-program" className={labelClasses}>
            Program / Degree
          </label>
          <input
            id="meta-program"
            type="text"
            value={metadata.program}
            onChange={(e) => setMetadata("program", e.target.value)}
            placeholder="e.g. B.Sc Computer Science"
            className={inputClasses}
          />
        </div>

        {/* Course Name */}
        <div>
          <label htmlFor="meta-course-name" className={labelClasses}>
            Course Name
            {ocrStatus === "running" && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-blue-600">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                ✨ Reading paper…
              </span>
            )}
          </label>
          {/* Phase 8: OCR Suggestion Pill */}
          {ocrSuggestions.courseName &&
            !ocrDismissed.courseName &&
            !metadata.courseName && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs">
                <span className="text-blue-600">✨ Suggested:</span>
                <span className="font-medium text-blue-900">
                  {ocrSuggestions.courseName}
                </span>
                <button
                  onClick={() => {
                    setMetadata("courseName", ocrSuggestions.courseName);
                    acceptOcrSuggestion("courseName");
                  }}
                  className="ml-auto rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                >
                  Use
                </button>
                <button
                  onClick={() => dismissOcrSuggestion("courseName")}
                  className="rounded px-1.5 py-1 text-blue-400 hover:text-blue-600"
                >
                  ✕
                </button>
              </div>
            )}
          <input
            id="meta-course-name"
            type="text"
            value={metadata.courseName}
            onChange={(e) => setMetadata("courseName", e.target.value)}
            placeholder="e.g. Data Structures"
            className={inputClasses}
          />
        </div>

        {/* Course Code */}
        <div>
          <label htmlFor="meta-course-code" className={labelClasses}>
            Course Code{" "}
            <span className="text-pyqp-muted font-normal">(optional)</span>
          </label>
          {/* Phase 8: OCR Suggestion Pill */}
          {ocrSuggestions.courseCode &&
            !ocrDismissed.courseCode &&
            !metadata.courseCode && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs">
                <span className="text-blue-600">✨ Suggested:</span>
                <span className="font-medium text-blue-900">
                  {ocrSuggestions.courseCode}
                </span>
                <button
                  onClick={() => {
                    setMetadata("courseCode", ocrSuggestions.courseCode);
                    acceptOcrSuggestion("courseCode");
                  }}
                  className="ml-auto rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                >
                  Use
                </button>
                <button
                  onClick={() => dismissOcrSuggestion("courseCode")}
                  className="rounded px-1.5 py-1 text-blue-400 hover:text-blue-600"
                >
                  ✕
                </button>
              </div>
            )}
          <input
            id="meta-course-code"
            type="text"
            value={metadata.courseCode}
            onChange={(e) => setMetadata("courseCode", e.target.value)}
            placeholder="e.g. CS301"
            className={inputClasses}
          />
        </div>

        {/* Language */}
        <div>
          <label htmlFor="meta-language" className={labelClasses}>
            Language
          </label>
          <div className="relative">
            <select
              id="meta-language"
              value={metadata.language}
              onChange={(e) => setMetadata("language", e.target.value)}
              className={selectClasses}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label} ({lang.value})
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted pointer-events-none"
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
          </div>
        </div>

        {/* Exam Year */}
        <div>
          <label htmlFor="meta-year" className={labelClasses}>
            Exam Year <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="meta-year"
              value={metadata.year}
              onChange={(e) => setMetadata("year", e.target.value)}
              className={selectClasses}
            >
              <option value="">Select year</option>
              {YEARS.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted pointer-events-none"
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
          </div>
        </div>

        {/* Month */}
        <div>
          <label htmlFor="meta-month" className={labelClasses}>
            Month / Session
          </label>
          <div className="relative">
            <select
              id="meta-month"
              value={metadata.month}
              onChange={(e) => setMetadata("month", e.target.value)}
              className={selectClasses}
            >
              <option value="">Select month</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted pointer-events-none"
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
          </div>
        </div>

        {/* Semester */}
        <div>
          <label htmlFor="meta-semester" className={labelClasses}>
            Semester
          </label>
          <div className="relative">
            <select
              id="meta-semester"
              value={metadata.semester}
              onChange={(e) => setMetadata("semester", e.target.value)}
              className={selectClasses}
            >
              <option value="">Select semester</option>
              {SEMESTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-pyqp-muted pointer-events-none"
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
          </div>
        </div>

        {/* Exam Type - full width */}
        <div className="md:col-span-2">
          <fieldset>
            <legend className={labelClasses}>
              Exam Type <span className="text-red-500">*</span>
            </legend>
            {/* Phase 8: OCR Suggestion Pill */}
            {ocrSuggestions.examType &&
              !ocrDismissed.examType &&
              !metadata.examType && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs">
                  <span className="text-blue-600">✨ Suggested:</span>
                  <span className="font-medium text-blue-900">
                    {
                      EXAM_TYPES.find(
                        (t) => t.value === ocrSuggestions.examType,
                      )?.label
                    }
                  </span>
                  <button
                    onClick={() => {
                      setMetadata("examType", ocrSuggestions.examType);
                      acceptOcrSuggestion("examType");
                    }}
                    className="ml-auto rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => dismissOcrSuggestion("examType")}
                    className="rounded px-1.5 py-1 text-blue-400 hover:text-blue-600"
                  >
                    ✕
                  </button>
                </div>
              )}
            <div className="flex flex-wrap gap-4 mt-1">
              {EXAM_TYPES.map((type) => (
                <label
                  key={type.value}
                  className={
                    "inline-flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors " +
                    (metadata.examType === type.value
                      ? "border-pyqp-accent bg-pyqp-accent/10 text-pyqp-text font-medium"
                      : "border-pyqp-border bg-pyqp-card text-pyqp-text-light hover:border-pyqp-accent/50")
                  }
                >
                  <input
                    type="radio"
                    name="examType"
                    value={type.value}
                    checked={metadata.examType === type.value}
                    onChange={(e) => setMetadata("examType", e.target.value)}
                    className="sr-only"
                  />
                  <span
                    className={
                      "inline-block w-3 h-3 rounded-full border-2 " +
                      (metadata.examType === type.value
                        ? "border-pyqp-accent bg-pyqp-accent"
                        : "border-pyqp-muted")
                    }
                  />
                  {type.label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* PDF File drop zone - full width */}
        <div className="md:col-span-2">
          <label className={labelClasses}>
            PDF File <span className="text-red-500">*</span>
          </label>

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={
                "rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors " +
                (isDragOver
                  ? "border-pyqp-accent bg-pyqp-accent/5"
                  : "border-pyqp-border hover:border-pyqp-accent/50 bg-pyqp-card")
              }
            >
              <svg
                className="mx-auto h-10 w-10 text-pyqp-muted mb-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              <p className="text-sm font-medium text-pyqp-text">
                Drop PDF here or click to browse
              </p>
              <p className="mt-1 text-xs text-pyqp-muted">
                Max 50MB &middot; PDF only
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-pyqp-border bg-pyqp-card px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <svg
                  className="h-8 w-8 text-red-500 shrink-0"
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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-pyqp-text truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-pyqp-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="shrink-0 text-pyqp-muted hover:text-red-600 transition-colors cursor-pointer"
                aria-label="Remove file"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}

          {fileError && (
            <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1.5">
              <svg
                className="h-4 w-4 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              {fileError}
            </p>
          )}
        </div>
      </div>

      {/* Identifier preview */}
      {identifierPreview && (
        <details className="rounded-lg border border-pyqp-border bg-pyqp-bg px-4 py-3">
          <summary className="text-sm font-medium text-pyqp-text-light cursor-pointer select-none">
            Identifier preview
          </summary>
          <code className="mt-2 block text-xs font-mono text-pyqp-accent bg-pyqp-card rounded px-3 py-2 border border-pyqp-border break-all">
            {identifierPreview}
          </code>
        </details>
      )}

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 space-y-1">
          {errors.map((err, i) => (
            <p key={i} className="text-sm text-red-700 flex items-start gap-2">
              <svg
                className="h-4 w-4 mt-0.5 shrink-0 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <span>{err}</span>
            </p>
          ))}
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-lg bg-pyqp-accent text-white px-6 py-2.5 text-sm font-medium hover:bg-pyqp-accent-hover focus:outline-none focus:ring-2 focus:ring-pyqp-accent/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin h-4 w-4 text-white"
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
              Validating...
            </>
          ) : (
            <>
              Check for Duplicates
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
            </>
          )}
        </button>
      </div>
    </form>
  );
}
