/**
 * Framework-free core tests for the js/ modules ported from src/.
 * Run with: node --test tests/core.test.js
 */

import test, { describe } from 'node:test'
import assert from 'node:assert/strict'

import {
  extractFromOcr,
  normaliseCourseCodeForSlug,
} from '../js/metadataExtract.js'
import {
  buildIdentifier,
  buildMetaHeaders,
  validateMetadata,
  EXAM_TYPES,
} from '../js/metadata.js'
import { parseHash, formatRoute, filtersFromRoute } from '../js/route.js'
import { loadJSON, pushFront, saveJSON, storageKey, toggle } from '../js/store.js'
import { request, apiJson } from '../js/fetch.js'
import {
  archiveCount,
  buildMetadataUrl,
  buildSearchUrl,
  buildStatsUrl,
  parseSearchResults,
  searchPapers,
} from '../js/archive.js'
import { layer1HashCheck, layer2IdentifierCheck } from '../js/dedup.js'
import {
  escapeSparqlString,
  normalizeText,
  expandQueryTokens,
  cacheKey,
  getInstitutionList,
  remoteCacheGet,
  remoteCacheSet,
  clearRemoteQueryCache,
} from '../js/wikidata.js'
import { loadAuth, login, saveAuth, validateAuth } from '../js/auth.js'
import {
  computeIdentifier,
  computeIsReady,
  computeValidationErrors,
  createBulkStore,
  normaliseBulkCourseCode,
  runBulkOcr,
  startBulkUpload,
} from '../js/bulk.js'

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
  }
}

function jsonResponse(body, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body,
  }
}

/* ------------------------------------------------------------------ *
 * OCR metadata extraction — all 26 cases from tests/metadataExtract.test.js
 * ------------------------------------------------------------------ */

describe('metadataExtract', () => {
  describe('extractFromOcr', () => {
    test('extracts courseCode from OCR text', () => {
      const text = `
        B.Sc Computer Science
        Course Code: CS301
        Data Structures
      `
      assert.equal(extractFromOcr(text).suggestions.courseCode, 'CS301')
    })

    test('normalises courseCode: spaces and hyphens', () => {
      const text = `
        Course Code: CS 301
      `
      assert.equal(extractFromOcr(text).suggestions.courseCode, 'CS301')
    })

    test('extracts courseCode with suffix letter', () => {
      assert.equal(extractFromOcr('ECE202A').suggestions.courseCode, 'ECE202A')
    })

    test('extracts courseCode with hyphen', () => {
      const text = 'Paper Code: BT-204'
      assert.equal(extractFromOcr(text).suggestions.courseCode, 'BT204')
    })

    test('extracts courseName near courseCode', () => {
      const text = `
        Data Structures
        Course Code: CS301
      `
      assert.equal(extractFromOcr(text).suggestions.courseName, 'Data Structures')
    })

    test('rejects invalid courseName (too short)', () => {
      const text = `
        CS
        CS301
      `
      assert.notEqual(extractFromOcr(text).suggestions.courseName, 'CS')
    })

    test('detects examType: supplementary', () => {
      const text = 'Supplementary Examination\nCS301 Data Structures'
      assert.equal(extractFromOcr(text).suggestions.examType, 'supplementary')
    })

    test('detects examType: model', () => {
      const text = 'Model Question Paper\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'model')
    })

    test('detects examType: end-semester', () => {
      const text = 'End Semester Examination\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'end-semester')
    })

    test('detects examType: midsemester', () => {
      const text = 'Mid Semester Test\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'midsemester')
    })

    test('detects examType: make-up', () => {
      const text = 'Make-up Exam\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'make-up')
    })

    test('detects examType: re-exam', () => {
      const text = 'Re-Examination\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 're-exam')
    })

    test('detects examType: improvement', () => {
      const text = 'Improvement Examination\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'improvement')
    })

    test('detects examType: save-a-year', () => {
      const text = 'Save-A-Year Exam\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'save-a-year')
    })

    test('detects examType: main', () => {
      const text = 'Regular Examination\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'main')
    })

    test('respects priority order: supplementary over main', () => {
      const text = 'Supplementary Examination\nMain Exam Hall\nCS301'
      assert.equal(extractFromOcr(text).suggestions.examType, 'supplementary')
    })

    test('extracts year from OCR text', () => {
      const text = 'Examination 2023\nCS301'
      assert.equal(extractFromOcr(text).suggestions.year, '2023')
    })

    test('rejects year outside reasonable range', () => {
      const text = 'Examination 1989\nCS301'
      assert.equal(extractFromOcr(text).suggestions.year, null)
    })

    test('extracts month from OCR text', () => {
      const text = 'April 2023\nCS301'
      assert.equal(extractFromOcr(text).suggestions.month, 'april')
    })

    test('handles empty text gracefully', () => {
      const result = extractFromOcr('')
      assert.equal(result.suggestions.courseCode, null)
      assert.equal(result.suggestions.examType, null)
    })

    test('handles null text gracefully', () => {
      assert.equal(extractFromOcr(null).suggestions.courseCode, null)
    })
  })

  describe('normaliseCourseCodeForSlug', () => {
    test('normalises: trim + uppercase + collapse spaces', () => {
      assert.equal(normaliseCourseCodeForSlug('  cs 301  '), 'CS301')
    })

    test('normalises: collapse hyphens', () => {
      assert.equal(normaliseCourseCodeForSlug('CS-301'), 'CS301')
    })

    test('normalises: mixed spaces and hyphens', () => {
      assert.equal(normaliseCourseCodeForSlug('  CS - 301  '), 'CS301')
    })

    test('handles empty string', () => {
      assert.equal(normaliseCourseCodeForSlug(''), '')
    })

    test('handles null', () => {
      assert.equal(normaliseCourseCodeForSlug(null), '')
    })
  })
})

/* ------------------------------------------------------------------ *
 * Metadata schema
 * ------------------------------------------------------------------ */

describe('metadata', () => {
  test('identifier formula is byte-for-byte stable', () => {
    assert.equal(
      buildIdentifier({
        wikidataQid: 'Q123',
        courseCode: 'CS 301',
        year: 2023,
        examType: 'main',
      }),
      'quarchive--Q123--cs-301--2023--main',
    )
    assert.equal(
      buildIdentifier({
        wikidataQid: 'Q7',
        courseCode: '---BT--204---',
        year: '2020',
        examType: 'supplementary',
      }),
      'quarchive--Q7--bt-204--2020--supplementary',
    )
  })

  test('metadata headers include subject, hash, sorted ocr-assist and source', () => {
    const headers = buildMetaHeaders(
      {
        institution: { label: 'IIT Delhi', qid: 'Q123' },
        program: 'BTech',
        courseName: 'Data Structures',
        courseCode: 'CS301',
        year: '2023',
        month: 'April',
        examType: 'main',
        semester: '1',
        language: 'en',
      },
      'a'.repeat(64),
      { source: 'pdf-upload', ocrAccepted: { year: true, courseCode: true } },
    )
    assert.equal(headers.subject, 'quarchive;Q123')
    assert.equal(headers.sha256, 'a'.repeat(64))
    assert.equal(headers['ocr-assist'], 'courseCode,year')
    assert.equal(headers.source, 'pdf-upload')
    assert.equal(
      headers.description,
      'BTech - Data Structures - (CS301) - April 2023 main',
    )
  })

  test('metadata headers use ocr-assist=none when nothing was accepted', () => {
    const headers = buildMetaHeaders(
      { institution: { label: 'X', qid: 'Q1' }, year: '2023' },
      'b'.repeat(64),
    )
    assert.equal(headers['ocr-assist'], 'none')
    assert.equal(headers.source, undefined)
  })

  test('validation errors match the React strings', () => {
    const result = validateMetadata(
      { year: '20xx', examType: 'nope' },
      { type: 'image/png', size: 51 * 1024 * 1024 },
    )
    assert.equal(result.valid, false)
    assert.deepEqual(result.errors, [
      'Please select a university from the autocomplete list.',
      'Year must be a 4-digit number (e.g. 2023).',
      `Exam type must be one of: ${EXAM_TYPES.join(', ')}.`,
      'Only PDF files are accepted.',
      'File size must be under 50MB. Current size: 51.0MB.',
    ])
  })
})

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

describe('routes', () => {
  test('round-trips all supported views', () => {
    for (const route of [
      { view: 'home', params: {} },
      { view: 'browse', params: {} },
      { view: 'upload', params: {} },
      { view: 'upload/bulk', params: {} },
      { view: 'about', params: {} },
      {
        view: 'paper',
        params: { id: 'quarchive--Q1--cs-301--2023--main' },
      },
    ]) {
      assert.deepEqual(parseHash(formatRoute(route)), route)
    }
  })

  test('carries query params and maps them to archive filters', () => {
    const route = parseHash(
      '#/browse?q=structures&year=2023&examType=main&university=Q1',
    )
    assert.deepEqual(filtersFromRoute(route), {
      date: '2023',
      'exam-type': 'main',
      subject: 'Q1',
    })
    assert.equal(formatRoute(route).includes('q=structures'), true)
  })

  test('malformed routes fall back to home', () => {
    assert.deepEqual(parseHash('#/not-a-view'), { view: 'home', params: {} })
    assert.deepEqual(parseHash('#/paper'), { view: 'home', params: {} })
    assert.equal(formatRoute({ view: 'paper', params: {} }), '#/')
  })
})

/* ------------------------------------------------------------------ *
 * Storage and fetch policy
 * ------------------------------------------------------------------ */

describe('storage', () => {
  test('prefixes keys and round-trips JSON', () => {
    const storage = fakeStorage()
    assert.equal(storageKey('recent'), 'quarchive:recent')
    saveJSON('recent', ['a'], { storage })
    assert.deepEqual(loadJSON('recent', [], { storage }), ['a'])
  })

  test('removes malformed JSON and returns the fallback', () => {
    const storage = fakeStorage({ 'quarchive:broken': '{oops' })
    assert.equal(loadJSON('broken', 42, { storage }), 42)
    assert.equal(storage.getItem('quarchive:broken'), null)
  })

  test('pushFront de-duplicates and caps', () => {
    const storage = fakeStorage()
    assert.deepEqual(
      pushFront('recent', 'b', { storage, limit: 2 }),
      ['b'],
    )
    assert.deepEqual(
      pushFront('recent', 'a', { storage, limit: 2 }),
      ['a', 'b'],
    )
    assert.deepEqual(
      pushFront('recent', 'b', { storage, limit: 2 }),
      ['b', 'a'],
    )
  })

  test('toggle adds then removes', () => {
    const storage = fakeStorage()
    assert.equal(toggle('tags', 'x', { storage }).active, true)
    assert.equal(toggle('tags', 'x', { storage }).active, false)
  })
})

describe('fetch policy', () => {
  test('every request is credential-free and referrer-free', async () => {
    let captured
    await request('https://archive.org/x', {
      timeoutMs: 0,
      fetchImpl: async (_url, init) => {
        captured = init
        return jsonResponse({ ok: true })
      },
    })
    assert.equal(captured.credentials, 'omit')
    assert.equal(captured.referrerPolicy, 'no-referrer')
    assert.equal(captured.method, 'GET')
    assert.ok(captured.signal instanceof AbortSignal)
  })

  test('apiJson rejects non-2xx responses', async () => {
    await assert.rejects(
      apiJson('https://archive.org/x', {
        fetchImpl: async () => jsonResponse({}, 500),
      }),
      /Request failed: 500/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * Archive.org
 * ------------------------------------------------------------------ */

describe('archive', () => {
  test('search URL always scopes to subject:quarchive', () => {
    const url = buildSearchUrl({ query: 'data', filters: { date: '2023' } })
    const parsed = new URL(url)
    assert.equal(parsed.origin + parsed.pathname, 'https://archive.org/advancedsearch.php')
    assert.equal(
      parsed.searchParams.get('q'),
      'subject:quarchive AND date:2023 AND data',
    )
    assert.equal(parsed.searchParams.get('rows'), '20')
    assert.equal(parsed.searchParams.getAll('fl[]').includes('exam-type'), true)
  })

  test('stats URL is exactly the paper-count URL', () => {
    assert.equal(
      buildStatsUrl(),
      'https://archive.org/advancedsearch.php?q=subject:quarchive&output=json&rows=0',
    )
  })

  test('item, download, thumbnail and metadata URLs are escaped', () => {
    assert.equal(buildMetadataUrl('a/b'), 'https://archive.org/metadata/a%2Fb')
  })

  test('parseSearchResults falls back to the identifier exam type', () => {
    const papers = parseSearchResults({
      response: {
        docs: [
          {
            identifier: 'quarchive--Q1--cs-301--2023--main',
            title: 'Paper',
            subject: ['quarchive', 'Q1'],
          },
        ],
      },
    })
    assert.equal(papers.length, 1)
    assert.equal(papers[0].qid, 'Q1')
    assert.equal(papers[0].examType, 'main')
  })

  test('searchPapers and archiveCount use injected fetch', async () => {
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(String(url))
      return jsonResponse({ response: { docs: [], numFound: 7 } })
    }
    const found = await searchPapers({ fetchImpl })
    assert.equal(found.totalResults, 7)
    assert.equal(calls[0].includes('&sort[]=addeddate+desc'), true)
    assert.equal(await archiveCount({ fetchImpl }), 7)
    assert.equal(calls[1], buildStatsUrl())
  })
})

/* ------------------------------------------------------------------ *
 * Dedup
 * ------------------------------------------------------------------ */

describe('dedup', () => {
  test('layer 1 skips an invalid hash', async () => {
    const result = await layer1HashCheck('short', {
      fetchImpl: async () => {
        throw new Error('should not fetch')
      },
    })
    assert.deepEqual(result, { isDuplicate: false, item: null })
  })

  test('layer 1 finds a duplicate by sha256', async () => {
    const hash = 'c'.repeat(64)
    let url
    const result = await layer1HashCheck(hash, {
      fetchImpl: async (u) => {
        url = String(u)
        return jsonResponse({
          response: { docs: [{ identifier: 'existing' }] },
        })
      },
    })
    assert.equal(result.isDuplicate, true)
    assert.equal(result.item.identifier, 'existing')
    assert.equal(
      new URL(url).searchParams.get('q').includes(`sha256:${hash}`),
      true,
    )
  })

  test('layer 2 checks the metadata endpoint', async () => {
    let url
    const result = await layer2IdentifierCheck('some-id', {
      fetchImpl: async (u) => {
        url = String(u)
        return jsonResponse({ metadata: { title: 'x' } })
      },
    })
    assert.equal(url, 'https://archive.org/metadata/some-id')
    assert.equal(result.isDuplicate, true)
  })

  test('dedup layers fail open on network errors', async () => {
    const result = await layer2IdentifierCheck('id', {
      fetchImpl: async () => {
        throw new Error('offline')
      },
    })
    assert.deepEqual(result, { isDuplicate: false, item: null })
  })
})

/* ------------------------------------------------------------------ *
 * Wikidata helpers and caches
 * ------------------------------------------------------------------ */

describe('wikidata', () => {
  test('escapes SPARQL literals and normalises text', () => {
    assert.equal(escapeSparqlString('a"b\\c\nd'), 'a\\"b\\\\c\\nd')
    assert.equal(normalizeText('  École   &  Tech!  '), 'ecole and tech')
  })

  test('expands institution abbreviations', () => {
    const tokens = expandQueryTokens('IIT')
    for (const token of ['iit', 'indian', 'institute', 'technology']) {
      assert.equal(tokens.includes(token), true)
    }
  })

  test('state-scoped cache keys are separate', () => {
    assert.match(cacheKey(null), /^quarchive_institutions_.*_all$/)
    assert.match(cacheKey('Q123'), /^quarchive_institutions_.*_state_Q123$/)
  })

  test('getInstitutionList reads a fresh warm-start cache, bootstraps when cold', async () => {
    const storage = fakeStorage()
    const items = [{ qid: 'Q1', label: 'Test University' }]
    saveJSON(cacheKey(null), { data: items, timestamp: 1000 }, { storage })
    assert.deepEqual(
      await getInstitutionList(null, { storage, now: () => 1500 }),
      items,
    )
    const emptySparql = { results: { bindings: [] } }
    const fetchImpl = async () => new Response(JSON.stringify(emptySparql), { status: 200, headers: { 'content-type': 'application/sparql-results+json' } })
    assert.deepEqual(
      await getInstitutionList(null, {
        storage,
        now: () => 8 * 24 * 60 * 60 * 1000 + 1000,
        fetchImpl,
      }),
      [],
    )
  })

  test('remote query cache is LRU-capped', () => {
    clearRemoteQueryCache()
    remoteCacheSet('first', null, ['a'])
    assert.deepEqual(remoteCacheGet('FIRST', null), ['a'])
    for (let i = 0; i < 64; i++) remoteCacheSet(`term${i}`, null, [i])
    assert.equal(remoteCacheGet('first', null), null)
  })
})

/* ------------------------------------------------------------------ *
 * Auth
 * ------------------------------------------------------------------ */

describe('auth', () => {
  test('saveAuth stores credentials only in the chosen storage', () => {
    const session = fakeStorage()
    const local = fakeStorage()
    const user = {
      screenname: 'user',
      email: 'user@example.org',
      accessKey: 'AK',
      secretKey: 'SK',
    }
    assert.equal(saveAuth(user, false, { storage: session }), true)
    assert.equal(session.getItem('quarchive:access_key'), 'AK')
    assert.equal(local.getItem('quarchive:access_key'), null)
    assert.equal(
      loadAuth({ session, local }).accessKey,
      'AK',
    )
  })

  test('login persists keys on success', async () => {
    const storage = fakeStorage()
    const result = await login(
      { email: 'u@example.org', password: 'pw' },
      {
        storage,
        fetchImpl: async () =>
          jsonResponse({
            ok: true,
            screenname: 'u',
            email: 'u@example.org',
            accessKey: 'AK',
            secretKey: 'SK',
          }),
      },
    )
    assert.equal(result.success, true)
    assert.equal(result.user.accessKey, 'AK')
    assert.equal(storage.getItem('quarchive:secret_key'), 'SK')
  })

  test('login maps invalid credentials to the house error', async () => {
    const result = await login(
      { email: 'u@example.org', password: 'bad' },
      {
        storage: fakeStorage(),
        fetchImpl: async () =>
          jsonResponse({ ok: false, error: 'Invalid credentials' }),
      },
    )
    assert.deepEqual(result, {
      success: false,
      error: 'Incorrect email or password',
    })
  })

  test('validateAuth sends LOW auth and returns false on failures', async () => {
    let init
    const ok = await validateAuth(
      { accessKey: 'AK', secretKey: 'SK' },
      {
        fetchImpl: async (_url, options) => {
          init = options
          return jsonResponse({ ok: true })
        },
      },
    )
    assert.equal(ok, true)
    assert.equal(init.headers.Authorization, 'LOW AK:SK')
    assert.equal(
      await validateAuth(
        { accessKey: 'AK', secretKey: 'SK' },
        { fetchImpl: async () => jsonResponse({}, 401) },
      ),
      false,
    )
  })
})

/* ------------------------------------------------------------------ *
 * Bulk
 * ------------------------------------------------------------------ */

function addReadyFile(store, name, metadata, overrides = {}) {
  const file = {
    name,
    size: 4,
    type: 'application/pdf',
    ...overrides,
  }
  store.addFiles([file])
  const record = store.getState().files.at(-1)
  store.setInstitutionAndRevalidate({ label: 'IIT Delhi', qid: 'Q123' })
  for (const [field, value] of Object.entries(metadata)) {
    store.setFileMetadata(record.id, field, value)
  }
  return store.getState().files.at(-1)
}

describe('bulk state', () => {
  test('normalises course codes for a byte-identical slug', () => {
    assert.equal(normaliseBulkCourseCode('  cs - 301 '), 'CS301')
    assert.equal(normaliseBulkCourseCode(null), '')
    assert.equal(
      computeIdentifier(
        { courseCode: 'CS-301', year: '2023', examType: 'main' },
        { qid: 'Q123' },
      ),
      'quarchive--Q123--cs301--2023--main',
    )
  })

  test('readiness and validation agree', () => {
    const metadata = { courseCode: 'CS301', year: '2023', examType: 'main' }
    assert.equal(computeIsReady(metadata, { qid: 'Q1' }, () => 2026), true)
    assert.deepEqual(
      computeValidationErrors(
        { courseCode: '', year: '1979', examType: 'x' },
        () => 2026,
      ),
      {
        courseCode: 'Required',
        year: 'Must be 1980-2027',
        examType: 'Required',
      },
    )
  })

  test('addFiles filters non-PDF/oversized files and respects the hard limit', () => {
    const store = createBulkStore()
    const result = store.addFiles([
      { name: 'a.pdf', type: 'application/pdf', size: 10 },
      { name: 'b.pdf', type: 'application/pdf', size: 10 },
      { name: 'bad.txt', type: 'text/plain', size: 10 },
      { name: 'big.pdf', type: 'application/pdf', size: 51 * 1024 * 1024 },
      { name: 'a.pdf', type: 'application/pdf', size: 10 },
    ])
    assert.equal(result.added, 2)
    assert.equal(store.getState().files.length, 2)
  })

  test('updating metadata recomputes readiness, identifier and errors', () => {
    const store = createBulkStore()
    const record = addReadyFile(store, 'paper.pdf', {
      courseCode: 'CS301',
      year: '2023',
      examType: 'main',
    })
    assert.equal(record.isReady, true)
    assert.equal(record.identifier, 'quarchive--Q123--cs301--2023--main')
    assert.deepEqual(record.validationErrors, {})
  })

  test('accepting an OCR field normalises the course code', () => {
    const store = createBulkStore()
    const record = addReadyFile(store, 'paper.pdf', {})
    store.acceptOcrField(record.id, 'courseCode', '  bt - 204 ')
    const updated = store.getState().files[0]
    assert.equal(updated.metadata.courseCode, 'BT204')
    assert.equal(updated.ocrAccepted.courseCode, true)
  })
})

describe('bulk OCR', () => {
  test('runs strictly serially over idle files with an 8s first-page budget', async () => {
    const store = createBulkStore()
    addReadyFile(store, 'a.pdf', {})
    addReadyFile(store, 'b.pdf', {})
    const calls = []
    await runBulkOcr({
      store,
      init: async () => calls.push('init'),
      ocr: async (file, options) => {
        calls.push(file.name)
        assert.equal(options.maxPages, 1)
        assert.equal(options.timeout, 8000)
        return { text: 'Course Code: CS301' }
      },
      schedule: (fn) => fn(),
    })
    assert.deepEqual(calls, ['init', 'a.pdf', 'b.pdf'])
    assert.deepEqual(
      store.getState().files.map((f) => f.ocrStatus),
      ['done', 'done'],
    )
    assert.equal(store.getState().files[0].ocrSuggestions.courseCode, 'CS301')
  })

  test('OCR failures are silent and mark the file skipped', async () => {
    const store = createBulkStore()
    addReadyFile(store, 'a.pdf', {})
    await runBulkOcr({
      store,
      init: async () => {},
      ocr: async () => {
        throw new Error('OCR timeout')
      },
      schedule: (fn) => fn(),
    })
    assert.equal(store.getState().files[0].ocrStatus, 'skipped')
  })
})

describe('bulk upload', () => {
  const noSleep = async () => {}

  function uploadDeps(overrides = {}) {
    return {
      hash: async () => 'd'.repeat(64),
      dedupCheck: async () => ({ isDuplicate: false }),
      headers: () => ({ subject: 'quarchive;Q123' }),
      sleepImpl: noSleep,
      retryDelays: [0, 0],
      timeoutMs: 0,
      ...overrides,
    }
  }

  test('uploads every ready file and records the archive URL', async () => {
    const store = createBulkStore()
    addReadyFile(store, 'a.pdf', {
      courseCode: 'CS301',
      year: '2023',
      examType: 'main',
    })
    let calls = 0
    const result = await startBulkUpload({
      store,
      auth: { accessKey: 'AK', secretKey: 'SK' },
      fetchImpl: async () => {
        calls++
        return jsonResponse({ ok: true })
      },
      ...uploadDeps(),
    })
    assert.deepEqual(result, { uploaded: 1, skipped: 0, failed: 0, aborted: false })
    assert.equal(calls, 1)
    const file = store.getState().files[0]
    assert.equal(file.uploadStatus, 'done')
    assert.equal(file.uploadProgress, 1)
    assert.equal(
      file.archiveUrl,
      'https://archive.org/details/quarchive--Q123--cs301--2023--main',
    )
    assert.equal(store.getState().isUploading, false)
  })

  test('retries a rejected PUT with backoff', async () => {
    const store = createBulkStore()
    addReadyFile(store, 'a.pdf', {
      courseCode: 'CS301',
      year: '2023',
      examType: 'main',
    })
    let calls = 0
    await startBulkUpload({
      store,
      fetchImpl: async () => {
        calls++
        return calls === 1 ? jsonResponse({}, 500) : jsonResponse({ ok: true })
      },
      ...uploadDeps(),
    })
    assert.equal(calls, 2)
    assert.equal(store.getState().files[0].retryCount, 1)
    assert.equal(store.getState().files[0].uploadStatus, 'done')
  })

  test('skips identical hashes inside one batch', async () => {
    const store = createBulkStore()
    const meta = { courseCode: 'CS301', year: '2023', examType: 'main' }
    addReadyFile(store, 'a.pdf', meta)
    addReadyFile(store, 'b.pdf', { ...meta, courseCode: 'CS302' })
    let calls = 0
    await startBulkUpload({
      store,
      concurrency: 1,
      fetchImpl: async () => {
        calls++
        return jsonResponse({ ok: true })
      },
      ...uploadDeps(),
    })
    assert.equal(calls, 1)
    const statuses = store.getState().files.map((f) => f.uploadStatus)
    assert.deepEqual(statuses, ['done', 'skipped'])
    assert.equal(store.getState().files[1].duplicateUrl, 'duplicate-in-batch')
  })

  test('a 401 aborts the whole batch with session_expired', async () => {
    const store = createBulkStore()
    const meta = { courseCode: 'CS301', year: '2023', examType: 'main' }
    addReadyFile(store, 'a.pdf', meta)
    addReadyFile(store, 'b.pdf', { ...meta, courseCode: 'CS302' })
    let calls = 0
    const result = await startBulkUpload({
      store,
      concurrency: 1,
      fetchImpl: async () => {
        calls++
        return jsonResponse({}, 401)
      },
      ...uploadDeps(),
    })
    assert.equal(calls, 1)
    assert.equal(result.aborted, true)
    assert.deepEqual(
      store.getState().files.map((f) => f.uploadError),
      ['session_expired', 'session_expired'],
    )
  })

  test('rate-limit responses retry and report the house error on exhaustion', async () => {
    const store = createBulkStore()
    addReadyFile(store, 'a.pdf', {
      courseCode: 'CS301',
      year: '2023',
      examType: 'main',
    })
    const waits = []
    await startBulkUpload({
      store,
      fetchImpl: async () =>
        jsonResponse({}, 429, { 'Retry-After': '2' }),
      ...uploadDeps({
        sleepImpl: async (ms) => waits.push(ms),
        retryDelays: [10, 20],
      }),
    })
    const file = store.getState().files[0]
    assert.equal(file.uploadStatus, 'failed')
    assert.equal(file.uploadError, 'rate_limited (HTTP 429)')
    assert.ok(waits.includes(2000))
  })
})
