/**
 * Convert an array of image Blobs into a single PDF.
 * Uses dynamic imports so pdf-lib and browser-image-compression
 * are never in the main bundle.
 *
 * @param {Blob[]} imageBlobs - JPEG/PNG image blobs
 * @param {(progress: number) => void} [onProgress] - 0-1 progress callback
 * @returns {Promise<Blob>} PDF blob
 */
export async function imagesToPdf(imageBlobs, onProgress) {
  const { PDFDocument } = await import('pdf-lib')
  const imageCompression = (await import('browser-image-compression')).default

  const pdf = await PDFDocument.create()

  for (let i = 0; i < imageBlobs.length; i++) {
    // 1. Compress
    const compressed = await imageCompression(imageBlobs[i], {
      maxWidthOrHeight: 1500,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    })

    // 2. Embed as JPEG
    const arrayBuffer = await compressed.arrayBuffer()
    const image = await pdf.embedJpg(new Uint8Array(arrayBuffer))

    // 3. Add A4 page, scale image to fit, centre
    const page = pdf.addPage([595, 842]) // A4 in points
    const { width, height } = image.scaleToFit(595, 842)
    page.drawImage(image, {
      x: (595 - width) / 2,
      y: (842 - height) / 2,
      width,
      height,
    })

    onProgress?.((i + 1) / imageBlobs.length)
  }

  const pdfBytes = await pdf.save()
  return new Blob([pdfBytes], { type: 'application/pdf' })
}
