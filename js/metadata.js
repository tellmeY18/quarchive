/**
 * Metadata schema builder & validator.
 * Deterministic identifier formula: quarchive--{qid}--{slug}--{year}--{examType}.
 */

import { EXAM_TYPES, MAX_FILE_BYTES } from './constants.js'

export { EXAM_TYPES, MAX_FILE_BYTES }

/**
 * Build the Archive.org identifier.
 *
 * @param {{wikidataQid: string, courseCode: string, year: string|number,
 *   examType: string}} metadata
 * @returns {string}
 */
export function makeIdentifier({ wikidataQid, courseCode, year, examType }) {
  const slug = courseCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `quarchive--${wikidataQid}--${slug}--${year}--${examType}`
}

/** Backwards-compatible name from src/lib/metadata.js. */
export const buildIdentifier = makeIdentifier

/**
 * Build the metadata header map sent to Archive.org as x-archive-meta-*.
 *
 * @param {object} metadata Wizard metadata state
 * @param {string} fileHash SHA-256 of the file being uploaded
 * @param {object} [options]
 * @param {'camera-scan'|'pdf-upload'} [options.source] Upload method
 * @param {Object<string,boolean>} [options.ocrAccepted] Accepted OCR fields;
 *   emitted as a sorted, comma-separated `ocr-assist` value (`none` if empty)
 * @returns {Object<string,string>}
 */
export function buildMetadataHeaders(metadata, fileHash, options = {}) {
  const {
    institution,
    program,
    courseName,
    courseCode,
    year,
    month,
    examType,
    semester,
    language,
  } = metadata

  const { source, ocrAccepted } = options

  const parts = [program, courseName, courseCode ? `(${courseCode})` : '']
    .filter(Boolean)
    .join(' - ')
  const description = `${parts} - ${month || ''} ${year} ${examType}`
    .replace(/\s+/g, ' ')
    .trim()

  let ocrAssist = 'none'
  if (ocrAccepted && typeof ocrAccepted === 'object') {
    const accepted = Object.keys(ocrAccepted)
      .filter((k) => ocrAccepted[k])
      .sort()
    if (accepted.length > 0) ocrAssist = accepted.join(',')
  }

  const headers = {
    title: `${courseName || courseCode || 'Question Paper'} - ${institution.label} - ${year}`,
    description,
    creator: institution.label,
    date: year,
    language: language || 'en',
    subject: `quarchive;${institution.qid}`,
    'course-code': courseCode,
    program: program,
    semester: semester,
    'exam-type': examType,
    sha256: fileHash,
    'ocr-assist': ocrAssist,
  }

  if (source) headers.source = source

  return headers
}

/** Backwards-compatible name from src/lib/metadata.js. */
export const buildMetaHeaders = buildMetadataHeaders

/**
 * Validate wizard metadata and file before upload.
 *
 * @param {object} metadata
 * @param {File|{type:string,size:number}} file
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateMetadata(metadata, file) {
  const errors = []

  if (!metadata.institution?.qid) {
    errors.push('Please select a university from the autocomplete list.')
  }

  if (!/^\d{4}$/.test(metadata.year)) {
    errors.push('Year must be a 4-digit number (e.g. 2023).')
  }

  if (!EXAM_TYPES.includes(metadata.examType)) {
    errors.push(`Exam type must be one of: ${EXAM_TYPES.join(', ')}.`)
  }

  if (!file) {
    errors.push('Please select a PDF file to upload.')
  } else {
    if (file.type !== 'application/pdf') {
      errors.push('Only PDF files are accepted.')
    }

    if (file.size > MAX_FILE_BYTES) {
      errors.push(
        `File size must be under 50MB. Current size: ${(file.size / 1024 / 1024).toFixed(1)}MB.`,
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Check the %PDF magic bytes of a file slice.
 *
 * @param {Blob} file
 * @returns {Promise<boolean>}
 */
export async function validatePdfMagic(file) {
  const slice = file.slice(0, 4)
  const buffer = await slice.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}
