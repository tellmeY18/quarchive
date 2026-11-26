// quarchive service worker: a versioned app-shell cache and a safe update path. Same design as Commoner's.
// CACHE and APP_VERSION (js/config.js) carry the same version; the deploy workflow stamps both on every
// release, so each deploy has its own cache and cached files can never be mixed across versions.
// Install is atomic: one missing file fails the whole install rather than half-caching a release.
// Papers and Wikidata lookups are cross-origin and never intercepted; /api/* functions stay on the network.
// The OCR library under vendor/scribe/ is large and loaded only when someone asks for OCR: it stays on the
// network (same-origin, HTTP-cacheable) instead of bloating this atomic install.
const CACHE = 'quarchive-shell-dev';
const SHELL = [
  './', './styles.css', './manifest.json',
  './js/config.js', './js/theme.js', './js/update.js', './js/icons.js', './js/route.js', './js/ui.js', './js/main.js',
  './js/views/home.js', './js/views/browse.js', './js/views/paper.js', './js/views/upload.js', './js/views/camera.js', './js/views/bulk.js', './js/views/about.js', './js/views/auth.js',
  './js/archive.js', './js/auth.js', './js/bulk.js', './js/capture.js', './js/components.js', './js/constants.js', './js/dedup.js',
  './js/fetch.js', './js/geolocation.js', './js/imageToPdf.js', './js/indianStates.js', './js/metadataExtract.js', './js/metadata.js',
  './js/ocr.js', './js/pdfViewer.js', './js/qr.js', './js/store.js', './js/support.js', './js/upload.js', './js/upi.js', './js/wikidata.js',
  './workers/hashWorker.js', './workers/ocrWorker.js',
  './brand/tokens/tokens.css', './brand/css/base.css', './brand/css/components.css',
  './brand/fonts/atkinson-hyperlegible-mono-latin.woff2', './brand/fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2',
  './brand/fonts/courier-prime-400-latin.woff2', './brand/fonts/courier-prime-700-latin.woff2', './brand/fonts/noto-serif-malayalam.woff2',
  './vendor/preact.module.js', './vendor/htm.module.js', './vendor/pdf-lib/pdf-lib.mjs',
  './vendor/browser-image-compression/browser-image-compression.mjs', './vendor/pdfjs/pdf.mjs', './vendor/pdfjs/pdf.worker.mjs',
  './vendor/qrcode.js',
  './icons/logo-primary.svg', './icons/logo-primary-inverse.svg', './icons/logo-mark.svg', './icons/logo-mark-inverse.svg',
  './icons/logo-mono.svg', './icons/logo-mono-inverse.svg', './icons/favicon.svg', './icons/app-icon.svg',
  './icons/app-icon-192.png', './icons/app-icon-512.png', './icons/apple-touch-icon-180.png', './icons/app-icon-maskable.svg',
  './icons/app-icon-maskable-512.png', './icons/splash.svg', './icons/splash-1080x1920.png', './icons/loading.svg',
  './icons/loading-1080x1920.png', './icons/og-image.svg', './icons/og-image.png', './icons/github-social.svg',
  './icons/github-social.png', './icons/avatar-400.png',
];

self.addEventListener('install', event => {
  // cache: 'reload' skips the browser's HTTP cache, so a fresh file is never mixed with older ones (Safari can do that).
  // skipWaiting: a broken page cannot ask for the update, so the new worker takes over at once; the page itself
  // then restarts into the new version at the next safe moment (js/update.js).
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(SHELL.map(path => new Request(path, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('quarchive-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return; // papers and Wikidata stay on the network
  if (url.pathname.startsWith('/api/')) return; // Pages Functions carry their own auth and upload traffic
  if (event.request.mode === 'navigate') {
    // Cache "./" (not index.html): Pages redirects /index.html -> /, and a cached redirect cannot answer a navigation.
    event.respondWith(caches.open(CACHE).then(cache => cache.match('./')).then(cached => cached || fetch(event.request)));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(event.request, { ignoreSearch: true })) || fetch(event.request, { cache: 'no-cache' })));
});
