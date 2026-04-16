import { create } from 'zustand'

const initialState = {
  step: 1,
  metadata: {
    institution: { label: '', qid: '' },
    program: '',
    courseName: '',
    courseCode: '',
    year: '',
    month: '',
    examType: '',
    semester: '',
    language: 'en',
  },
  file: null,
  fileHash: '',
  identifier: '',
  dedupStatus: null,
  duplicateItem: null,
  uploadStatus: null,
  uploadError: null,
}

const useWizardStore = create((set) => ({
  ...initialState,

  setStep: (n) => set({ step: n }),

  setMetadata: (field, value) =>
    set((state) => ({
      metadata: { ...state.metadata, [field]: value },
    })),

  setFile: (file) => set({ file }),

  setFileHash: (hash) => set({ fileHash: hash }),

  setIdentifier: (id) => set({ identifier: id }),

  setDedupStatus: (status) => set({ dedupStatus: status }),

  setDuplicateItem: (item) => set({ duplicateItem: item }),

  setUploadStatus: (status) => set({ uploadStatus: status }),

  setUploadError: (msg) => set({ uploadError: msg }),

  resetWizard: () => set({ ...initialState }),
}))

export default useWizardStore
