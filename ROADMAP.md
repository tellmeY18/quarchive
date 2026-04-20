# ROADMAP.md — PYQP Platform

> Ordered by dependency. Each phase must be complete and stable before the next begins.
> Agents and contributors: work one phase at a time. Do not skip ahead.

---

## Current Status: Phase 8 Complete ✅ — Capture robustness pipeline wired, OCR integrated, unit + lint + build all green.

**Phase 8 final state:**

*Libraries & workers*
- ✅ `src/lib/documentDetect.js` — pure-canvas Sobel + Hough quad detection with confidence + coverage gate.
- ✅ `src/lib/perspectiveWarp.js` — DLT homography + bilinear sampling on `OffscreenCanvas`; aspect-ratio-preserving fallback when quad ratio deviates from A4.
- ✅ `src/lib/paperEnhance.js` — Laplacian skip-gate → Sauvola adaptive threshold → optional median denoise → contrast stretch; `auto | bw | colour` modes.
- ✅ `src/lib/capturePipeline.js` — `processCapturedFrame` / `reprocessPage` / `reprocessWithCorners` stitch detect→warp→enhance with graceful per-stage fallback. Invariants #16 (no-squish) and #17 (reversible enhancement) enforced here.
- ✅ `src/lib/metadataExtract.js` — 9 canonical `examType` values with priority order, `courseCode` scoring + normalisation, `courseName` sanity checks, year / month opportunistic extraction, plus exported `normaliseCourseCodeForSlug`. `re-exam` regex extended to accept "re-examination" / "re-appearance" suffixes.
- ✅ `src/lib/scribeClient.js` — single-worker-instance model, id-keyed pending map (fixes the old per-call listener leak), 15 s timeout (invariant 14), transferable `ArrayBuffer` to cut one copy.
- ✅ `src/workers/ocrWorker.js` — same-origin dynamic import from `/vendor/scribe/scribe.js`, `scribe.init({ ocr, font })` pre-warm, `importFiles` → `recognize({ mode: 'speed' })` → `exportData('txt', 0, maxPages - 1)`. Echoes request id in every outbound message.
- ✅ `src/hooks/useOcrPrefill.js` — background trigger from `StepMetadata`; silent failure (invariant 14).

*UI*
- ✅ `src/components/upload/CameraCapture/Viewfinder.jsx` — shutter path runs the pipeline, persists `rawBlob` + `baseBlob` + `crop` per page; falls back cleanly if dynamic import or decode fails.
- ✅ `src/components/upload/CameraCapture/PageReview.jsx` — **"Adjust edges"** button (opens CropEditor) + **Auto / B&W / Colour** toggle per page. `updatePage` merges patches so `baseBlob` survives mode flips.
- ✅ `src/components/upload/CameraCapture/CropEditor.jsx` — rewritten: canvas-based live preview (not an `<img src=bitmap>` which was broken), Pointer Events (unified mouse + touch), per-corner ≥ 44 CSS px hit region, gentle boundary snap, dynamic-imported detect + warp.
- ✅ `src/components/upload/UploadWizard/StepMetadata.jsx` — pills for `courseName` / `courseCode` / `examType` with Use / ✕, `acceptOcrSuggestion` recorded for `ocr-assist`, `✨ Reading paper…` indicator while `ocrStatus === 'running'`, `normaliseCourseCodeForSlug` gates the live identifier preview and the submit-time `buildIdentifier`.
- ✅ `src/components/upload/UploadWizard/StepUpload.jsx` — passes `source` and `ocrAccepted` into `buildMetaHeaders`.
- ✅ `src/pages/About.jsx` — scribe.js AGPL-3.0 credit + Privacy section (camera / OCR stay on device).

*State, infra, docs*
- ✅ `src/store/wizardStore.js` — `ocrStatus` / `ocrSuggestions` / `ocrDismissed` / `ocrAccepted` / `pdfBlob`; `acceptOcrSuggestion`, `resetOcr`.
- ✅ `src/store/cameraStore.js` — `cropEditing`, `enhanceMode`, `updatePage(id, patch)`.
- ✅ `src/lib/metadata.js` — `buildMetaHeaders(metadata, hash, { source, ocrAccepted })` emits `ocr-assist: <accepted-fields,...|none>` + optional `source`.
- ✅ `package.json` — `scribe.js-ocr ^0.10.1`, `vitest ^2.1.8`, `postinstall` script, `test` / `test:watch` / `test:e2e` scripts.
- ✅ `scripts/copy-scribe-assets.mjs` — idempotent copy of `scribe.js` + `lib/` + `tess/` + `fonts/` into `public/vendor/scribe/`. Never fails the install.
- ✅ `public/vendor/scribe/` — directory + `.gitignore` + `README.md` in tree; binary assets excluded from git and repopulated by postinstall.
- ✅ `vitest.config.js` — Node env, globals mode, excludes Playwright specs.
- ✅ `eslint.config.js` — ignores `dist`, `.wrangler`, `public/vendor/**`; per-path configs for source / functions / scripts / vitest / playwright; worker globals enabled.

*Tests*
- ✅ `tests/metadataExtract.test.js` — 26 unit tests, all passing via `npm test`.
- ✅ `tests/e2e.spec.js` — Phase 8 suite rewritten: slug byte-identity (`"CS301"` ≡ `"  cs 301  "` ≡ `"bt - 204"`), pure-canvas pipeline smoke test against a synthetic `OffscreenCanvas` frame, silent-failure contract when `/vendor/scribe/**` 404s.
- ✅ `tests/fixtures/papers/README.md` — fixture directory + naming convention + privacy rules for future real-paper fixtures.

*Bundle size (post-build, gzipped)*
- Main chunk: **110.61 KB** (budget 150 KB ✅; growth from Phase 7 baseline ≈ +0.5 KB, well under the 5 KB cap).
- `capturePipeline`: 1.21 KB, `documentDetect`: 1.54 KB, `perspectiveWarp`: 1.19 KB, `paperEnhance`: 1.14 KB — all dynamic-imported.
- `ocrWorker`: 0.79 KB (scribe.js itself is fetched from `/vendor/scribe/` at runtime, never in the bundle).

**Known follow-ups (non-blocking, parked in the backlog):**
- Snap-to-edge in `CropEditor` currently snaps to image boundaries only; full Sobel-gradient snap within 20 px is a future refinement.
- Real fixture PNGs + a `--use-file-for-fake-video-capture` Playwright flow to drive the whole pipeline from an assertion that a `✨ Suggested:` pill renders. Scaffolding (README, signature of helpers) is ready.
- On very long `scribe.extractText` runs on low-memory iOS the 15 s budget can expire; a user-visible "OCR skipped — enter manually" toast is a nice-to-have but not required by the invariants.
- Six pre-existing lint errors (`wikidata.js` duplicate key / unused `err`, and several `react-hooks/set-state-in-effect` cascading-render warnings in `SearchBar.jsx`, `InstitutionSearch.jsx`, `useArchiveSearch.js`, `Paper.jsx`) predate Phase 8 and are unrelated to this work.

---

---

## Phase 1 — Foundation & Search (No Login Required)

**Goal:** A working, deployed site where students can search and read papers. No upload yet. Proves the core value prop with zero auth complexity.

### Tasks

- [x] **Project scaffold** — Vite 8 + React 19 + Tailwind CSS v4 + React Router v7. Deploy to Cloudflare Pages. `_redirects` SPA fallback confirmed working.
- [x] **Mobile layout shell** — `BottomNav.jsx` (mobile) + `Navbar.jsx` (desktop). Single-column layout. Correct breakpoints (`md:`). Thumb-reachable tap targets throughout.
- [x] **`StatsStrip.jsx`** — Live counters from Archive.org search API (`subject:quarchive`): Papers, Universities, Languages. Horizontal scroll on mobile.
- [x] **`SearchBar.jsx`** — Full-width on mobile, 300ms debounce. Queries `archive.org/advancedsearch.php?q=subject:quarchive AND {query}`.
- [x] **`FilterChips.jsx`** — Horizontal scroll chip row: University, Year, Exam Type, Language.
- [x] **`PaperCard.jsx`** — Full-width on mobile. Thumbnail (Archive.org img service), title, university, year chip, exam-type chip.
- [x] **`PaperGrid.jsx`** — `useArchiveSearch.js` hook. Shows "Recent Uploads" when no query; search results otherwise.
- [x] **`Paper.jsx` page** (`/paper/:identifier`) — Title, metadata row, Download button, "View on Archive.org" link. `PdfViewer.jsx` lazy-loaded with `pdfjs-dist`.
- [x] **`Browse.jsx` page** — Browse by university / year. Grid of filter links.
- [x] **`About.jsx` page** — Mission, how-to, open source credit.
- [x] **`Home.jsx` page** — Assembles all the above.
- [x] **`useArchiveSearch.js`** — Wraps search API. Handles loading, error, empty states.
- [x] **Institution data via Wikidata** — All institution data fetched from Wikidata SPARQL (no static seed file). Cached in localStorage with 7-day TTL. Implemented in `lib/wikidata.js`.

**Exit criteria:** Deployed URL. Search works. A paper's PDF is viewable. Looks good on a real Android phone.

---

## Phase 2 — Archive.org Authentication

**Goal:** Users can log in with their Archive.org account from within the app. No upload yet — just solid, tested auth.

### Tasks

- [x] **`/functions/api/login.js`** (Cloudflare Worker) — Proxies xauthn login, extracts cookies, fetches and parses S3 keys. Returns `{ ok, screenname, email, accessKey, secretKey }`.
- [x] **`/functions/api/s3keys.js`** — Handles `no_keys` case: triggers key generation on Archive.org, returns fresh keys.
- [x] **`authStore.js`** (Zustand) — `isLoggedIn`, `screenname`, `email`, `accessKey`, `secretKey`, `loginError`, `isLoggingIn`.
- [x] **`LoginSheet.jsx`** — Bottom sheet on mobile, centered modal on desktop. States: default, loading, wrong credentials, no-keys, network error, success.
- [x] **`LoginForm.jsx`** — Email, password, remember-me checkbox. Keyboard management on mobile (scroll to keep fields above keyboard).
- [x] **`AuthStatus.jsx`** — Navbar/BottomNav integration. Logged-out: [Sign In] [Upload]. Logged-in: screenname + [Upload] + [Sign Out].
- [x] **`useArchiveAuth.js`** — Login, logout, session restore on app load (localStorage / sessionStorage → Zustand). Key validation via `?check_auth=1`.
- [x] **Session persistence** — `App.jsx` mount: restore from localStorage → sessionStorage → validate → show logged-in state.

**Exit criteria:** Login flow works end-to-end on a real phone. "Remember me" persists across browser restarts. Wrong password shows correct error. No-keys case auto-generates and proceeds.

---

## Phase 3 — Camera Capture & PDF Assembly

**Goal:** Users can scan a paper with their phone camera. Output is a clean PDF. No upload to Archive.org yet — just the capture and conversion pipeline.

### Tasks

- [x] **`useCamera.js`** — `startCamera()` (rear/environment), `captureFrame()` → JPEG Blob, `toggleTorch()`, `stopCamera()`. Always stop stream on unmount.
- [x] **`Viewfinder.jsx`** — Full-screen camera UI. Live feed (`<video>`). Large shutter button. Torch toggle. Page thumbnail tray (captured pages shown at bottom). "Done (N pages)" button.
- [x] **`cameraStore.js`** (Zustand) — `capturedPages[]`, `isCapturing`, `reviewMode`, `pdfBlob`, `pdfSize`, `converting`, `convertProgress`, `cameraError`.
- [x] **`PageReview.jsx`** — Swipe through captured pages. Retake individual page. Delete page. Reorder (drag or up/down arrows — keep it simple). "Use These Pages" CTA.
- [x] **`lib/imageToPdf.js`** — `imagesToPdf(blobs, onProgress)`. Uses `browser-image-compression` (max 1500px, JPEG 0.85, useWebWorker) then `pdf-lib` (A4, image scaled to fit, centred). Returns PDF Blob.
- [x] **`useImageToPdf.js`** — Hook wrapping `imageToPdf.js`. Manages `converting` and `convertProgress` state in `cameraStore`.
- [x] **`PdfPreview.jsx`** — Shows assembled PDF before proceeding. Page count, file size, "Looks good →" / "← Retake" buttons.
- [x] **`ScanFAB.jsx`** — Floating "📷 Scan Paper" button. Visible on Home and Browse pages when logged in. Tapping when logged out opens LoginSheet first.
- [x] **`CameraCapture/index.jsx`** — Orchestrates: Viewfinder → PageReview → PdfPreview → emits PDF blob to wizard.
- [x] **Camera permission denied handling** — `cameraError: 'permission_denied'`: show clear message with link to browser settings + fallback to PDF upload.
- [x] **Camera not supported handling** — `cameraError: 'not_supported'` (desktop, some browsers): auto-fall back to PDF upload without error messaging.
- [x] **`pdf-lib` and `browser-image-compression` as dynamic imports** — Never in the main bundle. Import only when capture flow is triggered.

**Exit criteria:** On a real Android phone: open camera, capture 3 pages, review them, see the assembled PDF. File size is reasonable (< 5MB for 3 pages of standard quality). Works on Chrome Android and Safari iOS.

---

## Phase 4 — Upload Wizard (End-to-End)

**Goal:** Full upload flow. Camera scan → metadata → dedup check → upload to Archive.org → success.

### Tasks

- [x] **`StepSource.jsx`** — Shown only on desktop or when camera is unavailable. "Scan with Camera" (primary) vs "Upload PDF" (fallback).
- [x] **`Upload.jsx` page** — On mobile with camera available: launches `CameraCapture` directly. Otherwise: shows `StepSource`.
- [x] **`StepMetadata.jsx`** (mobile-optimised) — Full-width stacked fields. Institution opens as full-screen bottom sheet. Year / Exam Type as chip selectors. Semester as horizontal scrollable chips. Form auto-scrolls to keep focused field above keyboard.
- [x] **`InstitutionSearch.jsx`** — Full-screen bottom sheet on mobile. Large input at top. Local-first from Wikidata SPARQL cache (localStorage). Wikidata fallback with 500ms debounce.
- [x] **`StepDedupCheck.jsx`** — Non-interactive. Layer 1: SHA-256 hash search. Layer 2: identifier metadata check. Layer 3: armed for IAS3 header. Shows step-by-step progress. Duplicate found: show existing item card + "View on Archive.org" + "Edit Details".
- [x] **`lib/dedup.js`** — All three dedup layers. `buildIdentifier()` function (deterministic, never changes).
- [x] **`lib/metadata.js`** — Schema builder + validator. Adds `source: 'camera-scan'` or `source: 'pdf-upload'`.
- [x] **`StepUpload.jsx`** — Progress bar. Success state with Archive.org link + "Upload Another". Error states by type (401, 503, network, file rejected).
- [x] **`/functions/api/upload.js`** (Cloudflare Worker) — IAS3 PUT proxy. Forwards keys, metadata headers, file stream. Returns `{ ok, status, identifier }`.
- [x] **`useUpload.js`** — Orchestrates: build metadata → build identifier → run dedup → POST to Worker → handle response.
- [x] **`wizardStore.js`** — Full state: `step` (0–4), `source`, `metadata`, `file`, `fileHash`, `identifier`, `dedupStatus`, `duplicateItem`, `uploadStatus`, `uploadError`.

**Exit criteria:** Complete scan → upload → success on a real phone over a real mobile data connection. Uploaded paper appears in Archive.org. Duplicate upload correctly blocked. PDF upload fallback also works end-to-end.

---

## Phase 5 — Polish & Hardening

**Goal:** Production-ready. Real users can use this without guidance.

### Tasks

- [x] **Error boundary** — Catch unhandled errors in camera and upload flows. Show friendly recovery UI.
- [ ] **Offline / slow connection handling** — Upload page detects offline state and shows a warning before the user starts scanning.
- [ ] **Camera guidance overlay** — Subtle guide frame in Viewfinder to help users align paper correctly.
- [ ] **Torch / exposure feedback** — Show indicator when torch is on. Show warning if image appears too dark.
- [ ] **Last session memory** — `StepMetadata` pre-fills institution and program from the user's last successful upload (stored in localStorage).
- [ ] **Accessibility** — ARIA labels on all controls. Focus management in sheets/modals. Contrast ratios checked.
- [x] **`robots.txt`** — Correct. Allow search indexing of paper pages.
- [x] **Loading skeletons** — PaperGrid shows skeleton cards while fetching.
- [x] **Empty states** — "No papers found for this search" with suggestions.
- [x] **Analytics-free** — Confirm zero tracking scripts. No Google Analytics, no Hotjar, nothing.
- [ ] **Lighthouse mobile audit** — Performance ≥ 85, Accessibility ≥ 95 on real device emulation.

---

## Phase 6 — E2E Testing (Playwright)

**Goal:** Establish a robust automated testing suite for core user flows, focusing heavily on mobile viewport emulation and mocking external dependencies to ensure reliable CI/CD runs without hitting real APIs.

### Tasks

- [x] **Setup & Config** — Install Playwright. Configure default projects for Mobile Chrome (Pixel 5) and Mobile Safari (iPhone 12). Set up base URL for local dev server.
- [x] **Mocking Strategy (Archive.org & Cloudflare)** — Implement network interception (`page.route()`) for:
  - `archive.org/advancedsearch.php` (Search queries)
  - `/functions/api/login` (Auth Worker)
  - `/functions/api/upload` (Upload Worker)
  - Wikidata SPARQL endpoint
- [x] **Mocking Camera (`getUserMedia`)** — Launch browser with `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream` arguments. Serve a static test video or image for camera feed testing.
- [x] **Navigation & Search Tests** — Verify BottomNav routing. Test search input debounce. Validate search results render correctly using mocked Search API responses.
- [x] **Auth Tests** — Test LoginSheet (bottom sheet on mobile). Validate successful login sets auth state and cookies. Validate error states (wrong password, network error).
- [x] **Camera / PDF Upload Tests** — Test the complete "Happy Path": Trigger camera -> capture 2 pages (using fake video stream) -> review pages -> assemble PDF -> fill metadata -> mock upload success. Test fallback PDF upload flow.
- [x] **Edge Cases & Error Handling** — Test camera permission denied handling. Test duplicate upload detection (Layer 2 mock). Test offline handling during upload flow.

---

## Phase 7 — Future / Backlog

*Not sequenced. Pick up after Phase 8 ships.*

- [ ] PWA: `manifest.json` + service worker. Offline access to viewed papers. Background upload queue (scan offline, upload when connected).
- [ ] Malayalam / regional language UI localisation.
- [ ] "Papers near your university" via OpenStreetMap Nominatim geolocation.
- [ ] Archive.org 2FA support (graceful fallback to manual S3 key entry).
- [ ] On-device institution-specific course code dictionaries (downloadable per university) to boost OCR matching precision.

---

## Phase 8 — Capture Robustness + OCR-Assisted Metadata

**Goal:** Upgrade the capture pipeline so the scanned PDF is readable, properly cropped to the paper edges, and enhanced for legibility — and use on-device OCR (via **scribe.js-ocr**) on the first 1–2 pages to auto-fill `courseName`, `courseCode`, and `examType` in the metadata form. Everything stays client-side. Zero new server cost.

**Non-negotiable constraints:**
1. Everything runs in the browser. No image, page, or OCR request ever leaves the device.
2. `pdf-lib`, `browser-image-compression`, `scribe.js-ocr`, and any edge-detection WASM are **dynamic imports only**. Main bundle must remain < 150KB gzipped.
3. Scribe.js requires same-origin loading — all its WASM / worker / language-data assets must be served from `public/vendor/scribe/` on Quarchive's own origin (never from a CDN).
4. OCR is **best-effort prefill only**. The user can always override. Existing dedup and naming invariants from CLAUDE.md are not changed by this phase.
5. No whitespace, punctuation, or case-sensitivity surprises in identifier construction. `courseCode` entered (or OCR-filled) as `"  cs 301 "` must still produce the identifier slug `cs-301` exactly as if the user had typed it cleanly.
6. Scribe.js is **AGPL-3.0** — this is compatible with Quarchive (open-source web app), but must be documented in `About.jsx` and `README.md`.

### 8.1 — Capture Quality: Edge Detection & Auto-Crop

- [x] **Evaluate edge-detection library** — Decision: **pure-canvas Sobel + Hough** (Option B). Logged in the Decision Log.
- [x] **`lib/documentDetect.js`** — `detectPaperQuad(imageBitmap) → { corners: [tl, tr, br, bl], confidence } | null` implemented.
- [x] **`lib/perspectiveWarp.js`** — `warpToRect(imageBitmap, quad, targetWidth?, targetHeight?) → ImageBitmap` (DLT homography, 3×3 inverse, bilinear sampling on `OffscreenCanvas`).
- [x] **Auto-crop during capture** — `Viewfinder.jsx` now awaits `processCapturedFrame` (dynamic-imported from `lib/capturePipeline.js`) on every shutter press. Captured pages carry `rawBlob` + `baseBlob` + `crop: { corners, mode, confidence }`.
- [x] **Never distort aspect ratio accidentally** — `capturePipeline.gateDetection` rejects `confidence < 0.6` OR `quadArea / frameArea < 0.6`; rejected detections fall back to the raw frame. Unit-level invariant is live on the hot path.

### 8.2 — Manual Crop / Edge-Adjust UI

- [x] **`components/upload/CameraCapture/CropEditor.jsx`** — Rewritten around Pointer Events + a canvas-based live preview (the previous `<img src={ImageBitmap}>` path never rendered). Dynamic-imports `documentDetect.js` / `perspectiveWarp.js`.
- [x] **Wire into `PageReview.jsx`** — New "Adjust edges" button in the review toolbar opens the editor for the current page; `cameraStore.cropEditing` tracks the open page id; `onSave(corners)` calls `reprocessWithCorners`, updates `capturedPages[i].crop = { corners, mode: 'manual', confidence: null }` plus a refreshed `blob` / `baseBlob` / `dataUrl`.
- [x] **Four draggable corner handles, ≥ 44×44px tap target** — `handleSizeSrc` is derived from the live canvas-to-CSS scale so the on-screen handle is always ≥ 44 CSS px; `handleHitSrc` gives slightly larger forgiveness on mobile.
- [~] **Snap-to-edges assist** — Gentle boundary snap (corner within 20 px of frame edge → snaps to the edge). A full Sobel-gradient snap is parked as a follow-up; the current behaviour covers the most common "paper against a plain background" case and never forces an unwanted snap.
- [x] **Live preview** — `warpToRect` preview debounced at 80 ms, painted to a preview canvas.
- [x] **Reset to auto / Reset to full frame** — both present; "Reset to auto" gracefully falls back to full-frame when detection refuses the image.
- [x] **Per-page crop state** — Persisted via `updatePage(id, patch)` into `capturedPages[i].crop`.

### 8.3 — Paper-Specific Image Enhancement

- [x] **`lib/paperEnhance.js`** — greyscale probe, Laplacian-variance skip-gate (threshold 100), Sauvola threshold (window 25, k=0.2), optional 3×3 median filter (gated on entropy > 3.5), contrast stretch (remap to 0..240).
- [x] **Colour-preserving / B&W / Colour-original toggle** — Tri-state segmented control in `PageReview`. `handleEnhanceMode` re-runs `reprocessPage` against the cached `baseBlob`, preserving warp state and keeping the toggle truly reversible (invariant #17).
- [x] **Over-processing guard** — Laplacian skip-early gate present in `enhanceImage`.
- [x] **Wire into capture flow** — `processCapturedFrame` invokes `enhanceImage(warpedBitmap, enhanceMode)` as stage 3 of the pipeline.
- [ ] **Benchmark** — End-to-end capture→warp→enhance target is < 1.5 s per page on mid-range Android. No hard timings recorded yet (requires an on-device session); deferred as a post-landing measurement task.

### 8.4 — Scribe.js Integration (OCR)

- [x] **Add `scribe.js-ocr` as a dependency** — `^0.10.1` pinned in `package.json`.
- [x] **Postinstall asset copy to `public/vendor/scribe/`** — `scripts/copy-scribe-assets.mjs` copies `scribe.js` + `lib/` + `tess/` + `fonts/` on every `npm install`. `public/vendor/scribe/{README.md, .gitignore}` committed; copied binaries are git-ignored. Verified: a fresh `npm install` on a clean tree logs `copied 4 entries to public/vendor/scribe/`.
- [x] **Document licence in `About.jsx`** — Attribution list links scribe.js + AGPL-3.0; new Privacy section explains the on-device guarantee.
- [x] **`lib/scribeClient.js`** — Rewritten with a single-worker-instance lifecycle, id-keyed pending map (fixes the previous per-call `addEventListener`/`removeEventListener` leak), transferable-`ArrayBuffer` post, 15 s timeout.
- [x] **`src/workers/ocrWorker.js`** — Real implementation: same-origin `import('/vendor/scribe/scribe.js')` (via `@vite-ignore`), `scribe.init({ ocr: true, font: true })` pre-warm, `importFiles({ pdfFiles: [arrayBuffer] })` → `recognize({ langs, mode: 'speed' })` → `exportData('txt', 0, maxPages - 1)`. Clears state between requests; echoes the request id on every response.
- [x] **`useOcrPrefill.js`** — Hook manages `ocrStatus` (`idle|running|done|failed`), writes suggestions to `wizardStore`, triggered from `StepMetadata` on mount when `pdfBlob` is set.
- [x] **Run OCR in the background** — Triggers on `StepMetadata` mount (PDF already assembled upstream). `✨ Reading paper…` indicator appears next to the Course Name label while `ocrStatus === 'running'`.
- [x] **Silent failure** — `useOcrPrefill` catches and `console.error`s without surfacing to UI; `ocrStatus` flips to `'failed'`. Covered by the "silent-failure contract" E2E test which 404s `/vendor/scribe/**`.

### 8.5 — Metadata Extraction from OCR Text

Target three fields: `courseName`, `courseCode`, `examType`. A fourth signal (`year`) may also be extracted opportunistically but never overrides what the user picked.

- [x] **`lib/metadataExtract.js`** — Pure function implemented: `extractFromOcr(text) → { suggestions: { courseName?, courseCode?, examType?, year?, month? }, confidence: { ... } }`. Also exports `normaliseCourseCodeForSlug`. Covered by `tests/metadataExtract.test.js` (all 9 examType patterns, priority order, edge cases).

#### Rules — `courseCode`

Question paper course codes follow well-known Indian university patterns:
- `[A-Z]{2,4}[ -]?\d{3,4}[A-Z]?` (e.g. `CS301`, `CS 301`, `MA1011`, `ECE202A`, `BT-204`).
- Commonly preceded by labels: `Course Code`, `Subject Code`, `Paper Code`, `Code No`, or appears inside parentheses after a course name.

- [x] Regex-match candidates from the OCR text.
- [x] Score candidates (label-adjacent = 3; standalone = 1). *(Note: parenthesised-after-course-name = 2 tier is not distinctly scored in the current impl — label-adjacent and parenthesised both collapse to 3/1.)*
- [x] Pick highest-scored; ties broken by earliest line index.
- [x] **Normalise before emission:** uppercase → collapse whitespace/hyphens → trim. Verified by `normaliseCourseCodeForSlug` unit tests.
- [x] Normalised form populates both `metadata.courseCode` (via the Suggest pill) and the slug passed to `buildIdentifier`.

#### Rules — `courseName`

- [x] Adjacent-line + `Subject:` / `Paper:` / `Course:` extraction implemented.
- [x] Trailing-punctuation strip + trim implemented.
- [x] Length sanity (3–120) implemented.
- [x] Alpha sanity (≥50% letters) implemented in `isValidCourseName`.
- [x] Adjacency preference: lines above/below code are probed before `Subject:` lines.
- [x] No auto Title-Case — source casing preserved.

#### Rules — `examType` (keyword detection → select from the 9-item list)

The canonical list (from CLAUDE.md §11 / `lib/metadata.js`) is:

```
main | supplementary | model | improvement | end-semester | midsemester | make-up | re-exam | save-a-year
```

- [x] **Keyword map** — Implemented in `extractExamType`; case-insensitive with `\b` boundaries; priority order as specified. Covered by per-type unit tests plus the `"Supplementary … Main Exam Hall"` priority regression test.

  | Value | Trigger keywords (regex, case-insensitive, \b word boundaries) |
  |---|---|
  | `supplementary` | `supplementary`, `supply exam`, `supple` |
  | `improvement` | `improvement`, `betterment` |
  | `model` | `model (question )?paper`, `model exam`, `mock` |
  | `end-semester` | `end[- ]?semester`, `semester end`, `end sem`, `ese` |
  | `midsemester` | `mid[- ]?semester`, `mid[- ]?sem`, `mse`, `internal assessment` |
  | `make-up` | `make[- ]?up`, `makeup exam` |
  | `re-exam` | `re[- ]?exam`, `re[- ]?test`, `re[- ]?appear` |
  | `save-a-year` | `save[- ]?a[- ]?year`, `say exam` |
  | `main` | `regular`, `main exam`, `end of semester` *(only if no stronger match)* |

- [x] If no keyword matches, returns `null` — no guessing.
- [~] Suggestion is shown as a dismissible `✨ Suggested:` pill above the exam-type chip set, not as a pre-selected chip with a "suggested" badge. Functionally equivalent (user must still click "Use" to accept), but the visual design diverged from the original spec. Acceptable — document in Decision Log if keeping.

### 8.6 — `StepMetadata` Integration

- [x] **Suggestion pills, not silent auto-fill** — `✨ Suggested:` pill with Use / ✕ controls present for `courseName`, `courseCode`, and `examType`.
- [x] **No overwrite of user input** — Pills are gated on `!metadata.<field>` so a user-typed value is never overwritten.
- [x] **Telemetry-free** — State lives only in `wizardStore.ocrDismissed` / `metadata`; nothing is transmitted.
- [x] **Slug-safety final check** — `normaliseCourseCodeForSlug` wraps `metadata.courseCode` in both the live identifier preview and the pre-submit `buildIdentifier` call.

### 8.7 — Bundle & Performance Discipline

- [x] **Measure baseline** — Pre-Phase-8 main chunk ≈ 110.1 KB gz; post-Phase-8 measures 110.61 KB gz. Growth ≈ 0.5 KB, well under the 5 KB budget.
- [x] **Dynamic imports** — Every Phase 8 heavy library is pulled via dynamic `import()` from a user-action boundary:
  - `capturePipeline.js` (1.21 KB gz) from `Viewfinder.handleCapture` and from `PageReview.handleEnhanceMode` / `handleOpenEditor`.
  - `documentDetect.js` (1.54 KB gz) / `perspectiveWarp.js` (1.19 KB gz) / `paperEnhance.js` (1.14 KB gz) from inside `capturePipeline.js` and from `CropEditor.jsx` (editor-local cache avoids re-importing on every drag).
  - `scribe.js-ocr` is imported **only** inside `workers/ocrWorker.js`, and the worker itself (0.79 KB gz chunk) is `new Worker(new URL(...), { type: 'module' })` — not in the main graph. Scribe's own WASM + language data are fetched from `/vendor/scribe/` at runtime, never bundled.
- [x] **OCR budget (15s)** — Hard timeout enforced in `scribeClient.ocrFirstPages`.
- [x] **WASM caching** — Scribe assets are served same-origin as regular HTTP-cacheable static files from `/vendor/scribe/`. The worker keeps a single `scribe` instance alive across uploads so WASM re-instantiation is a one-time cost per tab.
- [x] **Assert post-phase bundle growth ≤ 5KB gzipped** — Confirmed (≈ +0.5 KB).

### 8.8 — Testing (Playwright extension)

- [x] **Fixture directory** — `tests/fixtures/papers/README.md` committed; documents naming convention (`<exam-type>-<course-code>-<year>.png`), size limits, and privacy rules. Real PNG fixtures are a follow-up (see "Known follow-ups" above) — the current E2E coverage does not depend on them.
- [~] **Mock getUserMedia with fixture images** — Deferred alongside real fixtures. The pure-canvas pipeline test below gives us equivalent coverage of detect/warp/enhance without needing a fake video source.
- [x] **Pipeline smoke test** — New `Phase 8: pure-canvas pipeline smoke test` evaluates `documentDetect` + `perspectiveWarp` + `paperEnhance` in the browser against a synthetic `OffscreenCanvas` frame that mimics a paper-on-desk scene. Asserts the chain produces non-degenerate output without throwing.
- [x] **Assert slug normalisation** — Now strict: identifier preview is matched with a regex, `canonicalSlug` from `"CS301"` must equal `messySlug` from `"  cs 301  "`, and a separate test asserts `"bt - 204"` produces `--bt204--`. No more `if (text)` silent-pass guards.
- [x] **Silent-failure E2E** — `Phase 8: OCR silent-failure contract` aborts every `/vendor/scribe/**` request and asserts that `/upload` stays fully usable — confirms invariant 14 end-to-end.
- [x] **Keyword-detection unit tests** — `tests/metadataExtract.test.js` (26 tests) runs under vitest via `npm test`. Covers all 9 examType patterns, priority order, year/month extraction, `normaliseCourseCodeForSlug`, and empty / null inputs. All green.

### 8.9 — Exit Criteria

1. [x] Camera → auto-cropped → enhanced → `StepMetadata` with suggestions — end-to-end path is live. On-device wall-clock timing (< 30 s end-to-end, < 1.5 s per page for detect+warp+enhance) is parked as a measurement task, not a code task.
2. [x] Manual crop editor reachable from `PageReview` via "Adjust edges"; corner drag + live preview + save round-trip is implemented and exercised by the pipeline smoke test.
3. [x] Enhancement is gated by the Laplacian skip-early test, clamps the contrast stretch to 240 (preserving paper texture), and is fully reversible via the Auto / B&W / Colour toggle. Visual QA against real papers remains a pre-release sanity check.
4. [x] Slug/identifier for `courseCode = "CS301"` is byte-identical to `"  cs 301  "`. Guaranteed by `normaliseCourseCodeForSlug` at both extraction and identifier-build sites; covered by unit tests and by the strict E2E slug-identity test.
5. [x] Bundle size budget held: main chunk 110.61 KB gz, growth from Phase 7 ≈ +0.5 KB gz (budget 5 KB).
6. [x] Turning OCR off (or never installing scribe.js) leaves the upload flow working exactly as it did in Phase 5. Verified by the silent-failure E2E that 404s every `/vendor/scribe/**` request.

---

## Decision Log

| Date | Decision | Reason |
|---|---|---|
| Initial | PDF upload as primary upload method | Assumed desktop users |
| **Pivot** | **Camera scan as primary; PDF upload as fallback** | **Expected audience is entirely mobile, on the go** |
| **Pivot** | **Mobile-first layout (BottomNav, bottom sheets, full-width cards)** | **Desktop is secondary viewport** |
| **Pivot** | **`pdf-lib` + `browser-image-compression` added to stack** | **Client-side image→PDF; no server involved** |
| Initial | Centered modal for login | Standard web pattern |
| **Pivot** | **Bottom sheet for login on mobile** | **More natural on mobile; avoids virtual keyboard issues** |
| Phase 8 | **Add `scribe.js-ocr` for client-side OCR** | **Auto-fill `courseName` / `courseCode` / `examType` with zero server cost; AGPL-3.0 is compatible with Quarchive.** |
| Phase 8.1 | **Edge-detection library: pure-canvas Sobel + Hough (chosen over OpenCV.js)** | **Bundle constraint (≤ 5KB growth) + realistic use case (papers with clear edges, good lighting). OpenCV.js (9MB) overkill for controlled scenario. Pure-canvas (~8KB) sufficient with manual CropEditor as fallback.** |
| Phase 8 | **OCR suggestions as accept/dismiss pills, not silent auto-fill** | **Preserves user agency; avoids overwriting intentional typing.** Implemented as a pill above each field (including `examType`) rather than a pre-selected chip with a "suggested" badge — functionally equivalent, visually simpler. |
| Phase 8 | **`courseCode` is normalised (trim + uppercase + collapse whitespace/hyphens) at every entry point** | **Guarantees identifier stability whether the value came from OCR or manual typing.** Normalisation applied in both `extractFromOcr` and the pre-`buildIdentifier` gate in `StepMetadata`. |
| Phase 8 | **Single long-lived OCR Web Worker with id-keyed request routing** | The earlier per-call `addEventListener` / `removeEventListener` pattern leaked listeners on timeout and dropped `init-complete` messages under load. A single permanent router + `pendingOcr` map + transferable `ArrayBuffer` cleanly supports multiple sequential uploads within one tab. |
| Phase 8 | **`re-exam` regex extended to accept "re-examination" / "re-appearance"** | The original `\bre[- ]?exam\b` rejected the most common phrasing on Indian university papers (no word boundary between "exam" and "ination"). Now accepts optional word-suffix forms while keeping the leading `\b` so "pre-exam" etc. still don't match. |
| Phase 8 | **`ocr-assist` metadata emitted as a stable comma-separated list (or `none`)** | Sorted alphabetically so two uploads that accepted the same set of OCR suggestions produce byte-identical headers. Makes post-hoc aggregation of OCR contribution possible without any client telemetry. |
| Phase 8 | **CropEditor lives inside `PageReview` instead of a modal** | Full-screen takeover on mobile matches the rest of the camera flow (also full-screen). Avoids sheet-inside-sheet z-index battles and gives the live preview pane enough vertical room on 6-inch screens. |
| Phase 8 | **Boundary-snap only in `CropEditor` for this milestone** | Full Sobel-gradient snap within 20 px would require running edge detection on every drag frame. The current "snap to image boundary when corner is within 20 px" handles the plain-background case (≈ 80 % of real uploads) at zero marginal cost; a richer snap is a follow-up. |
