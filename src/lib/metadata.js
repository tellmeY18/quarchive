/**
 * Metadata schema builder & validator.
 * Implements the deterministic identifier formula from CLAUDE.md section 7.
 */

const VALID_EXAM_TYPES = ['main', 'supplementary', 'model', 'improvement']

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function buildIdentifier({ wikidataQid, courseCode, year, examType }) {
  const slug = courseCode.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `quarchive--${wikidataQid}--${slug}--${year}--${examType}`
}

export function buildMetaHeaders(metadata, fileHash) {
  const { institution, program, courseName, courseCode, year, month, examType, semester, language } =
    metadata

  const parts = [program, courseName, courseCode ? `(${courseCode})` : ''].filter(Boolean).join(' - ')
  const description = `${parts} - ${month || ''} ${year} ${examType}`.replace(/\s+/g, ' ').trim()

  return {
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
  }
}

export function validateMetadata(metadata, file) {
  const errors = []

  if (!metadata.institution?.qid) {
    errors.push('Please select a university from the autocomplete list.')
  }

  if (!/^\d{4}$/.test(metadata.year)) {
    errors.push('Year must be a 4-digit number (e.g. 2023).')
  }

  if (!VALID_EXAM_TYPES.includes(metadata.examType)) {
    errors.push(`Exam type must be one of: ${VALID_EXAM_TYPES.join(', ')}.`)
  }

  if (!file) {
    errors.push('Please select a PDF file to upload.')
  } else {
    if (file.type !== 'application/pdf') {
      errors.push('Only PDF files are accepted.')
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push(`File size must be under 50MB. Current size: ${(file.size / 1024 / 1024).toFixed(1)}MB.`)
    }
  }

  return { valid: errors.length === 0, errors }
}

export async function validatePdfMagic(file) {
  const slice = file.slice(0, 4)
  const buffer = await slice.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
}
