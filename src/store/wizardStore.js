import { create } from "zustand";

const currentDate = new Date();
const currentYear = currentDate.getFullYear().toString();
const monthNames = [
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
const currentMonth = monthNames[currentDate.getMonth()];

const initialState = {
  step: 1,
  source: null, // 'camera' | 'pdf_upload' | null
  metadata: {
    institution: {
      label: "National Institute of Technology Calicut",
      qid: "Q6973731",
    },
    program: "B.Tech",
    courseName: "",
    courseCode: "",
    year: currentYear,
    month: currentMonth,
    examType: "",
    semester: "",
    language: "en",
  },
  // Phase 8: OCR-assisted prefill
  ocrStatus: "idle", // 'idle' | 'running' | 'done' | 'failed'
  ocrSuggestions: {
    courseName: null,
    courseCode: null,
    examType: null,
    year: null,
    month: null,
  },
  ocrDismissed: {}, // { [fieldName]: true } for dismissed suggestions
  ocrAccepted: {}, // { [fieldName]: true } — user tapped "Use" on a suggestion.
  // Drives the `ocr-assist` metadata header emitted at upload
  // time (CLAUDE.md §11) so we have per-item visibility into
  // how much OCR actually helped, without any analytics.
  pdfBlob: null, // Set from camera or file upload, used for OCR
  // end Phase 8
  file: null,
  fileHash: "",
  identifier: "",
  dedupStatus: null,
  duplicateItem: null,
  uploadStatus: null,
  uploadError: null,
};

const useWizardStore = create((set) => ({
  ...initialState,

  setStep: (n) => set({ step: n }),

  setSource: (source) => set({ source }),

  setMetadata: (field, value) =>
    set((state) => ({
      metadata: { ...state.metadata, [field]: value },
    })),

  // Phase 8: OCR state management
  setOcrStatus: (status) => set({ ocrStatus: status }),

  setOcrSuggestions: (suggestions) => set({ ocrSuggestions: suggestions }),

  dismissOcrSuggestion: (fieldName) =>
    set((state) => ({
      ocrDismissed: { ...state.ocrDismissed, [fieldName]: true },
    })),

  // Record that the user accepted an OCR suggestion for `fieldName`.
  // Called by StepMetadata when the user taps "Use" on a ✨ pill. This
  // is local-only state; it's read at upload time to build the
  // `ocr-assist` metadata header and never transmitted as telemetry.
  acceptOcrSuggestion: (fieldName) =>
    set((state) => ({
      ocrAccepted: { ...state.ocrAccepted, [fieldName]: true },
    })),

  resetOcr: () =>
    set({
      ocrStatus: "idle",
      ocrSuggestions: {
        courseName: null,
        courseCode: null,
        examType: null,
        year: null,
        month: null,
      },
      ocrDismissed: {},
      ocrAccepted: {},
    }),
  // end Phase 8

  setFile: (file) => set({ file }),

  setPdfBlob: (blob) => set({ pdfBlob: blob }),

  setFileHash: (hash) => set({ fileHash: hash }),

  setIdentifier: (id) => set({ identifier: id }),

  setDedupStatus: (status) => set({ dedupStatus: status }),

  setDuplicateItem: (item) => set({ duplicateItem: item }),

  setUploadStatus: (status) => set({ uploadStatus: status }),

  setUploadError: (msg) => set({ uploadError: msg }),

  resetWizard: () => set({ ...initialState }),
}));

export default useWizardStore;
