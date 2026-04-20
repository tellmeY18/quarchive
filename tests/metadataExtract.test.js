/**
 * Unit Tests for metadataExtract.js
 * 
 * Tests the OCR metadata extraction logic without needing a browser or OCR engine.
 * Run with: npm test (with Node.js test runner configured)
 */

import { extractFromOcr, normaliseCourseCodeForSlug } from '../src/lib/metadataExtract.js';

describe('metadataExtract', () => {
  describe('extractFromOcr', () => {
    it('extracts courseCode from OCR text', () => {
      const text = `
        B.Sc Computer Science
        Course Code: CS301
        Data Structures
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.courseCode).toBe('CS301');
    });

    it('normalises courseCode: spaces and hyphens', () => {
      const text = `
        Course Code: CS 301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.courseCode).toBe('CS301');
    });

    it('extracts courseCode with suffix letter', () => {
      const text = `
        ECE202A
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.courseCode).toBe('ECE202A');
    });

    it('extracts courseCode with hyphen', () => {
      const text = `
        Paper Code: BT-204
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.courseCode).toBe('BT204');
    });

    it('extracts courseName near courseCode', () => {
      const text = `
        Data Structures
        Course Code: CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.courseName).toBe('Data Structures');
    });

    it('rejects invalid courseName (too short)', () => {
      const text = `
        CS
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.courseName).not.toBe('CS');
    });

    it('detects examType: supplementary', () => {
      const text = `
        Supplementary Examination
        CS301 Data Structures
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('supplementary');
    });

    it('detects examType: model', () => {
      const text = `
        Model Question Paper
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('model');
    });

    it('detects examType: end-semester', () => {
      const text = `
        End Semester Examination
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('end-semester');
    });

    it('detects examType: midsemester', () => {
      const text = `
        Mid Semester Test
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('midsemester');
    });

    it('detects examType: make-up', () => {
      const text = `
        Make-up Exam
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('make-up');
    });

    it('detects examType: re-exam', () => {
      const text = `
        Re-Examination
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('re-exam');
    });

    it('detects examType: improvement', () => {
      const text = `
        Improvement Examination
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('improvement');
    });

    it('detects examType: save-a-year', () => {
      const text = `
        Save-A-Year Exam
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('save-a-year');
    });

    it('detects examType: main', () => {
      const text = `
        Regular Examination
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('main');
    });

    it('respects priority order: supplementary over main', () => {
      const text = `
        Supplementary Examination
        Main Exam Hall
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.examType).toBe('supplementary');
    });

    it('extracts year from OCR text', () => {
      const text = `
        Examination 2023
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.year).toBe('2023');
    });

    it('rejects year outside reasonable range', () => {
      const text = `
        Examination 1989
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.year).toBeNull();
    });

    it('extracts month from OCR text', () => {
      const text = `
        April 2023
        CS301
      `;
      const result = extractFromOcr(text);
      expect(result.suggestions.month).toBe('april');
    });

    it('handles empty text gracefully', () => {
      const result = extractFromOcr('');
      expect(result.suggestions.courseCode).toBeNull();
      expect(result.suggestions.examType).toBeNull();
    });

    it('handles null text gracefully', () => {
      const result = extractFromOcr(null);
      expect(result.suggestions.courseCode).toBeNull();
    });
  });

  describe('normaliseCourseCodeForSlug', () => {
    it('normalises: trim + uppercase + collapse spaces', () => {
      expect(normaliseCourseCodeForSlug('  cs 301  ')).toBe('CS301');
    });

    it('normalises: collapse hyphens', () => {
      expect(normaliseCourseCodeForSlug('CS-301')).toBe('CS301');
    });

    it('normalises: mixed spaces and hyphens', () => {
      expect(normaliseCourseCodeForSlug('  CS - 301  ')).toBe('CS301');
    });

    it('handles empty string', () => {
      expect(normaliseCourseCodeForSlug('')).toBe('');
    });

    it('handles null', () => {
      expect(normaliseCourseCodeForSlug(null)).toBe('');
    });
  });
});
