/**
 * Metadata extraction from OCR text (pure).
 *
 * Suggestions are never auto-applied; every field defaults to `null` when
 * there is no evidence. Confidence values mirror the React source.
 */

/**
 * Extract course-code / name / exam type / year / month suggestions.
 *
 * @param {string} text Raw OCR text from the first 1–2 pages
 * @returns {{suggestions: Object, confidence: Object}}
 */
export function extractMetadata(text) {
  const emptyResult = {
    suggestions: {
      courseName: null,
      courseCode: null,
      examType: null,
      year: null,
      month: null,
    },
    confidence: {
      courseName: 0,
      courseCode: 0,
      examType: 0,
    },
  }

  if (!text || typeof text !== 'string') return emptyResult

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return emptyResult

  return {
    suggestions: {
      courseCode: extractCourseCode(lines) ?? null,
      courseName: extractCourseName(lines) ?? null,
      examType: extractExamType(text) ?? null,
      year: extractYear(text) ?? null,
      month: extractMonth(text) ?? null,
    },
    confidence: {
      courseCode: lines.length > 0 ? 0.7 : 0,
      courseName: lines.length > 1 ? 0.6 : 0,
      examType: 0.8,
    },
  }
}

/** Backwards-compatible name from src/lib/metadataExtract.js. */
export const extractFromOcr = extractMetadata

/**
 * Extract course code from lines.
 *
 * Pattern: [A-Z]{2,4}[ -]?\d{3,4}[A-Z]?
 * Scoring: label-adjacent +3, standalone +1; ties go to the earliest line.
 *
 * @param {string[]} lines
 * @returns {string|null}
 */
function extractCourseCode(lines) {
  const pattern = /([A-Z]{2,4})[ -]?(\d{3,4})([A-Z])?/g
  const labelKeywords = [
    'course code',
    'subject code',
    'paper code',
    'code no',
    'course no',
  ]

  const candidates = []

  lines.forEach((line, idx) => {
    const lowerLine = line.toLowerCase()
    let labelScore = 0

    for (const keyword of labelKeywords) {
      if (lowerLine.includes(keyword)) {
        labelScore = 3
        break
      }
    }

    let match
    while ((match = pattern.exec(line)) !== null) {
      const code = match[1].toUpperCase()
      const num = match[2]
      const suffix = match[3] || ''
      const fullCode = code + num + suffix

      candidates.push({
        code: fullCode,
        lineIdx: idx,
        score: labelScore > 0 ? labelScore : 1,
      })
    }
  })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.lineIdx - b.lineIdx
  })

  return normalizeCode(candidates[0].code)
}

/**
 * Uppercase, remove whitespace/hyphens, trim.
 *
 * @param {string} code
 * @returns {string}
 */
function normalizeCode(code) {
  return code
    .toUpperCase()
    .replace(/[\s-]+/g, '')
    .trim()
}

/**
 * Extract the course name adjacent to a course code, or from a
 * `Subject:/Paper:/Course:` line. Length 3–120, >=50% letters.
 *
 * @param {string[]} lines
 * @returns {string|null}
 */
function extractCourseName(lines) {
  const codePattern = /([A-Z]{2,4})[ -]?(\d{3,4})([A-Z])?/

  for (let i = 0; i < lines.length; i++) {
    if (codePattern.test(lines[i])) {
      const candidates = []

      if (i > 0) candidates.push(lines[i - 1])
      if (i < lines.length - 1) candidates.push(lines[i + 1])

      for (const line of lines) {
        if (/^(subject|paper|course)[:=\s]/i.test(line)) {
          candidates.push(line.replace(/^(subject|paper|course)[:=\s]*/i, ''))
        }
      }

      for (const candidate of candidates) {
        if (isValidCourseName(candidate)) {
          return candidate.replace(/[,.;!?]+$/, '').trim()
        }
      }
    }
  }

  return null
}

/** @param {string} name @returns {boolean} */
function isValidCourseName(name) {
  if (!name || name.length < 3 || name.length > 120) return false
  const letters = (name.match(/[a-zA-Z]/g) || []).length
  return letters / name.length >= 0.5
}

/**
 * Detect exam type. Priority is most-specific-first.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractExamType(text) {
  if (!text) return null

  const patterns = [
    { type: 'supplementary', regex: /\b(supplementary|supply exam|supple)\b/i },
    { type: 'improvement', regex: /\b(improvement|betterment)\b/i },
    {
      type: 'model',
      regex: /\b(model\s*(?:question\s*)?paper|model exam|mock)\b/i,
    },
    {
      type: 'end-semester',
      regex: /\b(end[- ]?semester|semester end|end sem|ese)\b/i,
    },
    {
      type: 'midsemester',
      regex: /\b(mid[- ]?semester|mid[- ]?sem|mse|internal assessment)\b/i,
    },
    { type: 'make-up', regex: /\b(make[- ]?up|makeup exam)\b/i },
    {
      type: 're-exam',
      // Accepts "re-examination", "re-test", "re-appearance"; the leading
      // boundary still rejects "pre-exam" / "core-exam".
      regex: /\bre[- ]?(exam(?:ination)?|test|appear(?:ance)?)\b/i,
    },
    { type: 'save-a-year', regex: /\b(save[- ]?a[- ]?year|say exam)\b/i },
    { type: 'main', regex: /\b(regular|main exam|end of semester)\b/i },
  ]

  for (const { type, regex } of patterns) {
    if (regex.test(text)) return type
  }

  return null
}

/** @param {string} text @returns {string|null} First 19xx/20xx year in 1990–2030. */
function extractYear(text) {
  const match = text.match(/\b(20\d{2}|19\d{2})\b/)
  if (match) {
    const year = parseInt(match[1], 10)
    if (year >= 1990 && year <= 2030) return year.toString()
  }
  return null
}

/** @param {string} text @returns {string|null} Lowercase month name. */
function extractMonth(text) {
  const monthNames = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ]

  const lowerText = text.toLowerCase()

  for (let i = 0; i < monthNames.length; i++) {
    if (lowerText.includes(monthNames[i])) return monthNames[i]
  }

  const match = text.match(/\b(0?[1-9]|1[0-2])\b/)
  if (match) return monthNames[parseInt(match[1], 10) - 1]

  return null
}

/**
 * Normalise an OCR/manual course code for identifier slug creation.
 *
 * @param {string} code
 * @returns {string} Uppercase, trimmed, whitespace/hyphens collapsed
 */
export function normalizeCourseCode(code) {
  if (!code || typeof code !== 'string') return ''
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '')
}

/** Backwards-compatible name from src/lib/metadataExtract.js. */
export const normaliseCourseCodeForSlug = normalizeCourseCode
