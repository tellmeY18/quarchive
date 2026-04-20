/**
 * Metadata Extraction from OCR Text
 *
 * Pure function that analyzes OCR-extracted text to suggest:
 * - courseName: Name of the course/subject
 * - courseCode: University identifier (CS301, MA101, etc.)
 * - examType: Type of exam (main, supplementary, model, etc.)
 * - year: Academic year
 * - month: Exam month
 *
 * All suggestions include confidence scores. No field is ever auto-filled
 * without user confirmation.
 */

/**
 * Extract metadata from OCR text
 *
 * @param {string} text - Raw OCR text from first 1-2 pages
 * @returns {Object} { suggestions: {...}, confidence: {...} }
 */
export function extractFromOcr(text) {
  // Empty / non-string inputs must still return fully-shaped suggestions
  // so downstream code (e.g. StepMetadata's ✨ pill gates) can safely
  // read `result.suggestions.courseCode` without defaulting themselves.
  // All fields default to `null` — matches the "no guess" contract from
  // CLAUDE.md §5B and the unit-test expectations.
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
  };

  if (!text || typeof text !== "string") {
    return emptyResult;
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return emptyResult;
  }

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
  };
}

/**
 * Extract course code from lines
 *
 * Pattern: [A-Z]{2,4}[ -]?\d{3,4}[A-Z]?
 * Examples: CS301, CS 301, MA1011, ECE202A, BT-204
 *
 * Scoring:
 * - Label-adjacent (Course Code, Subject Code, etc.): +3
 * - Parenthesised after course name: +2
 * - Standalone in header: +1
 */
function extractCourseCode(lines) {
  const pattern = /([A-Z]{2,4})[ -]?(\d{3,4})([A-Z])?/g;
  const labelKeywords = [
    "course code",
    "subject code",
    "paper code",
    "code no",
    "course no",
  ];

  const candidates = [];

  lines.forEach((line, idx) => {
    // Check if this line has a label
    const lowerLine = line.toLowerCase();
    let labelScore = 0;

    for (const keyword of labelKeywords) {
      if (lowerLine.includes(keyword)) {
        labelScore = 3;
        break;
      }
    }

    // Extract all code patterns in this line
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const code = match[1].toUpperCase();
      const num = match[2];
      const suffix = match[3] || "";

      const fullCode = code + num + suffix;

      candidates.push({
        code: fullCode,
        lineIdx: idx,
        score: labelScore > 0 ? labelScore : 1,
      });
    }
  });

  if (candidates.length === 0) {
    return null;
  }

  // Pick highest scored; if tie, pick soonest (header)
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.lineIdx - b.lineIdx;
  });

  return normalizeCode(candidates[0].code);
}

/**
 * Normalise course code:
 * 1. Uppercase
 * 2. Collapse internal whitespace/hyphens
 * 3. Trim
 */
function normalizeCode(code) {
  return code
    .toUpperCase()
    .replace(/[\s-]+/g, "") // Remove spaces and hyphens
    .trim();
}

/**
 * Extract course name
 *
 * Usually the line immediately above/below the course code,
 * or on a line starting with Subject: / Paper: / Course:
 *
 * Sanity checks:
 * - Length: 3–120 chars
 * - Alpha ratio: >= 50% letters
 */
function extractCourseName(lines) {
  // First, find the course code to know what to pair with
  const codePattern = /([A-Z]{2,4})[ -]?(\d{3,4})([A-Z])?/;

  for (let i = 0; i < lines.length; i++) {
    if (codePattern.test(lines[i])) {
      // Found code line, check adjacent lines
      const candidates = [];

      // Line above
      if (i > 0) {
        candidates.push(lines[i - 1]);
      }

      // Line below
      if (i < lines.length - 1) {
        candidates.push(lines[i + 1]);
      }

      // Line with Subject: / Paper: / Course:
      for (const line of lines) {
        if (/^(subject|paper|course)[:=\s]/i.test(line)) {
          candidates.push(line.replace(/^(subject|paper|course)[:=\s]*/i, ""));
        }
      }

      // Score candidates
      for (const candidate of candidates) {
        if (isValidCourseName(candidate)) {
          return candidate.replace(/[,.;!?]+$/, "").trim();
        }
      }
    }
  }

  return null;
}

/**
 * Validate if a string is a reasonable course name
 */
function isValidCourseName(name) {
  if (!name || name.length < 3 || name.length > 120) {
    return false;
  }

  // Count letters
  const letters = (name.match(/[a-zA-Z]/g) || []).length;
  const ratio = letters / name.length;

  return ratio >= 0.5; // At least 50% letters
}

/**
 * Extract exam type via keyword detection
 *
 * Returns one of: main | supplementary | model | improvement | end-semester |
 * midsemester | make-up | re-exam | save-a-year
 *
 * Priority order (most specific first):
 */
function extractExamType(text) {
  if (!text) return null;

  // Priority order: most specific first
  const patterns = [
    { type: "supplementary", regex: /\b(supplementary|supply exam|supple)\b/i },
    {
      type: "improvement",
      regex: /\b(improvement|betterment)\b/i,
    },
    {
      type: "model",
      regex: /\b(model\s*(?:question\s*)?paper|model exam|mock)\b/i,
    },
    {
      type: "end-semester",
      regex: /\b(end[- ]?semester|semester end|end sem|ese)\b/i,
    },
    {
      type: "midsemester",
      regex: /\b(mid[- ]?semester|mid[- ]?sem|mse|internal assessment)\b/i,
    },
    {
      type: "make-up",
      regex: /\b(make[- ]?up|makeup exam)\b/i,
    },
    {
      type: "re-exam",
      // The trailing `\b` of the original pattern rejected "re-examination"
      // (no word boundary between "exam" and "ination"), which is by far
      // the most common phrasing on Indian university question papers.
      // Accept optional word suffixes like "ination", "-test", "-appear".
      // Keep the leading `\b` so we don't match e.g. "pre-exam" or "core-exam".
      regex: /\bre[- ]?(exam(?:ination)?|test|appear(?:ance)?)\b/i,
    },
    {
      type: "save-a-year",
      regex: /\b(save[- ]?a[- ]?year|say exam)\b/i,
    },
    {
      type: "main",
      regex: /\b(regular|main exam|end of semester)\b/i,
    },
  ];

  // Test each pattern in order
  for (const { type, regex } of patterns) {
    if (regex.test(text)) {
      return type;
    }
  }

  // No match
  return null;
}

/**
 * Extract year (4-digit number in reasonable range)
 */
function extractYear(text) {
  const match = text.match(/\b(20\d{2}|19\d{2})\b/);
  if (match) {
    const year = parseInt(match[1], 10);
    // Reasonable range: 1990–2030
    if (year >= 1990 && year <= 2030) {
      return year.toString();
    }
  }
  return null;
}

/**
 * Extract month (Jan, Feb, ..., Dec or 01–12)
 */
function extractMonth(text) {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const lowerText = text.toLowerCase();

  for (let i = 0; i < monthNames.length; i++) {
    if (lowerText.includes(monthNames[i])) {
      return monthNames[i];
    }
  }

  // Try numeric month
  const match = text.match(/\b(0?[1-9]|1[0-2])\b/);
  if (match) {
    const month = parseInt(match[1], 10);
    return monthNames[month - 1];
  }

  return null;
}

/**
 * Validate and normalise extracted course code for slug creation
 * (called again in StepMetadata to ensure consistency)
 */
export function normaliseCourseCodeForSlug(code) {
  if (!code || typeof code !== "string") {
    return "";
  }

  return code
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, ""); // Collapse spaces and hyphens
}
