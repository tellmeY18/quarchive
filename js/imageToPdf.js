/**
 * Assemble image Blobs into a single A4 PDF.
 * Vendored libraries are loaded lazily so they stay out of the initial shell.
 */

import { PAGE_SIZE } from './constants.js'

const COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1500,
  useWebWorker: true,
  fileType: 'image/jpeg',
  initialQuality: 0.85,
}

/**
 * @param {Blob[]} images JPEG/PNG image Blobs
 * @param {(progress: number) => void} [onProgress] Called with 0..1
 * @returns {Promise<Blob>} application/pdf blob
 */
export async function imagesToPdf(images, onProgress) {
  const pdfModule = await import('../vendor/pdf-lib/pdf-lib.mjs')
  const compressionModule = await import(
    '../vendor/browser-image-compression/browser-image-compression.mjs'
  )

  const PDFDocument = pdfModule.PDFDocument || pdfModule.default?.PDFDocument
  const compress = compressionModule.default || compressionModule
  if (typeof PDFDocument !== 'function' || typeof compress !== 'function') {
    throw new Error('PDF libraries are unavailable')
  }

  const pdf = await PDFDocument.create()
  const total = images.length

  for (let i = 0; i < total; i++) {
    const compressed = await compress(images[i], COMPRESSION_OPTIONS)
    const bytes = await compressed.arrayBuffer()
    const image = await pdf.embedJpg(new Uint8Array(bytes))
    const { width, height } = image.scaleToFit(
      PAGE_SIZE.width,
      PAGE_SIZE.height,
    )
    const page = pdf.addPage([PAGE_SIZE.width, PAGE_SIZE.height])
    page.drawImage(image, {
      x: (PAGE_SIZE.width - width) / 2,
      y: (PAGE_SIZE.height - height) / 2,
      width,
      height,
    })
    onProgress?.((i + 1) / total)
  }

  const pdfBytes = await pdf.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}

export const createPdfFromImages = imagesToPdf
