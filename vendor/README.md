# `vendor/` — prebuilt, same-origin ESM

No npm dependencies at runtime and no build step. Every import and asset URL
below is relative or same-origin. There are no CDN URLs in the vendored code.
Do not run `npm install` to use these files; `node_modules/` must never live in
this directory.

## Inventory

| Path | Exact version | Source tarball | What was vendored |
| --- | --- | --- | --- |
| `preact.module.js`, `preact.LICENSE` | preact **10.26.4** | `https://registry.npmjs.org/preact/-/preact-10.26.4.tgz` | `dist/preact.module.js` + `LICENSE`, copied byte-for-byte from `~/letsimplfyi/readrfc/vendor/` (SHA-256 of the JS: `2ce1b7b810fc14cda3f4242e636311b5a5e6d5a6cb1f3274fe948fe3bba3d32e`). |
| `htm.module.js`, `htm.LICENSE` | htm **3.x** (byte-identical in 3.0.1–3.1.1; readrfc does not record which one) | `https://registry.npmjs.org/htm/-/htm-3.1.1.tgz` | `dist/htm.module.js` + `LICENSE`, copied byte-for-byte from `~/letsimplfyi/readrfc/vendor/` (SHA-256 of the JS: `ab33dd3f38059b9be4d5f5350128eefb2356639c4e0bbe9d9e8b3ba75847e9e4`). |
| `pdfjs/pdf.mjs`, `pdfjs/pdf.worker.mjs`, `pdfjs/LICENSE` | pdfjs-dist **5.6.205** | `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-5.6.205.tgz` | Upstream minified ESM: `build/pdf.min.mjs` → `pdf.mjs`, `build/pdf.worker.min.mjs` → `pdf.worker.mjs`, plus `LICENSE`. Both files already default to the relative worker path `./pdf.worker.mjs`. |
| `pdf-lib/pdf-lib.mjs`, `pdf-lib/LICENSE` | pdf-lib **1.17.1** | `https://registry.npmjs.org/pdf-lib/-/pdf-lib-1.17.1.tgz` | Upstream `dist/pdf-lib.esm.min.js` → `pdf-lib.mjs` (browser-safe, self-contained); `LICENSE.md` → `LICENSE`. The trailing `//# sourceMappingURL=…` directive was removed because the `.map` is not vendored. |
| `browser-image-compression/browser-image-compression.mjs`, `…/LICENSE` | browser-image-compression **2.0.2** | `https://registry.npmjs.org/browser-image-compression/-/browser-image-compression-2.0.2.tgz` | Upstream `dist/browser-image-compression.mjs`, with the trailing source-map directive removed and two CSP patches (below). |
| `scribe/` | scribe.js-ocr **0.10.1** | `https://registry.npmjs.org/scribe.js-ocr/-/scribe.js-ocr-0.10.1.tgz` | `scribe.js`, `js/`, `mupdf/`, `lib/`, `tess/`, `fonts/` and `LICENSE` (the exact set from `scripts/copy-scribe-assets.mjs`), preserving upstream relative paths. |
| `scribe/tess/eng.traineddata.gz` | @tesseract.js-data/eng **1.0.0** (`4.0.0_best_int/` data) | `https://registry.npmjs.org/@tesseract.js-data/eng/-/eng-1.0.0.tgz` | Added so OCR never needs a network fallback; the scribe npm package does not ship any `.traineddata`. |

`npx esbuild@0.28.2` was **not** needed: every library above ships a prebuilt
ESM browser build, which was copied rather than regenerated. If a future
dependency has no prebuilt ESM, bundle it with esbuild into this directory and
record the exact command here.

## Local patches (strict CSP)

Upstream code was changed in three places. Reapply these after any refresh:

1. `browser-image-compression.mjs`
   - `l="boolean"!=typeof o.useWebWorker||o.useWebWorker` → `l="boolean"==typeof o.useWebWorker&&o.useWebWorker`
     (web workers are off by default: the app's `worker-src 'self'` forbids the
     upstream `blob:` worker). Callers must leave `useWebWorker` unset/false.
   - Upstream `libURL` CDN default → `new URL("./browser-image-compression.mjs",import.meta.url).href`.
2. `scribe/js/export/writeHtml.js` — exported HTML font URLs now use `./fonts/all/`
   instead of the upstream jsDelivr path.
3. `scribe/tess/worker-script/index.js` — language data now resolves to
   `new URL('../', import.meta.url).href` (i.e. same-origin `vendor/scribe/tess/`)
   instead of the upstream CDN. With the default `gzip: true`, this fetches
   `vendor/scribe/tess/eng.traineddata.gz`.

## Import paths (from files in `/js/`)

```js
import { h, render } from '../vendor/preact.module.js';
import htm from '../vendor/htm.module.js';
const html = htm.bind(h);

import * as pdfjsLib from '../vendor/pdfjs/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL('../vendor/pdfjs/pdf.worker.mjs', import.meta.url).href;

import { PDFDocument } from '../vendor/pdf-lib/pdf-lib.mjs';
import imageCompression from '../vendor/browser-image-compression/browser-image-compression.mjs';
```

From `/workers/ocrWorker.js`:

```js
const { default: scribe } = await import('../vendor/scribe/scribe.js');
```

All scribe internals (`./js/...`, `./mupdf/...`, `./tess/...`, `./fonts/...`)
are relative to that entry point. Other languages need their own
`*.traineddata.gz` in `vendor/scribe/tess/`.

## Refresh

Run from the repo root; downloads go to `/tmp/opencode/vendor-work` only.

```sh
W=/tmp/opencode/vendor-work; mkdir -p "$W"; cd "$W"
npm pack pdfjs-dist@5.6.205 pdf-lib@1.17.1 browser-image-compression@2.0.2 \
  scribe.js-ocr@0.10.1 @tesseract.js-data/eng@1.0.0
for p in *.tgz; do d=${p%.tgz}; mkdir -p "$d"; tar xzf "$p" -C "$d"; done
V=/home/satan/Documents/letsimplfyi/quarchive/vendor
cp pdfjs-dist-5.6.205/package/build/pdf.min.mjs "$V/pdfjs/pdf.mjs"
cp pdfjs-dist-5.6.205/package/build/pdf.worker.min.mjs "$V/pdfjs/pdf.worker.mjs"
cp pdfjs-dist-5.6.205/package/LICENSE "$V/pdfjs/LICENSE"
cp pdf-lib-1.17.1/package/dist/pdf-lib.esm.min.js "$V/pdf-lib/pdf-lib.mjs"
cp browser-image-compression-2.0.2/package/dist/browser-image-compression.mjs \
  "$V/browser-image-compression/browser-image-compression.mjs"
cp browser-image-compression-2.0.2/package/LICENSE "$V/browser-image-compression/LICENSE"
cp scribe.js-ocr-0.10.1/package/LICENSE "$V/scribe/LICENSE"
cp scribe.js-ocr-0.10.1/package/scribe.js "$V/scribe/scribe.js"
for d in js mupdf lib tess fonts; do
  cp -a "scribe.js-ocr-0.10.1/package/$d" "$V/scribe/$d"
done
cp tesseract.js-data-eng-1.0.0/package/4.0.0_best_int/eng.traineddata.gz \
  "$V/scribe/tess/eng.traineddata.gz"
# Then remove trailing sourceMappingURL lines from the two pdf-lib/BIC bundles
# and reapply the three patches listed above. Run node --check on every file.
```

## Licences

- `preact.LICENSE` — MIT (Jason Miller).
- `htm.LICENSE` — Apache-2.0.
- `pdfjs/LICENSE` — Apache-2.0 (Mozilla Foundation).
- `pdf-lib/LICENSE` — MIT (Andrew Dillon).
- `browser-image-compression/LICENSE` — MIT (Donald Chan).
- `scribe/LICENSE` — AGPL-3.0 (scribe.js-ocr). Font provenance/notice is in
  `scribe/fonts/readme.Md`; upstream ships no separate OFL text file.
  `scribe/tess/eng.traineddata.gz` comes from an MIT-licensed npm package; the
  underlying Tesseract language data is Apache-2.0 (see `naptha/tessdata`).

AGPL-3.0 is copyleft: keep `scribe/LICENSE` with the scribe assets and make the
corresponding source available when distributing a build that includes it.

## Verification and not-vendored assets

All `.mjs`/`.js` files pass `node --check`. Dynamic imports succeed for preact,
htm, pdf.js worker, pdf-lib and browser-image-compression; `pdf.mjs` needs a
`DOMMatrix` stub in Node (browser-only global), and `scribe/scribe.js` has a
Node-only optional `canvaskit-wasm` import (browser uses `OffscreenCanvas`).

Not vendored deliberately: pdf.js `cmaps/`/`standard_fonts/` (not needed for the
default Latin PDFs; a `CMapReaderFactory` would be needed for non-Latin CID
fonts), scribe `cli/`, `docs/`, `examples/`, `scrollview-web/`, source maps for
bundles that referenced them, the browser-image-compression UMD build (worker
mode disabled), and Tesseract languages other than English.

**Size:** 229 files, 66,158,026 bytes (63.1 MiB) counted as the sum of file
sizes (including this README); `du -sh vendor` reports ~40 MiB on this
filesystem. Scribe accounts for
almost all of it (`tess/` ~25 MiB, `fonts/` ~10 MiB, `mupdf/` 3.3 MiB).

See the repo `AGENTS.md`: every browser-needed file under `vendor/` must also be
listed in `sw.js`'s `SHELL` by whoever wires up the service worker.
