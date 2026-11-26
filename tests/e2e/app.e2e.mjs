// Drives the real app in Chromium under the production CSP. Archive.org,
// Wikidata and the Pages Functions are faked with page.route(); any other
// request that leaves the machine fails the run.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const CSP = (await readFile(join(root, '_headers'), 'utf8')).match(/Content-Security-Policy: (.*)/)[1];
const types = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.gz': 'application/gzip',
  '.map': 'application/json', '.txt': 'text/plain', '.md': 'text/plain',
};

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = path === '/' ? '/index.html' : path;
  try {
    const body = await readFile(join(root, normalize(file)));
    res.writeHead(200, {
      'content-type': types[extname(file)] || 'application/octet-stream',
      'content-security-policy': CSP,
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] });
test.after(async () => {
  await browser.close();
  server.close();
});

const ID = 'quarchive--Q874586--cs301--2023--main';
const PDF = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> >> endobj
trailer << /Root 1 0 R >>
%%EOF`;
const DOCS = [
  {
    identifier: ID,
    title: 'CS301 Question Paper',
    creator: 'University of Kerala',
    date: '2023',
    subject: ['quarchive', 'Q874586'],
    description: 'End semester question paper',
    language: 'en',
    'exam-type': 'main',
  },
];

function sparqlResult() {
  return {
    results: {
      bindings: [{
        item: { value: 'http://www.wikidata.org/entity/Q874586' },
        itemLabel: { value: 'University of Kerala' },
        itemDescription: { value: 'university in Kerala, India' },
        itemAltLabel: { value: 'Kerala University' },
        locLabel: { value: 'Thiruvananthapuram' },
      }],
    },
  };
}

async function open(hash = '#/', { viewport = { width: 390, height: 780 }, storage = {}, failArchive = false, failWikidata = false, init } = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  if (init) await context.addInitScript(init);
  await context.addInitScript((entries) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);

  const page = await context.newPage();
  const outside = [], violations = [], archive = [], wikidata = [], api = [], uploads = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === base) {
      if (url.pathname === '/api/login') {
        api.push(url.pathname);
        return route.fulfill({ json: { ok: true, screenname: 'test_student', email: 'test@example.com', accessKey: 'mock-access', secretKey: 'mock-secret' } });
      }
      if (url.pathname === '/api/s3keys') {
        api.push(url.pathname);
        return route.fulfill({ json: { ok: true, accessKey: 'mock-access', secretKey: 'mock-secret' } });
      }
      if (url.pathname === '/api/validate') {
        api.push(url.pathname);
        return route.fulfill({ json: { ok: true } });
      }
      if (url.pathname === '/api/upload') {
        api.push(url.pathname);
        uploads.push(request.postData() || '');
        return route.fulfill({ json: { ok: true, identifier: ID } });
      }
      if (url.pathname === '/api/pdf') {
        api.push(url.pathname);
        return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });
      }
      // OCR is an optional aid; fail its lazy vendor load quickly so wizard
      // tests exercise the manual metadata path without waiting for a scan.
      if (url.pathname.startsWith('/vendor/scribe/')) return route.abort();
      return route.continue();
    }

    if (url.origin === 'https://archive.org') {
      archive.push(url.pathname + url.search);
      if (failArchive) return route.abort();
      if (url.pathname === '/advancedsearch.php') {
        const rows = url.searchParams.get('rows');
        const query = url.searchParams.get('q') || '';
        const isDedupLookup = query.includes('sha256:');
        const docs = isDedupLookup || rows === '0' ? [] : DOCS;
        return route.fulfill({ json: { response: { numFound: rows === '0' ? DOCS.length : docs.length, docs } } });
      }
      if (url.pathname.startsWith('/metadata/')) {
        if (decodeURIComponent(url.pathname.slice('/metadata/'.length)) !== ID) {
          return route.fulfill({ status: 404, json: { error: 'not found' } });
        }
        return route.fulfill({ json: {
          metadata: {
            identifier: ID,
            title: 'CS301 Question Paper',
            creator: 'University of Kerala',
            date: '2023',
            description: 'End semester question paper',
            language: 'en',
            'exam-type': 'main',
          },
          files: [{ name: 'cs301.pdf', format: 'Text PDF' }],
        } });
      }
      if (url.pathname.startsWith('/services/img/')) {
        return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"/>' });
      }
      if (url.pathname.startsWith('/download/')) {
        return route.fulfill({ status: 200, contentType: 'application/pdf', body: PDF });
      }
      outside.push(url.href);
      return route.abort();
    }

    if (url.origin === 'https://query.wikidata.org') {
      wikidata.push(url.pathname + url.search);
      if (failWikidata) return route.abort();
      return route.fulfill({ json: sparqlResult() });
    }

    outside.push(url.href);
    return route.abort();
  });

  await page.goto(base + '/' + hash);
  return { page, context, outside, violations, archive, wikidata, api, uploads };
}

const authStorage = {
  'quarchive:access_key': 'mock-access',
  'quarchive:secret_key': 'mock-secret',
  'quarchive:screenname': 'test_student',
  'quarchive:email': 'test@example.com',
};

const pdfFile = (name, tag) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.from(`${PDF}\n% ${tag}\n`),
});

test('home: search, filters and cards work with no third-party requests or CSP violations', async () => {
  const { page, context, outside, violations, archive } = await open();
  await page.getByRole('heading', { name: /Discover Previous Year Question Papers/i }).waitFor();
  const box = page.getByLabel('Search papers');
  await box.fill('CS301');
  await page.getByRole('button', { name: `Open CS301 Question Paper` }).waitFor();
  await page.getByText('University of Kerala').first().waitFor();
  await page.getByRole('button', { name: '2023', exact: true }).click();
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((r) => r.name.includes('date%3A2023')));
  assert.ok(archive.some((url) => url.includes('subject%3Aquarchive')));
  assert.deepEqual(outside, []);
  assert.deepEqual(violations, []);
  await context.close();
});

test('home: network failure shows a retry instead of an empty page', async () => {
  const { page, context } = await open('#/', { failArchive: true });
  await page.getByRole('button', { name: 'Retry' }).first().waitFor();
  assert.match(await page.locator('main').innerText(), /Search failed/);
  await context.close();
});

test('paper: metadata, links and a proxied PDF preview render from the archive', async () => {
  const { page, context, outside, violations, api } = await open(`#/paper/${ID}`);
  await page.getByRole('heading', { name: 'End semester question paper' }).waitFor();
  assert.match(await page.getByRole('link', { name: /Download PDF/ }).getAttribute('href'), /^https:\/\/archive\.org\/download\//);
  await page.getByRole('link', { name: /View on Archive.org/ }).waitFor();
  await page.getByText('Page 1 of 1').waitFor();
  await page.locator('canvas.pdf-canvas').waitFor();
  assert.ok(api.includes('/api/pdf'));
  assert.deepEqual(outside, []);
  assert.deepEqual(violations, []);
  await context.close();
});

test('paper: an unknown identifier says so rather than hanging', async () => {
  const { page, context } = await open('#/paper/does-not-exist');
  await page.getByRole('heading', { name: 'Paper not found' }).waitFor();
  await context.close();
});

test('theme toggles and persists; the app fits 320px and survives a junk route/storage', async () => {
  const { page, context, violations } = await open('#/nope', {
    viewport: { width: 320, height: 640 },
    storage: { 'quarchive:access_key': '"junk"' },
  });
  await page.getByRole('main').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.getByRole('button', { name: /theme/i }).click();
  assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), before);
  assert.deepEqual(violations, []);
  await context.close();
});

test('auth: the sign-in sheet posts only to /api/login and unlocks upload', async () => {
  const { page, context, outside, violations, api } = await open('#/upload', {
    viewport: { width: 1200, height: 800 },
  });
  await page.getByText('Sign in to continue').waitFor();
  await page.getByRole('button', { name: 'Sign In' }).click();
  const sheet = page.getByRole('dialog', { name: 'Sign in' });
  await sheet.getByLabel('Email').fill('test@example.com');
  await sheet.getByLabel('Password').fill('archive-password');
  await sheet.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('button', { name: /Scan with Camera/ }).waitFor();
  assert.ok(api.includes('/api/login'));
  assert.deepEqual(outside, []);
  assert.deepEqual(violations, []);
  await context.close();
});

test('upload: a PDF goes through dedup and the proxied upload without leaving the app', async () => {
  const { page, context, outside, violations, uploads } = await open('#/upload', {
    viewport: { width: 1200, height: 800 },
    storage: authStorage,
  });
  await page.getByRole('button', { name: 'Upload existing PDF' }).click();
  await page.locator('#meta-file').setInputFiles(pdfFile('paper.pdf', 'single'));
  await page.getByText('paper.pdf').waitFor();
  await page.getByLabel(/Course Code/).fill('CS301');
  await page.getByRole('radio', { name: 'Main' }).check();
  await page.getByRole('button', { name: 'Check for Duplicates' }).click();
  await page.getByText('This paper is new. Ready to upload.').waitFor();
  await page.getByRole('button', { name: 'Upload Paper' }).click();
  await page.getByText('Paper archived successfully!').waitFor();
  assert.equal(uploads.length, 1);
  assert.match(uploads[0], /name="identifier"/);
  assert.match(uploads[0], /quarchive--Q6973731--cs301--/);
  assert.deepEqual(outside, []);
  assert.deepEqual(violations, []);
  await context.close();
});

test('bulk: two PDFs are validated, prepared and uploaded through the same proxy', async () => {
  const { page, context, outside, violations, uploads } = await open('#/upload/bulk', {
    viewport: { width: 1200, height: 800 },
    storage: authStorage,
  });
  await page.getByRole('heading', { name: 'Bulk Upload' }).waitFor();
  await page.getByLabel('Select PDF files').setInputFiles([
    pdfFile('one.pdf', 'one'),
    pdfFile('two.pdf', 'two'),
  ]);
  await page.getByText('2 files selected').waitFor();
  await page.locator('#bulk-institution').fill('University of Kerala');
  await page.getByRole('button', { name: /University of Kerala/ }).first().waitFor();
  await page.getByRole('button', { name: /University of Kerala/ }).first().click();

  const rows = page.locator('main article');
  assert.equal(await rows.count(), 2);
  for (const [index, row] of (await rows.all()).entries()) {
    await row.getByLabel('Course Code *').fill(`CS40${index + 1}`);
    await row.getByLabel('Year *').selectOption('2023');
    await row.getByRole('radio', { name: 'Main' }).check();
  }
  await page.getByRole('button', { name: /Upload 2 Ready files/ }).waitFor();
  await page.getByRole('button', { name: /Upload 2 Ready files/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('main article .ls-chip')]
    .filter((chip) => chip.textContent.includes('Done')).length === 2);
  assert.equal(uploads.length, 2);
  assert.deepEqual(outside, []);
  assert.deepEqual(violations, []);
  await context.close();
});

test('camera: a denied camera offers a PDF fallback instead of a dead end', async () => {
  const { page, context, outside, violations } = await open('#/upload', {
    storage: authStorage,
    init: () => {
      const deny = () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
      if (navigator.mediaDevices) {
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: deny });
      } else {
        Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: deny } });
      }
    },
  });
  await page.getByRole('heading', { name: 'Camera Permission Denied' }).waitFor();
  await page.getByRole('button', { name: 'Upload PDF instead' }).click();
  await page.getByRole('button', { name: 'Upload existing PDF' }).waitFor();
  assert.deepEqual(outside, []);
  assert.deepEqual(violations, []);
  await context.close();
});
