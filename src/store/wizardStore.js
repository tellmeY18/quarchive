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

  setFile: (file) => set({ file }),

  setFileHash: (hash) => set({ fileHash: hash }),

  setIdentifier: (id) => set({ identifier: id }),

  setDedupStatus: (status) => set({ dedupStatus: status }),

  setDuplicateItem: (item) => set({ duplicateItem: item }),

  setUploadStatus: (status) => set({ uploadStatus: status }),

  setUploadError: (msg) => set({ uploadError: msg }),

  resetWizard: () => set({ ...initialState }),
}));

export default useWizardStore;
