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

## Phase 9 — Bulk Upload (Folder / Multi-PDF Ingestion) *(deferred — do not start yet)*

> **Status: deferred.** The full plan of record is preserved below so whoever picks it up has the complete design, but Phase 9 is explicitly paused. No tasks in this phase should be started opportunistically — unblock other maintenance and correctness work first (e.g. the Wikidata institution lookup fix).

**Goal:** Make it practical for a single contributor (a student rep, department coordinator, or librarian) to ingest **tens to hundreds of previously-scanned PDFs** in one sitting — covering many branches, courses, exam types, and years — without turning the upload wizard into a per-file slog. Primary use case: someone has a folder tree like `KTU/CSE/S4/2023/Main/CS301-DataStructures.pdf` on a laptop and wants every file safely on Archive.org, correctly tagged, with duplicates silently skipped.

**Audience note:** This is the **one feature in Quarchive that is desktop-first**. Mobile users keep the camera flow. Bulk ingestion requires a keyboard, a folder picker, and a stable network — forcing it onto a phone would be user-hostile. The mobile UI must still show the queue (read-only) so a contributor can start a job on a laptop and monitor progress on their phone.

**Non-negotiable constraints:**
1. **No bypass of single-file invariants.** Every file in a batch still runs the three dedup layers (CLAUDE.md §12), still gets a deterministic identifier (§11), still lands in the `quarchive` collection, and the `courseCode` normalisation gate (Phase 8, invariant 15) still runs per file.
2. **No parallel firehose.** Archive.org rate-limits per account. Uploads run with a bounded concurrency of **3 simultaneous PUTs** (configurable 1–5); the remainder queue. Never fire N unbounded promises at a file list.
3. **No server.** All orchestration, path parsing, dedup, hashing, OCR, and queue persistence stays in the browser. No new Pages Functions.
4. **Crash-resilient queue.** Queue state is persisted to IndexedDB after every file-state transition. Closing the tab and reopening it resumes the job with the remaining files — hashes, identifiers, and per-file metadata survive reload. Completed and skipped entries stay visible for the session so the user can audit what happened.
5. **Never upload raw images in bulk.** Bulk input accepts **PDFs only** (MIME + `%PDF` magic byte validation, per invariant 7). If a user drops images/zip/folders with mixed content, images are rejected with a clear message pointing them at the camera flow.
6. **Never silently auto-fill controversial fields.** Institution, program, year-range, default examType, and semester come from a **one-time batch preset** the user confirms before the queue starts. Per-file OCR may refine `courseName` / `courseCode` / `examType`, but the batch preset is the fallback when OCR is silent or disagrees — and the user gets a mandatory review pass for any file whose identifier collides, whose hash fails, or whose OCR extracted nothing.
7. **Bounded memory.** A 200-file × 5 MB job must not hold all PDFs in memory. Files are read, hashed, and uploaded streaming one-at-a-time (within the concurrency limit); only lightweight queue records (path, hash, status, identifier, small metadata object) live in the in-memory store.
8. **Bundle budget still holds.** Main chunk < 150 KB gz. All bulk-upload code is a dynamic import off the `/upload/bulk` route boundary; the existing `/upload` single-file flow must not grow by more than 1 KB gz.

### 9.1 — Input: folder drop + path-aware metadata inference

- [ ] **Route:** `/upload/bulk` (desktop-primary; on mobile, shows a "this feature works best on a computer — here's how to start it" splash plus a read-only view of any in-progress job).
- [ ] **Folder picker:** `<input type="file" webkitdirectory multiple>` (Chromium, Safari, Firefox all support this despite the vendor prefix) **and** a drag-and-drop zone using the **File System Access API** (`DataTransferItem.getAsFileSystemHandle()` / `FileSystemDirectoryHandle` where available) so the browser walks the tree without a flat picker. Fall back to `webkitRelativePath` on the `File` objects when FS Access is unavailable.
- [ ] **`lib/bulkIngest.js` — `walkFolderHandle(handle)`** — async iterator yielding `{ file, relativePath }`. Skips: dotfiles, `__MACOSX/`, `Thumbs.db`, anything not ending in `.pdf` (case-insensitive). Emits a `rejected` record for non-PDFs so the user sees them in the queue UI rather than wondering why 12 files vanished.
- [ ] **`lib/pathInfer.js` — `inferFromPath(relativePath, batchPreset)`** — pure function. Given `"KTU/CSE/S4/2023/Main/CS301-DataStructures.pdf"` and a batch preset `{ institution: { qid: 'Q...', label: 'KTU' } }`, returns a partial metadata object:
  - `program` ← first non-institution segment (`CSE`, `ECE`, `ME`, `BTech CS`, etc.) — normalised against a small built-in alias table (`CSE → B.Tech Computer Science`).
  - `semester` ← regex `\bS([1-8])\b` or `\bSem([1-8])\b` in any path segment.
  - `year` ← first 4-digit number in `[1990, currentYear + 1]`.
  - `month` ← month name or `Apr|May|Nov|Dec` abbrev in any segment.
  - `examType` ← segment matching the 9-item canonical list (case-insensitive, same keyword map as `metadataExtract.js` §8.5 so OCR and path rules agree).
  - `courseCode` + `courseName` ← from the **filename** (not path) via `parseFilename("CS301-DataStructures.pdf")` which accepts separators `-`, `_`, ` ` and extracts a leading code (via the Phase 8 regex) + a trailing name.
  - Every inferred field carries a `source: 'path' | 'filename' | 'preset'` tag so the review UI can show where each value came from.
- [ ] **Pure-function test coverage:** Unit tests in `tests/pathInfer.test.js` cover at least: `KTU/CSE/S4/2023/Main/CS301-DataStructures.pdf`, `Calicut University/B.Sc Physics/Sem 3/Nov 2021/Supplementary/PHY301.pdf`, `KTU\CSE\S4\2023\CS 301.pdf` (Windows backslashes + space), `papers/2023-cs301.pdf` (no institution segment — falls back entirely to preset).

### 9.2 — Batch preset screen (pre-flight)

Single screen the user fills **once** before the queue starts. Pre-fills any field an unambiguous path-scan found for **all** files; otherwise leaves blank.

- [ ] **Institution** (required) — same `InstitutionSearch` bottom-sheet/autocomplete used in single-file upload. One institution per batch; mixing institutions is not supported in v1 (documented in the review screen).
- [ ] **Default program** — optional. Used only when `pathInfer` returns nothing for `program`.
- [ ] **Default examType** — optional. Used when neither path nor OCR yielded one.
- [ ] **Default language** — defaults to `en`; same chip set as single-file upload.
- [ ] **Year range guardrail** — `[min, max]`. Any file whose inferred year falls outside the range is sent straight to the mandatory review pile. Default range: `[2000, currentYear]`.
- [ ] **Concurrency slider** — 1 to 5 simultaneous uploads, default **3**. Stored in `localStorage` under `quarchive.bulk.concurrency`.
- [ ] **Dedup policy** — radio: (a) *Skip silently* (default), (b) *Skip and log*, (c) *Abort whole batch on first duplicate*. Applies to identifier collision **and** content-hash match on the existing Archive.org item.
- [ ] **Dry run toggle** — when on, runs layers 1 and 2 of dedup + identifier construction for every file and produces a report, but issues **zero** PUTs. Used for sanity-checking a large folder before committing.

### 9.3 — Queue engine

- [ ] **`lib/bulkQueue.js`** — a small state machine, no framework dependency. Per-file states:

  ```
  pending → validating → hashing → extracting → dedup-checking →
    ├─ needs-review        (missing required fields, year out of range, OCR empty + path ambiguous)
    ├─ duplicate           (layer 2 or layer 3 matched)
    ├─ ready
    │    └─ uploading → done | failed
    └─ rejected            (non-PDF, corrupt, > 50 MB, > 3 retries)
  ```

- [ ] **Concurrency control** — a hand-rolled promise pool, not `Promise.all`. Limit defaults to 3; the pool picks up the next `ready` file whenever a slot frees. Files in `needs-review` block themselves — they don't consume a slot until the user resolves them.
- [ ] **Retries** — each failed PUT retries with exponential backoff (`1s, 4s, 15s`) up to 3 attempts before moving to `failed`. 429 / 503 responses honour `Retry-After` if present. 401 aborts the whole batch immediately (session expired) and prompts re-login without losing queue state.
- [ ] **Per-file progress** — upload byte progress via `fetch` + `ReadableStream` where available; falls back to "indeterminate spinner + file-level done/pending" when streaming isn't feasible.
- [ ] **Pause / resume / cancel** — user-facing controls at the batch level. Cancel stops new files from starting; in-flight files are allowed to finish (cancelling a PUT mid-stream leaves Archive.org in an indeterminate state, which defeats the dedup invariant).
- [ ] **Queue persistence (`lib/bulkPersist.js`)** — IndexedDB store `quarchive.bulk.v1` with object stores `jobs` (job metadata + preset + timestamps) and `items` (one record per file: `relativePath`, `size`, `hash`, `identifier`, `status`, `retries`, `lastError`, `metadata`). Writes are debounced to one flush per 250 ms per job. On app load, if a job exists with any non-terminal items, the bulk page offers "Resume 47 pending uploads from Tuesday"; the original `File` objects are gone (browser can't persist them), so resume re-prompts the user to re-select the same root folder and matches by `relativePath` + `size` + `hash` before re-queueing.

### 9.4 — Per-file OCR strategy (budget-aware)

OCR is valuable for bulk (fills `courseName` / `courseCode` / `examType` where path-inference was silent) but it's the single biggest cost in the pipeline. Rules:

- [ ] **Path-first, OCR-as-tiebreaker.** If `pathInfer` produced `courseCode` **and** `examType` with high confidence, **skip OCR** for that file. Saves seconds × N.
- [ ] **OCR only the first page.** Overrides the `maxPages: 2` single-file default. Bulk ingesters care about headers, not content.
- [ ] **Serial OCR, not parallel.** Single shared scribe.js worker from Phase 8, reused across the whole batch, with a hard **8 s per-file timeout** (down from the 15 s single-file budget). Timeout → proceed with path/preset values only.
- [ ] **OCR ↔ path disagreement resolution:** if both produced a value for the same field and they differ, path-inferred value wins for `program` / `semester` / `year`; OCR wins for `courseName` / `courseCode`. Rationale: folder structure is an artifact of how the contributor organised files (authoritative on program/semester); what's written on the paper is authoritative on the paper's actual title.
- [ ] **`ocr-assist` header** continues to list which fields OCR populated (§11, Phase 8) so post-hoc we can still see bulk-vs-single OCR contribution.

### 9.5 — Review pile (mandatory human pass for ambiguous files)

Files enter the review pile when any of:
- No `courseCode` after path + filename + OCR.
- Inferred year outside the preset range.
- Identifier collision in layer 2 dedup **and** policy is not "skip silently".
- `examType` could not be determined and batch preset left it blank.
- Hash computation or PDF parse failed.

- [ ] **Review UI — `BulkReview.jsx`** — a virtualised table (one row per file, `react-window` or hand-rolled intersection-observer pagination) with: thumbnail (first-page render via `pdfjs-dist`, cached), inferred metadata as editable fields, a "source" badge per field (`path` / `filename` / `ocr` / `preset` / `you`), and a "Skip this file" button.
- [ ] **Bulk-edit affordances** — select multiple rows → apply a field value to all. Essential when 30 files in one folder all need the same `examType` override.
- [ ] **"Approve all remaining"** — only enabled when every selected row has `institution + courseCode + year + examType` non-empty. Flips those rows to `ready` and the queue engine picks them up automatically.

### 9.6 — Dedup behaviour for bulk

All three layers from CLAUDE.md §12 run per file, but with batch-specific UX:

- [ ] **Layer 1 (hash):** computed in a Web Worker (`hashWorker.js` from Phase 5). Files > 10 MB already use the worker; bulk forces all files through the worker regardless of size so the main thread stays responsive with the review UI open.
- [ ] **Layer 2 (identifier check):** one GET to `archive.org/metadata/{identifier}` per file. Cached per-session in a `Map` keyed by identifier so re-runs of the same batch (e.g. after fixing a preset typo) don't re-hit Archive.org for already-known items.
- [ ] **Layer 3 (IAS3 `x-archive-meta-sha256`):** unchanged from single-file upload; the existing `functions/api/upload.js` worker already handles it.
- [ ] **Cross-file dedup within the batch itself:** two files in the same folder with identical SHA-256 (common when someone has both `CS301.pdf` and `CS301 (copy).pdf`) collapse to a single upload. The duplicate is marked `duplicate` with `duplicateOf: <relativePath>` in its queue record.

### 9.7 — Reporting & audit

- [ ] **Live summary bar** at the top of the bulk page: `✅ 42 done · ⏳ 3 uploading · ⏸ 17 pending · ⚠ 5 review · 🚫 2 skipped · ❌ 1 failed`.
- [ ] **Downloadable report** — a single `quarchive-bulk-YYYYMMDD-HHMM.csv` the user can save at any point (during or after the batch). Columns: `relativePath, size, sha256, identifier, status, examType, courseCode, courseName, year, institutionQid, archiveUrl, error`. No telemetry; the file is generated client-side from the IndexedDB job record.
- [ ] **Visible Archive.org links** — completed rows show a `→ archive.org/details/{identifier}` link so the contributor can spot-check uploads landed correctly.

### 9.8 — Testing

- [ ] **Unit tests — `tests/pathInfer.test.js`** — at least 15 cases covering the scenarios listed in §9.1, plus edge cases (empty path, root-level file, only-filename, unicode path segments, mixed case institution aliases).
- [ ] **Unit tests — `tests/bulkQueue.test.js`** — concurrency is honoured (fire 10 fake uploads with limit=3, assert max 3 concurrent at any tick), retries back off correctly, 401 aborts the whole batch, pause/resume preserves ordering, cross-file hash dedup collapses identical files.
- [ ] **Playwright — `tests/bulk.spec.js`** — desktop viewport. Drop a fixture folder of 8 PDFs (mix of: valid path+filename, valid filename only, missing examType, intentional duplicate of one other, non-PDF). Mock `/api/upload` and `archive.org/metadata/*` as in CLAUDE.md §23. Assert: 6 uploaded, 1 marked duplicate, 1 sent to review, 0 uploaded during dry-run mode, CSV export contains 8 rows.
- [ ] **Playwright — persistence** — start a batch, kill the page mid-upload, reload, assert the resume prompt appears and no completed files are re-uploaded.
- [ ] **Playwright — mobile** — assert `/upload/bulk` shows the "use a computer" splash on `devices['Pixel 5']` and does not expose the folder picker.

### 9.9 — Bundle & performance discipline

- [ ] **Dynamic import boundary:** all bulk code (`lib/bulkIngest.js`, `lib/pathInfer.js`, `lib/bulkQueue.js`, `lib/bulkPersist.js`, `components/bulk/**`) lives behind a `React.lazy` route split on `/upload/bulk`.
- [ ] **`react-window` (or equivalent) for the review table** — never render 200 rows to the DOM at once.
- [ ] **Measured bundle impact:** single-file `/upload` chunk growth ≤ 1 KB gz (ideally 0). Bulk-route chunk target ≤ 25 KB gz.
- [ ] **Memory ceiling** — during a 200-file × 5 MB batch, heap must stay under 200 MB on mid-tier hardware. Achieved by (a) never holding all `File` bodies at once — reach for `File.slice()` / `ReadableStream` during hash + upload, (b) evicting the pdfjs-rendered thumbnail cache on an LRU beyond 20 entries.

### 9.10 — Exit Criteria

1. [ ] A contributor can drop a folder of 50 real KTU PDFs and end up with 50 (minus true duplicates) items on Archive.org, all tagged `subject: quarchive`, correctly attributed to the right institution QID, with correct `courseCode` / `examType` / `year` on each.
2. [ ] Identifier byte-identity (Phase 8 invariant 15) is preserved: a file whose path yields `CS 301` and one whose OCR yields `cs301` both land at identifier slug `--cs301--`.
3. [ ] Closing the tab mid-batch and reopening it the next day resumes the job without re-uploading any completed file.
4. [ ] The three dedup layers are verifiable via the CSV export: every `status: done` row has a unique `sha256` and a unique `identifier`; every `status: duplicate` row points at either another row's identifier or an Archive.org item discovered via layer 2.
5. [ ] Dry-run mode issues zero PUTs against mocked `/api/upload` in the Playwright suite.
6. [ ] Main-chunk bundle growth from Phase 8 ≤ 1 KB gz. Bulk-route chunk ≤ 25 KB gz.
7. [ ] Mobile `/upload/bulk` shows the read-only splash and does not offer a folder picker.
8. [ ] No regression to the single-file `/upload` flow — every Phase 1–8 Playwright spec still passes unchanged.

### 9.11 — Explicit non-goals (v1)

- **Mixing institutions in one batch.** Users with multi-institution archives run the bulk tool once per institution. Documented in the review screen.
- **ZIP / RAR ingestion.** The folder picker + drag-drop tree walk covers 99% of real-world cases and avoids shipping a client-side archive extractor.
- **Scheduled / background uploads.** Out of scope until the PWA work in Phase 10 (formerly Phase 7 backlog) lands a service worker.
- **Server-side coordination.** Two tabs running the same batch concurrently will double-upload; we document this and accept it rather than adding a locking server.
- **Editing files after upload.** Once a file lands on Archive.org, fixing its metadata is an Archive.org-side operation (their Item Manager UI). Quarchive does not proxy metadata edits.

---

## Phase 10 — Branding: Quackademic the Duck *(deferred)*

> **Status: deferred.** The branding work described below is a full plan of record but is explicitly paused. Both Phase 9 (Bulk Upload) and Phase 10 (Branding) are on hold — branding is polish and should not be started until the bulk-upload path lands, and bulk upload itself is parked. Do not pick up branding tasks opportunistically.

**Goal:** Give Quarchive a distinct, memorable visual identity built around the pun at the heart of the name — **Quack** + **Archive**. The mascot is **Quackademic**, a scholarly duck who keeps papers safe. Applies to logo, favicon, navigation, empty states, OG image, and README hero. Must respect the existing mobile-first, editorial aesthetic (CLAUDE.md §2).

**Non-negotiable constraints:**
1. All brand assets live under `public/brand/` and are **committed** to the repo (so deploys are reproducible without a build step that calls an image model).
2. `Generate.md` is **gitignored** — it contains the prompts each maintainer feeds to Google Gemini ("Nano Banana") to regenerate assets. It is not a source of truth; the committed PNG/SVG files under `public/brand/` are.
3. Bundle size rule from Phase 8 still holds: main chunk < 150 KB gz. SVG logos must be inlined only if < 2 KB each; everything else is a `<img src="/brand/…">` fetch.
4. Mobile-first: the mascot must read clearly at 24×24 px (bottom-nav icon) and at 32×32 px (favicon). Every logo variant ships with a simplified silhouette form.
5. Colour palette is additive, not replacing: the existing neutral base stays; Duck Yellow (`#F5C518`) becomes the single accent. No rainbow.

### Colour tokens

| Token | Hex | Role |
|---|---|---|
| `duck-yellow` | `#F5C518` | Primary accent / CTA / bill |
| `pond-ink` | `#1A1D24` | Headings, strong text, logo outline |
| `paper-cream` | `#FAF6EE` | Page background |
| `reed` | `#6B7A5A` | Muted secondary / metadata |

Wire these into Tailwind v4 `@theme` in `src/styles/index.css` as `--color-duck-yellow`, `--color-pond-ink`, `--color-paper-cream`, `--color-reed`.

### 10.1 — Asset generation (via `Generate.md`)

- [ ] Write `Generate.md` (gitignored) containing one clearly-labelled prompt per asset, with explicit style guardrails ("flat editorial illustration, off-white background, no gradients, no 3D, no photorealism, single warm-yellow accent").
- [ ] Generate the following with Gemini Nano Banana and save under `public/brand/` with these exact filenames:
  - `wordmark.svg` — "Quarchive" wordmark, `Q` stylised as a duck head in profile.
  - `wordmark-mono.svg` — single-colour (pond-ink) variant for light/dark contexts.
  - `duck-mark.svg` — square mascot mark (Quackademic on paper stack). Readable at 24 px.
  - `duck-silhouette.svg` — 1-colour duck-head silhouette for favicons and loading states.
  - `icon-192.png`, `icon-512.png` — PWA icons (square, solid paper-cream background).
  - `favicon.svg` — thin-line duck head, copied to `public/favicon.svg` (replacing the Vite default).
  - `apple-touch-icon.png` — 180×180, paper-cream background.
  - `og.png` — 1200×630 social share card: wordmark centre, duck left, tagline "Every paper. Every quack." right.
  - `readme-hero.png` — 1440×560 README banner.
  - `duck-empty.svg` — "no results" illustration (duck looking into an empty drawer).
  - `duck-404.svg` — "not found" illustration (duck holding a blank paper with a `?`).
  - `duck-uploading.svg` — optimistic state for `StepUpload.jsx`.
- [ ] Manually pass each PNG through `oxipng` / `svgo` before committing. Target: favicon < 2 KB, og.png < 80 KB, hero < 120 KB.

### 10.2 — Wire assets into the app

- [ ] `index.html` — replace default favicon with `/favicon.svg`; add `apple-touch-icon`; add `<meta name="theme-color" content="#F5C518">`; add OG tags pointing at `/brand/og.png`.
- [ ] `src/components/layout/Navbar.jsx` — replace text-only header with `wordmark.svg` on desktop.
- [ ] `src/components/layout/BottomNav.jsx` — central Upload CTA uses `duck-silhouette.svg` at 24 px, duck-yellow background ring when active.
- [ ] `src/components/search/PaperCard.jsx` — fallback thumbnail when no PDF preview yet is `duck-silhouette.svg` tinted `reed`.
- [ ] `src/pages/Home.jsx` — hero section: wordmark + tagline "Every paper. Every quack." Replace any placeholder hero copy.
- [ ] `src/pages/Browse.jsx` — empty-state uses `duck-empty.svg` with copy "No papers yet. *Be the first duck to drop one here.*"
- [ ] Add a catch-all 404 page (`src/pages/NotFound.jsx`) using `duck-404.svg`.
- [ ] `src/pages/About.jsx` — add a "Meet Quackademic" section under the existing Privacy / AGPL-3.0 credit block, with the mascot mark and a one-paragraph origin story.
- [ ] `src/components/upload/ScanFAB.jsx` — replace the `📷` emoji with the duck silhouette + bill in duck-yellow. Preserves the 48 px minimum tap target from §2.

### 10.3 — Voice & copy

- [ ] Primary tagline everywhere marketing-facing: **Every paper. Every quack.**
- [ ] Short-form CTA on upload: **Scan. Quack. Archive.**
- [ ] Error copy leans into the duck without being twee: e.g. upload failure → *"That one slipped past the duck. Try again?"* (no emoji spam; one per message max).
- [ ] Loading states may use the duck but must not animate distractingly on slow connections — a 2-frame wing-flap at 1 fps max, CSS-only, `prefers-reduced-motion: reduce` disables it entirely.

### 10.4 — Tailwind / CSS wiring

- [ ] Extend `@theme` in `src/styles/index.css` with the four colour tokens above.
- [ ] Audit existing accent usages and migrate them to `bg-duck-yellow` / `text-duck-yellow` — there must be exactly **one** accent hue site-wide after migration.
- [ ] Add a `.duck-card` utility (warm-cream background, `reed` border, soft shadow) for PaperCard and empty states.

### 10.5 — Exit Criteria

1. [ ] Every page in the app uses the wordmark or the duck mark somewhere above the fold.
2. [ ] Favicon + OG image verified in (a) Chrome mobile, (b) Safari iOS (apple-touch-icon), (c) Twitter Card validator, (d) LinkedIn post inspector.
3. [ ] All Phase 10 assets live under `public/brand/` with the exact filenames listed in 10.1. `Generate.md` is present locally and listed in `.gitignore`.
4. [ ] Main JS bundle growth from Phase 9 ≤ 2 KB gz (brand assets are static files, not JS).
5. [ ] `prefers-reduced-motion: reduce` disables all duck animations.
6. [ ] Lighthouse accessibility ≥ 95 on Home and Upload (accent contrast check passes: Duck Yellow on Pond Ink ≥ 7:1).

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
