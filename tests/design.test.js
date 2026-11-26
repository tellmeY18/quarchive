import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ALLOWED_HOSTS = new Set(['archive.org', 'brand.letsimpl.fyi', 'github.com', 'letsimpl.fyi', 'mozilla.github.io', 'pdf-lib.js.org', 'query.wikidata.org', 'quarchive.letsimpl.fyi', 'www.gnu.org', 'www.w3.org']);
const hostAllowed = host => ALLOWED_HOSTS.has(host) || /\.archive\.org$/.test(host);
const jsFiles = readdirSync(new URL('../js/', import.meta.url), { withFileTypes: true })
  .flatMap(entry => entry.isDirectory()
    ? readdirSync(new URL(`../js/${entry.name}/`, import.meta.url)).map(f => `js/${entry.name}/${f}`)
    : [`js/${entry.name}`]);

test('branding is the vendored letsimpl.fyi brand, loaded before the app styles', () => {
  assert.equal(JSON.parse(read('brand/brand.json')).source, 'https://brand.letsimpl.fyi');
  const html = read('index.html');
  const order = ['brand/tokens/tokens.css', 'brand/css/base.css', 'brand/css/components.css', 'styles.css'].map(f => html.indexOf(f));
  assert.ok(order.every(i => i > 0) && [...order].sort((a, b) => a - b).join() === order.join(), 'load order');
  assert.ok(html.indexOf('./js/theme.js') > 0 && html.indexOf('./js/theme.js') < order[0], 'theme runs before first paint');
  assert.match(html, /<link rel="preload" as="font" type="font\/woff2" crossorigin href="\.\/brand\/fonts\/atkinson-hyperlegible-mono-latin\.woff2">/);
  assert.match(html, /<script type="module" src="\.\/js\/main\.js"><\/script>/);
});

test('app styles follow the brand rules: layout only, no colours, shadows, gradients, rounded corners or fonts of their own', () => {
  const css = read('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.deepEqual(css.match(/#[\da-fA-F]{3,8}\b/g) || [], [], 'no hex colours');
  assert.ok(!/box-shadow|drop-shadow|text-shadow/.test(css), 'no shadows');
  assert.ok(!/(linear|radial|conic)-gradient/.test(css), 'no gradients');
  assert.ok(!/border-radius:\s*[1-9]/.test(css), 'square corners');
  assert.ok(!/@font-face|font-family:(?!\s*var\()/.test(css), 'fonts come from the brand');
  assert.ok(!/font-size:\s*(\d|1[0-3])px/.test(css), 'no tiny fixed font sizes');
  for (const selector of ['.page', '.app-header', '.header-inner', '.brand', '.foot', '.toast-wrap', '.paper-grid', '.bottom-nav', '.pdf-viewer']) assert.ok(css.includes(selector), selector);
});

test('no hex colours in the scripts', () => {
  for (const file of jsFiles) assert.deepEqual(read(file).match(/#[\da-fA-F]{6}\b/g) || [], [], file);
});

test('no inline scripts, styles or event handlers; the CSP allows only the hosts the app uses', () => {
  const html = read('index.html');
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>[^<]/.test(html), 'no inline script');
  assert.ok(!/<style[\s>]/.test(html) && !/\sstyle="/.test(html) && !/\son[a-z]+="/.test(html));
  const headers = read('_headers');
  const csp = headers.match(/Content-Security-Policy: (.*)/)[1];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /style-src 'self'(;|$)/);
  assert.match(csp, /connect-src 'self' https:\/\/archive\.org https:\/\/query\.wikidata\.org(;|$)/);
  assert.match(csp, /img-src 'self' blob: https:\/\/archive\.org https:\/\/\*\.archive\.org(;|$)/);
  assert.match(csp, /worker-src 'self' blob:(;|$)/);
  assert.match(headers, /Permissions-Policy: .*geolocation=\(self\)/);
  assert.ok(!/unsafe-/.test(csp), 'no unsafe CSP directives');
  assert.ok(!/unpkg|cdnjs|jsdelivr|googleapis/.test(csp), 'no CDN');
  for (const file of jsFiles) assert.ok(!/\.style\.|innerHTML|insertAdjacentHTML|\bstyle:/.test(read(file)), `${file} sets styles or HTML directly`);
});

test('the page ships an empty app root; main mounts into it and announces updates', () => {
  assert.match(read('index.html'), /<div id="app"><\/div>/);
  assert.match(read('js/main.js'), /replaceChildren\(\)/);
  assert.match(read('js/main.js'), /new Event\('quarchive-update'\)/);
  assert.match(read('js/update.js'), /register\('\.\/sw\.js', \{ updateViaCache: 'none' \}\)/);
});

test('the only hosts the app talks to are Archive.org, Wikidata, its own site and its own links', () => {
  for (const file of ['index.html', 'styles.css', 'manifest.json', ...jsFiles]) {
    for (const [, host] of read(file).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) assert.ok(hostAllowed(host), `${file} mentions ${host}`);
  }
});

test('every browser fetch is anonymous and does not leak a referrer', () => {
  for (const file of jsFiles) {
    const source = read(file);
    if (/fetch\s*\(/.test(source)) {
      assert.match(source, /credentials: 'omit'/, `${file} sends credentials`);
      assert.match(source, /referrerPolicy: 'no-referrer'/, `${file} leaks a referrer`);
    }
  }
});

test('storage keys use the quarchive prefix and updates restart the page safely', () => {
  for (const file of ['js/theme.js', 'js/update.js']) assert.match(read(file), /quarchive:/, file);
  assert.match(read('sw.js'), /const CACHE = 'quarchive-shell-dev'/);
});
