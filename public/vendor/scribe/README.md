# `public/vendor/scribe/`

This directory is populated by the `postinstall` script
(`scripts/copy-scribe-assets.mjs`) when `npm install` is run.

It holds the runtime assets for [`scribe.js-ocr`](https://github.com/scribeocr/scribe.js):

- `scribe.js` — the main ESM entry point
- `lib/` — scribe.js internal workers + WASM (canvaskit, tesseract)
- `tess/` — Tesseract language data (`eng.traineddata`, etc.)
- `fonts/` — fonts used by scribe for layout-aware extraction

## Why same-origin?

Scribe.js, like most WASM-heavy OCR libraries, **must** be served from the
same origin as the page importing it. Loading these assets from a CDN is
explicitly unsupported by the scribe.js authors, and cross-origin WASM
instantiation is blocked by most browsers' security policies.

See:
- `CLAUDE.md` §5B — "OCR-Assisted Metadata Prefill"
- `CLAUDE.md` §21 invariant 18 — "Third-party WASM / model assets are
  served same-origin"

## Contents not tracked in git

The actual scribe.js binary assets are **not** committed — they are
copied fresh on every `npm install` from `node_modules/scribe.js-ocr/`.
Only this README (and `.gitkeep`) are tracked so the directory exists
for the dev server to serve into.

## License

Scribe.js is **AGPL-3.0**. Quarchive credits it in `src/pages/About.jsx`.