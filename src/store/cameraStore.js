import { create } from 'zustand'

const useCameraStore = create((set) => ({
  capturedPages: [],
  isCapturing: false,
  reviewMode: false,
  pdfBlob: null,
  pdfSize: 0,
  converting: false,
  convertProgress: 0,
  cameraError: null,

  addPage: (page) =>
    set((s) => ({ capturedPages: [...s.capturedPages, page] })),

  removePage: (id) =>
    set((s) => ({
      capturedPages: s.capturedPages.filter((p) => p.id !== id),
    })),

  reorderPages: (pages) => set({ capturedPages: pages }),

  replacePage: (id, newPage) =>
    set((s) => ({
      capturedPages: s.capturedPages.map((p) => (p.id === id ? newPage : p)),
    })),

  clearPages: () => set({ capturedPages: [], pdfBlob: null, pdfSize: 0 }),

  setCapturing: (bool) => set({ isCapturing: bool }),
  setReviewMode: (bool) => set({ reviewMode: bool }),
  setPdfBlob: (blob) => set({ pdfBlob: blob, pdfSize: blob?.size || 0 }),
  setConverting: (bool) => set({ converting: bool }),
  setConvertProgress: (p) => set({ convertProgress: p }),
  setCameraError: (err) => set({ cameraError: err }),

  reset: () =>
    set({
      capturedPages: [],
      isCapturing: false,
      reviewMode: false,
      pdfBlob: null,
      pdfSize: 0,
      converting: false,
      convertProgress: 0,
      cameraError: null,
    }),
}))

export default useCameraStore
