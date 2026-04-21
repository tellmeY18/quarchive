import { create } from "zustand"

export const VALID_EXAM_TYPES = [
  "main", "supplementary", "model", "improvement",
  "end-semester", "midsemester", "make-up", "re-exam", "save-a-year",
]

const CURRENT_YEAR = new Date().getFullYear()

export function normaliseBulkCourseCode(code) {
  if (!code || typeof code !== "string") return ""
  return code.trim().toUpperCase().replace(/[\s-]+/g, "")
}

export function computeIdentifier(metadata, institution) {
  if (!institution?.qid) return null
  const code = normaliseBulkCourseCode(metadata.courseCode)
  if (!code || !metadata.year || !metadata.examType) return null
  const slug = code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/ ,"")
  return "quarchive--" + institution.qid + "--" + slug + "--" + metadata.year + "--" + metadata.examType
}

export function computeIsReady(metadata, institution) {
  if (!institution?.qid) return false
  if (!normaliseBulkCourseCode(metadata.courseCode)) return false
  if (!metadata.year || !/^\d{4}$/.test(metadata.year)) return false
  const year = parseInt(metadata.year, 10)
  if (year < 1980 || year > CURRENT_YEAR + 1) return false
  if (!VALID_EXAM_TYPES.includes(metadata.examType)) return false
  return true
}

export function computeValidationErrors(metadata) {
  const errors = {}
  if (!normaliseBulkCourseCode(metadata.courseCode)) errors.courseCode = "Required"
  if (!metadata.year) {
    errors.year = "Required"
  } else if (!/^\d{4}$/.test(metadata.year)) {
    errors.year = "Must be a 4-digit year"
  } else {
    const y = parseInt(metadata.year, 10)
    if (y < 1980 || y > CURRENT_YEAR + 1) errors.year = "Must be 1980-" + (CURRENT_YEAR + 1)
  }
  if (!VALID_EXAM_TYPES.includes(metadata.examType)) errors.examType = "Required"
  return errors
}

let _idCounter = 0
function nextId() { return "bulk-" + Date.now() + "-" + (++_idCounter) }

export function createBulkFileRecord(file) {
  return {
    id: nextId(), file, name: file.name, size: file.size,
    thumbnailDataUrl: null, thumbnailLoading: true,
    hash: null, hashStatus: "idle",
    ocrStatus: "idle",
    ocrSuggestions: { courseName: null, courseCode: null, examType: null, year: null, month: null },
    ocrDismissed: {}, ocrAccepted: {},
    metadata: { program: "", courseName: "", courseCode: "", year: "", month: "", examType: "", semester: "", language: "en" },
    identifier: null, isReady: false, validationErrors: {},
    dedupStatus: null, duplicateUrl: null,
    uploadStatus: null, uploadProgress: 0, uploadError: null, archiveUrl: null, retryCount: 0,
  }
}

const useBulkStore = create((set) => ({
  files: [],
  institution: { label: "", qid: "" },
  defaultLanguage: "en",
  uploadStarted: false,
  isUploading: false,

  addFiles: (fileObjects) =>
    set((state) => {
      const existingNames = new Set(state.files.map((f) => f.name))
      const fresh = fileObjects.filter((f) => !existingNames.has(f.name)).map((f) => createBulkFileRecord(f))
      if (fresh.length === 0) return state
      return { files: [...state.files, ...fresh] }
    }),

  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),

  clearAll: () => set({ files: [], uploadStarted: false, isUploading: false }),

  updateFile: (id, patch) =>
    set((state) => ({ files: state.files.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),

  setFileMetadata: (id, field, value) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f
        const newMeta = { ...f.metadata, [field]: value }
        return {
          ...f, metadata: newMeta,
          isReady: computeIsReady(newMeta, state.institution),
          identifier: computeIdentifier(newMeta, state.institution),
          validationErrors: computeValidationErrors(newMeta),
        }
      }),
    })),

  setOcrSuggestions: (id, suggestions) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, ocrSuggestions: { ...f.ocrSuggestions, ...suggestions }, ocrStatus: "done" } : f
      ),
    })),

  acceptOcrField: (id, fieldName, value) =>
    set((state) => ({
      files: state.files.map((f) => {
        if (f.id !== id) return f
        const normValue = fieldName === "courseCode" ? normaliseBulkCourseCode(value) : value
        const newMeta = { ...f.metadata, [fieldName]: normValue }
        return {
          ...f,
          ocrAccepted: { ...f.ocrAccepted, [fieldName]: true },
          metadata: newMeta,
          isReady: computeIsReady(newMeta, state.institution),
          identifier: computeIdentifier(newMeta, state.institution),
          validationErrors: computeValidationErrors(newMeta),
        }
      }),
    })),

  dismissOcrField: (id, fieldName) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, ocrDismissed: { ...f.ocrDismissed, [fieldName]: true } } : f
      ),
    })),

  setThumbnail: (id, dataUrl) =>
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, thumbnailDataUrl: dataUrl, thumbnailLoading: false } : f
      ),
    })),

  setThumbnailLoading: (id, loading) =>
    set((state) => ({ files: state.files.map((f) => f.id === id ? { ...f, thumbnailLoading: loading } : f) })),

  setInstitutionAndRevalidate: (institution) =>
    set((state) => ({
      institution,
      files: state.files.map((f) => ({
        ...f,
        isReady: computeIsReady(f.metadata, institution),
        identifier: computeIdentifier(f.metadata, institution),
        validationErrors: computeValidationErrors(f.metadata),
      })),
    })),

  setDefaultLanguage: (lang) => set({ defaultLanguage: lang }),
  setUploadStarted: (bool) => set({ uploadStarted: bool }),
  setIsUploading: (bool) => set({ isUploading: bool }),

  reset: () => set({ files: [], institution: { label: "", qid: "" }, defaultLanguage: "en", uploadStarted: false, isUploading: false }),
}))

export default useBulkStore
