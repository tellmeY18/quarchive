# ROADMAP.md — PYQP Platform

> Ordered by dependency. Each phase must be complete and stable before the next begins.
> Agents and contributors: work one phase at a time. Do not skip ahead.

---

## Current Status: Phase 5 Complete ✅

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

## Phase 6 — Future / Backlog

*Not sequenced. Pick up after Phase 5 ships.*

- [ ] PWA: `manifest.json` + service worker. Offline access to viewed papers. Background upload queue (scan offline, upload when connected).
- [ ] Auto-detect paper orientation; auto-rotate pages before PDF assembly.
- [ ] Edge detection / document crop: `<canvas>` perspective transform to correct skewed captures.
- [ ] Malayalam / regional language UI localisation.
- [ ] "Papers near your university" via OpenStreetMap Nominatim geolocation.
- [ ] GitHub Action: refresh Wikidata SPARQL cache periodically.
- [ ] Archive.org 2FA support (graceful fallback to manual S3 key entry).
- [ ] Paper request feature: students can request papers they need (stored as GitHub Issues via API).

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
