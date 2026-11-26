import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const bytes = path => readFileSync(new URL(`../${path}`, import.meta.url));
const exists = path => existsSync(new URL(`../${path}`, import.meta.url));
const filesIn = dir => {
  if (!exists(dir)) return null;
  const walk = (path, prefix = '') => readdirSync(new URL(`../${path}/`, import.meta.url), { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? walk(`${path}/${entry.name}`, `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`]);
  return walk(dir);
};

test('manifest icons exist and the page links its icons and scripts', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(exists(icon.src), icon.src);
  assert.ok(manifest.icons.some(i => i.purpose === 'maskable') && manifest.icons.some(i => i.sizes === '512x512'));
  for (const [, href] of read('index.html').matchAll(/(?:href|src)="\.\/([^"]+)"/g)) assert.ok(exists(href), href);
});

test('icons are unedited copies of the official Quarchive brand kit', () => {
  const assets = JSON.parse(read('brand/brand.json')).assets;
  assert.ok(assets && Object.keys(assets).length);
  assert.deepEqual(filesIn('icons').sort(), Object.keys(assets).sort());
  assert.match(read('icons/README.md'), /founder/i);
  assert.match(read('icons/favicon.svg'), /quarchive/i);
  for (const [name, hash] of Object.entries(assets)) {
    assert.equal(createHash('sha256').update(bytes(`icons/${name}`)).digest('hex'), hash, name);
  }
});

test('service worker: precaches every runtime file, versions its cache with the app and leaves /api/* on the network', () => {
  const sw = read('sw.js');
  const shell = [...sw.slice(sw.indexOf('const SHELL'), sw.indexOf('];')).matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  for (const file of shell) assert.ok(exists(file), `precached but missing: ${file}`);
  for (const [, file] of read('index.html').matchAll(/(?:href|src)="\.\/([^"]+)"/g)) assert.ok(shell.includes(file), `index.html loads ${file} but sw.js does not precache it`);

  for (const dir of ['js', 'vendor', 'icons', 'workers', 'data']) {
    const files = filesIn(dir);
    assert.ok(files, `${dir}/ directory is missing`);
    for (const file of files) {
      const needed = /\.(m?js|wasm|json|svg|png|webp|jpe?g)$/.test(file);
      if (needed && (dir !== 'vendor' || !file.includes('/'))) assert.ok(shell.includes(`${dir}/${file}`), `${dir}/${file} is not precached`);
    }
  }
  for (const icon of JSON.parse(read('manifest.json')).icons) assert.ok(shell.includes(icon.src), icon.src);
  for (const file of ['brand/tokens/tokens.css', 'brand/css/base.css', 'brand/css/components.css', 'brand/fonts/atkinson-hyperlegible-mono-latin.woff2']) assert.ok(shell.includes(file), file);
  for (const file of ['vendor/preact.module.js', 'vendor/htm.module.js', 'vendor/pdfjs/pdf.mjs', 'vendor/pdfjs/pdf.worker.mjs', 'vendor/pdf-lib/pdf-lib.mjs', 'vendor/browser-image-compression/browser-image-compression.mjs']) assert.ok(shell.includes(file), file);

  assert.equal(sw.match(/const CACHE = 'quarchive-shell-([^']+)'/)[1], read('js/config.js').match(/APP_VERSION = '([^']+)'/)[1], 'CACHE and APP_VERSION must carry the same version');
  assert.match(sw, /cache: 'reload'/);
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /url\.origin !== self\.location\.origin\) return/);
  assert.match(sw, /pathname\.startsWith\('\/api\/'\)\) return/);
  assert.match(read('js/main.js'), /startUpdates/);
  assert.match(read('js/update.js'), /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
});

test('the deploy workflow stages every runtime directory (including Pages Functions) and stamps the version', () => {
  const workflow = read('.github/workflows/deploy.yml');
  for (const item of ['index.html', 'styles.css', 'manifest.json', 'sw.js', '_headers', 'js', 'vendor', 'brand', 'icons', 'workers', 'functions', 'data']) assert.ok(workflow.includes(item), item);
  assert.match(workflow, /--project-name=quarchive/);
  assert.match(workflow, /quarchive-shell-dev/);
  assert.match(workflow, /APP_VERSION = 'dev'/);
  assert.match(workflow, /GITHUB_RUN_NUMBER/);
  assert.match(workflow, /cloudflare\/wrangler-action@v3/);
});

test('AGENTS.md lists every file in js/', () => {
  const agents = read('AGENTS.md');
  for (const file of filesIn('js')) assert.ok(agents.includes(file.split('/').pop()), `AGENTS.md does not mention js/${file}`);
});
