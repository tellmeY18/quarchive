# AGENTS.md

Instructions for AI agents and contributors working in this repository. Humans: read this too.

## What this repo is

**Quarchive** is a serverless, open-source archive of previous-year university exam question papers. It is a static site: no bundler, no npm dependencies at runtime, no build step. Cloudflare Pages Functions under `functions/api/` are the only server-side code; they are thin pass-through proxies for Archive.org and are kept unchanged by UI work.

Design comes from **https://brand.letsimpl.fyi**, the source of truth for the whole org. The plain brand files are vendored, unedited, into `brand/` by `tools/sync-brand.mjs`. Do not hand-edit anything under `brand/`.

## Brand rules

- The identity is black and white. No brand colour. The only colours are the four functional status fills and their ink variants from the brand tokens.
- Use the brand's `ls-` classes and CSS custom properties. This app's `styles.css` defines layout only: no colours, fonts, sizes, shadows or rounded corners of its own.
- Fonts are self-hosted by the brand. No CDN, analytics, trackers, cookie banners or third-party requests. The CSP in `_headers` allows only the API hosts actually used.
- Accessibility floor: 4.5:1 text, 3:1 control edges, 44px targets (48px preferred), 3px focus ring, 320px width, 200% text, `prefers-reduced-motion`, `prefers-color-scheme`, skip link, visible labels.
- **Do not invent brand copy** (taglines, slogans, mission statements). Documentation prose is fine.
- **Do not generate brand assets** without an explicit request from the founder. The duck-with-cap kit in `icons/` is the official, founder-drawn Quarchive kit from the brand repo; `npm run brand` refreshes it. Record any borrowed or generated material in `CREDITS.md`.

## Layout

```
index.html          App shell: metadata, theme script, brand CSS + styles.css, js/main.js
styles.css          App layout only; all design values come from brand/
brand/              Vendored tokens, CSS, fonts + brand.json checksums for brand/ and icons/ (do not edit)
vendor/             Prebuilt ESM libraries + licences (no npm install at runtime)
js/
  main.js           Mounts the app into #app, starts update checks
  config.js         APP_VERSION and constants (stamped by deploy workflow)
  theme.js          Pre-paint light/dark choice
  update.js         Service-worker update checks and safe restart
  icons.js          Local 24-grid stroke icons
  route.js          Hash-route parser/formatter; URL is state
  ui.js             App shell: header, footer, bottom nav, auth gate, toasts, route dispatch
  views/            One module per screen (home, browse, paper, upload, camera, bulk, about, auth)
  *.js              Pure logic ported from the old React app (archive, metadata, dedup, wikidata, ...)
functions/api/      Cloudflare Pages Functions (login, s3keys, validate, upload, pdf)
workers/            Hash + OCR Web Workers
icons/              Official Quarchive identity kit vendored from the brand repo + README.md
sw.js               Versioned app-shell precache
_headers            Cache policy and strict CSP
tests/              node:test units + policy tests, tests/e2e/ Playwright specs
tools/              sync-brand.mjs, serve.py
.github/workflows/  Test + Cloudflare Pages deploy
```

The `js/` modules are: `main.js`, `config.js`, `theme.js`, `update.js`, `icons.js`, `route.js`, `ui.js`, `components.js`, `pdfViewer.js`, `fetch.js`, `archive.js`, `auth.js`, `upload.js`, `metadata.js`, `metadataExtract.js`, `dedup.js`, `wikidata.js`, `indianStates.js`, `geolocation.js`, `store.js`, `capture.js`, `imageToPdf.js`, `ocr.js`, `bulk.js`, `constants.js`, `support.js`, `upi.js`, `qr.js`, and one module per screen in `views/`: `home.js`, `browse.js`, `paper.js`, `upload.js`, `camera.js`, `bulk.js`, `about.js`, `auth.js`.

Every file under `js/`, `vendor/`, `brand/`, `icons/`, `workers/` and `data/` that the browser needs must be listed in `sw.js`'s `SHELL`, and must be mentioned in this file when it is a `js/` module. `tests/shell.test.js` enforces both.

## Architecture rules

- **No build step.** Import Preact and htm directly from `vendor/`. `htm.bind(h)` gives `html` tagged templates. New dependencies must be prebuilt ESM committed under `vendor/` with a licence, and justified in `vendor/README.md`.
- **URL is state.** Hash routes (`#/`, `#/browse`, `#/upload`, `#/upload/bulk`, `#/paper/:id`, `#/about`) work on static hosting without rewrites. `hashchange` drives `App.enter()`. Deep links carry search/filter params.
- One `App` class in `js/ui.js` owns app state and view methods. Pure logic lives in small modules with injected dependencies (`{ signal, fetchImpl, storage, now }`) so `node:test` can exercise it.
- Guard `localStorage`/`sessionStorage` with try/catch and prefix keys `quarchive:`. Clean malformed values on read.
- All fetches use `AbortController` and timeouts, `credentials: 'omit'` and `referrerPolicy: 'no-referrer'`. Workers at `/api/*` are same-origin; never send credentials to Archive.org from the browser.
- Camera frames and OCR never leave the device. OCR is serial, has a 15s budget, and its suggestions are never auto-applied.
- Service worker: atomic install with `cache: 'reload'`, `skipWaiting`, old-cache cleanup, navigations answered from cached `./`, cross-origin bypass. `APP_VERSION` and the cache name are stamped together by the deploy workflow.

## Commands

```
nix develop                 # Node + Python + Playwright/Chromium + treefmt
python3 tools/serve.py      # static dev server at http://localhost:8080
npm test                    # node --test tests/*.test.js
npm run test:e2e            # Playwright against the production CSP
npm run brand               # re-fetch brand files from brand.letsimpl.fyi
npm run brand:check         # fail on vendored-brand drift
treefmt                     # format before committing
```

Cloudflare Pages Functions need a Pages environment (`wrangler pages dev`) to be exercised locally; the static dev server only serves the UI.

## Changing the brand

Fetch changes in the brand repo first. Run `npm run brand`, then adjust only this app's `styles.css` layout if the new tokens require it. If the brand lacks a component or value, change the brand first — do not add a local substitute.

## Deploying

`.github/workflows/deploy.yml` runs `npm test`, stages `dist/` (including `functions/`, `vendor/`, `brand/` and `icons/`), stamps `sw.js` and `js/config.js`, verifies that every precached path exists, then deploys with `wrangler pages deploy` to the `quarchive` Cloudflare Pages project. No build command. Docs-only commits should carry `[skip ci]`.

## Working agreements

- Credit borrowed code, fonts, libraries and data in `CREDITS.md` in the same change.
- Never commit secrets, tokens or keys. The app requires zero environment variables.
- Small, focused commits with plain messages. Do not push, force-push or rewrite history unless asked.
- Ask when in doubt. Prefer fewer files, fewer lines, fewer ideas.
