# CLAUDE.md — Previous Year Question Papers (PYQP) Platform

> This is the authoritative reference for any developer or AI working on this codebase.
> Read this in full before writing code, making decisions, or modifying any existing pattern.

---

## 1. Project Identity

**What this is:**
A serverless, open-source platform for students to discover and upload previous year university exam question papers — designed to be used **on the go, entirely from a mobile phone**.

**What this is NOT:**
- A hosting service for textbooks, notes, or copyrighted material
- A platform requiring a central database or user registration on our side
- A scraper or aggregator of third-party content
- A desktop-first application

**Core Philosophy — four constraints, always simultaneously:**
1. **Zero ongoing cost** — no servers, no paid APIs, no databases
2. **Permanent availability** — content outlives the project
3. **Open infrastructure** — no proprietary lock-in; every layer is replaceable
4. **Mobile-native UX** — every interaction must work one-handed, on a 6-inch screen, over a slow connection

---

## 2. UI Design Reference — gpura.org + Mobile-First Mandate

The visual design is inspired by **https://gpura.org** (Kerala Digital Archive / Granthappura), **adapted heavily for mobile**.

### Design Language

| Attribute | Direction |
|---|---|
| Aesthetic | Editorial archive — clean, typographic, document-first |
| Tone | Institutional but approachable; academic without being sterile |
| **Primary viewport** | **Mobile (≤ 430px). Desktop is secondary.** |
| Layout | Single-column by default; bottom-anchored CTAs; thumb-reachable tap targets (min 48×48px) |
| Typography | Bilingual-ready (English + Malayalam/regional scripts); large body text (min 16px base) |
| Color palette | Neutral base (off-white / warm white background); one restrained accent color; muted grays for metadata |
| Imagery | Thumbnail previews of paper pages; no decorative stock photos |
| Navigation | Bottom nav bar on mobile (Home, Browse, Upload, About); top nav only on desktop |
| Stats bar | Compact counter strip — scrolls horizontally on mobile |
| Item cards | Full-width on mobile; 2-column tablet; 3-column desktop |
| Footer | Minimal — hidden on mobile (links moved to bottom nav / About page) |

### Mobile-Specific UI Rules

1. **No hover states as the only affordance** — every interactive element must work on tap.
2. **Bottom sheet modals** — never centered overlays on mobile. Sheet slides up from the bottom.
3. **Large tap targets** — buttons ≥ 48px tall, form inputs ≥ 44px tall.
4. **Upload CTA is always visible** — sticky "📷 Scan Paper" FAB (floating action button) on every page when logged in.
5. **No horizontal scroll** — except the stats strip.
6. **Camera access prompt is the first thing a new user sees on the Upload screen**, not a file picker.

---

## 3. Tech Stack

### Frontend
| Layer | Choice | Reason |
|---|---|---|
| Framework | React 19 (Vite 8, SPA) | Cloudflare Pages ecosystem; large component ecosystem |
| Styling | Tailwind CSS v4 | Utility-first; mobile-first breakpoints; CSS-first config via `@theme` |
| Routing | React Router v7 (library mode) | Declarative; works on static hosting with `_redirects` |
| State | Zustand v5 | Lightweight; no boilerplate; ideal for auth + wizard state |
| HTTP | Native `fetch` | No axios; keep bundle lean |
| **Image → PDF** | **`pdf-lib` + `browser-image-compression`** | Client-side only; no server; converts captured photos to a single PDF |
| **Camera capture** | **`mediaDevices.getUserMedia` / `<input capture="environment">`** | Native browser API; no library needed; falls back to file picker on desktop |
| **Edge detection + perspective warp** ★ Phase 8 | **OpenCV.js (WASM) _or_ pure-canvas Sobel/Hough (decided during 8.1 spike)** | Detects the paper quad in each captured frame, warps it to a clean rectangle — no squished/trapezoidal pages. Dynamic import only. |
| **Image enhancement** ★ Phase 8 | **Pure-canvas pipeline in `lib/paperEnhance.js`** | Greyscale → Sauvola-style adaptive threshold → gentle contrast stretch. Colour-preserving by default. Runs in `OffscreenCanvas`. |
| **On-device OCR** ★ Phase 8 | **`scribe.js-ocr`** | Runs Tesseract-backed OCR inside a Web Worker on the first 1–2 PDF pages to extract `courseName` / `courseCode` / `examType` suggestions. **AGPL-3.0** — credited in `About.jsx`. All WASM + language data served from `public/vendor/scribe/` (same-origin requirement). |
| PDF preview | `pdfjs-dist` | Lazy-loaded only on paper detail pages |
| Fonts | `@fontsource` packages | Self-hosted; no Google Fonts CDN dependency |

### Infrastructure
| Purpose | Service | Notes |
|---|---|---|
| Hosting | Cloudflare Pages | Free tier; global CDN; native Worker integration |
| CORS proxy | Cloudflare Pages Functions | `/functions/api/` — proxies IAS3 PUT + Archive.org auth |
| File storage | Archive.org IAS3 | Permanent; free for educational content |
| Search | Archive.org Advanced Search API | CORS-friendly GET; JSON output |
| Institution data | Wikidata SPARQL | Canonical institution identifiers (Q-numbers) |

**No proprietary services. No databases. No auth servers on our side.**

---

## 4. Repository Structure

```
pyqp/
├── CLAUDE.md
├── public/
│   ├── _redirects                   ← SPA fallback: /* /index.html 200
│   └── robots.txt
├── src/
│   ├── main.jsx
│   ├── App.jsx                      ← Router root
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx           ← Top bar (desktop only)
│   │   │   ├── BottomNav.jsx        ← Mobile bottom navigation ★ NEW
│   │   │   ├── Footer.jsx           ← Desktop only
│   │   │   └── StatsStrip.jsx       ← Horizontal scroll on mobile
│   │   ├── search/
│   │   │   ├── SearchBar.jsx
│   │   │   ├── FilterChips.jsx
│   │   │   ├── PaperCard.jsx        ← Full-width on mobile
│   │   │   └── PaperGrid.jsx
│   │   ├── auth/
│   │   │   ├── LoginSheet.jsx       ← Bottom sheet (replaces modal on mobile) ★ RENAMED
│   │   │   ├── LoginForm.jsx
│   │   │   └── AuthStatus.jsx
│   │   ├── upload/
│   │   │   ├── ScanFAB.jsx          ← Floating "📷 Scan Paper" button ★ NEW
│   │   │   ├── CameraCapture/
│   │   │   │   ├── index.jsx        ← Camera UI root ★ NEW
│   │   │   │   ├── Viewfinder.jsx   ← Live camera feed + capture button ★ NEW
│   │   │   │   ├── PageReview.jsx   ← Review/retake each captured page ★ NEW
│   │   │   │   └── PdfPreview.jsx   ← Preview assembled PDF before upload ★ NEW
│   │   │   ├── UploadWizard/
│   │   │   │   ├── index.jsx        ← Multi-step wizard root
│   │   │   │   ├── StepSource.jsx   ← Choose: Camera (default) or Upload PDF ★ NEW
│   │   │   │   ├── StepMetadata.jsx ← Paper metadata form (mobile-optimised)
│   │   │   │   ├── StepDedupCheck.jsx
│   │   │   │   └── StepUpload.jsx
│   │   │   └── InstitutionSearch.jsx
│   │   └── paper/
│   │       └── PdfViewer.jsx
│   ├── hooks/
│   │   ├── useArchiveAuth.js
│   │   ├── useArchiveSearch.js
│   │   ├── useWikidataLookup.js
│   │   ├── useFileHash.js
│   │   ├── useUpload.js
│   │   ├── useCamera.js             ← getUserMedia, torch, orientation
│   │   ├── useImageToPdf.js         ← pdf-lib image assembly + compression
│   │   └── useOcrPrefill.js         ← Scribe.js OCR on first 1–2 pages ★ Phase 8
│   ├── lib/
│   │   ├── archiveOrg.js
│   │   ├── wikidata.js              ← Institution data via Wikidata SPARQL (no local seed file)
│   │   ├── dedup.js
│   │   ├── metadata.js
│   │   ├── imageToPdf.js            ← Core conversion logic (pdf-lib)
│   │   ├── documentDetect.js        ← Paper-quad detection (edge detection) ★ Phase 8
│   │   ├── perspectiveWarp.js       ← Warp detected quad to clean rectangle ★ Phase 8
│   │   ├── paperEnhance.js          ← Adaptive threshold + contrast pipeline ★ Phase 8
│   │   ├── capturePipeline.js       ← Orchestrates detect → warp → enhance per shutter press ★ Phase 8
│   │   ├── scribeClient.js          ← Thin wrapper around scribe.js-ocr ★ Phase 8
│   │   └── metadataExtract.js       ← OCR text → { courseName, courseCode, examType } ★ Phase 8
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Upload.jsx
│   │   ├── Paper.jsx
│   │   ├── Browse.jsx
│   │   └── About.jsx
│   ├── store/
│   │   ├── authStore.js
│   │   ├── wizardStore.js
│   │   └── cameraStore.js           ← Captured pages + crop/enhance state
│   ├── workers/
│   │   ├── hashWorker.js
│   │   └── ocrWorker.js             ← Dedicated worker hosting scribe.js ★ Phase 8
│   └── styles/
│       └── index.css
├── functions/
│   └── api/
│       ├── login.js
│       ├── s3keys.js
│       └── upload.js
├── public/
│   └── vendor/
│       └── scribe/                  ← scribe.js WASM + language data ★ Phase 8
│                                      (copied here by postinstall; served same-origin)
├── vite.config.js
└── package.json
```

---

## 5. Primary Upload Flow — Camera Capture (Mobile-Native)

> **This is the default and primary way users contribute.** PDF file upload is a fallback for edge cases (scanned PDFs already on device, desktop users).

### User Journey — Happy Path

```
Student has a question paper in hand
  │
  └── Taps "📷 Scan Paper" FAB (visible on every page)
        │
        └── If not logged in: LoginSheet slides up → login → sheet closes → camera opens
        │
        └── If logged in: Camera UI opens immediately (full-screen)
              │
              └── Viewfinder shows live rear camera feed
                    │
                    ├── User positions paper, taps shutter ────────────────────────────┐
                    │                                                                   │
                    │   [Page captured → thumbnail appears in tray at bottom]          │
                    │                                                                   │
                    ├── User captures more pages (repeat) ◄──────────────────────────┘
                    │
                    ├── Taps "Done (N pages)"
                    │
                    └── PageReview screen: swipe through captured pages
                          ├── Retake individual pages if needed
                          ├── Reorder pages by drag-and-drop
                          └── Taps "Use These Pages"
                                │
                                └── Processing screen (2–4 seconds):
                                      ① Compress each image (browser-image-compression)
                                      ② Assemble into single PDF (pdf-lib)
                                      ③ Compute SHA-256 hash (Web Crypto)
                                      │
                                      └── StepMetadata form
                                            (pre-fills institution from last session)
                                            │
                                            └── StepDedupCheck (automatic)
                                                  │
                                                  └── StepUpload → Success!
```

### Camera UX Details

**Viewfinder screen (`Viewfinder.jsx`):**
```
┌─────────────────────────────────┐
│ ✕  Scan Question Paper    [⚡]  │  ← close | torch toggle
│─────────────────────────────────│
│                                 │
│   [ live camera feed ]          │
│                                 │
│   ┌─────────────────────┐       │
│   │  Position paper in  │       │  ← guide overlay
│   │  frame              │       │
│   └─────────────────────┘       │
│                                 │
│  [pg1] [pg2]          Page 2    │  ← thumbnail tray
├─────────────────────────────────┤
│                                 │
│         [ ⊙ CAPTURE ]          │  ← large shutter button
│                                 │
│ [← Gallery]       [Done (2) →] │
└─────────────────────────────────┘
```

**PageReview screen (`PageReview.jsx`):**
```
┌─────────────────────────────────┐
│ ← Review Pages         2 of 3  │
│─────────────────────────────────│
│                                 │
│   [ full page image preview ]   │
│                                 │
│─────────────────────────────────│
│  [🗑 Delete]     [↩ Retake]     │
│                                 │
│  ── ●  ○  ○ ──   swipe pages   │
│                                 │
│       [Use These Pages →]       │
└─────────────────────────────────┘
```

### `useCamera.js` — Responsibilities

```javascript
// Responsibilities:
// 1. Request camera permission (rear/environment camera preferred)
// 2. Manage MediaStream lifecycle (start, stop, torch)
// 3. Capture frame as Blob (JPEG, quality 0.92)
// 4. Detect orientation change and adjust video constraints
// 5. Clean up stream on unmount

// Key methods:
// startCamera()    → opens rear camera, returns stream
// captureFrame()   → returns Blob (JPEG)
// toggleTorch()    → on/off (where supported)
// stopCamera()     → releases MediaStream
```

### `useImageToPdf.js` — Responsibilities

```javascript
// Responsibilities:
// 1. Accept array of image Blobs
// 2. Compress each with browser-image-compression (max 1500px, JPEG 0.85)
// 3. Assemble into a single PDF using pdf-lib
//    - Each image = one A4 page, image scaled to fit
// 4. Return PDF as Blob + file size
// 5. Large jobs (>5 pages): show progress via callback

// Key method:
// imagesToPdf(imageBlobs, onProgress?) → Promise<Blob>
```

### `lib/imageToPdf.js` — Core Logic

```javascript
import { PDFDocument } from 'pdf-lib';
import imageCompression from 'browser-image-compression';

export async function imagesToPdf(imageBlobs, onProgress) {
  const pdf = await PDFDocument.create();

  for (let i = 0; i < imageBlobs.length; i++) {
    // 1. Compress
    const compressed = await imageCompression(imageBlobs[i], {
      maxWidthOrHeight: 1500,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85,
    });

    // 2. Embed
    const arrayBuffer = await compressed.arrayBuffer();
    const image = await pdf.embedJpg(arrayBuffer);

    // 3. Add A4 page, scale image to fit
    const page = pdf.addPage([595, 842]); // A4 points
    const { width, height } = image.scaleToFit(595, 842);
    page.drawImage(image, {
      x: (595 - width) / 2,
      y: (842 - height) / 2,
      width,
      height,
    });

    onProgress?.((i + 1) / imageBlobs.length);
  }

  const pdfBytes = await pdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
```

---

## 5A. Capture Robustness Pipeline ★ Phase 8

> After a frame is captured from the camera but **before** it is added to the thumbnail tray, the frame passes through a three-stage pipeline: **detect → warp → enhance**. Every stage is optional and falls back gracefully.

### Stage 1 — `lib/documentDetect.js` (Edge Detection)

**Purpose:** Find the four corners of the paper in the captured frame.

```
detectPaperQuad(imageBitmap) →
  { corners: [tl, tr, br, bl], confidence: 0..1 } | null
```

Implementation choice is finalised during Phase 8.1 spike:
- **Option A — OpenCV.js (WASM):** robust contour detection + `approxPolyDP`. ~9MB WASM, dynamic-imported only when camera opens.
- **Option B — Pure-canvas Sobel + Hough line detection:** ~20KB, less robust on cluttered backgrounds but zero WASM cost.

**Invariants:**
1. Returns `null` when `confidence < 0.6` OR when the quad area is < 60% of the frame area. The caller (Viewfinder) must treat `null` as "keep the raw frame, let the user adjust manually later".
2. **Never silently warps a bad quad.** A squished PDF is worse than an uncropped one.

### Stage 2 — `lib/perspectiveWarp.js` (Perspective Correction)

**Purpose:** Given the four corners, produce a rectangular image.

```
warpToRect(imageBitmap, quad, targetSize) → ImageBitmap
```

- `targetSize` defaults to A4 proportions at 2480×1754 (300dpi equivalent, re-sampled down later by `browser-image-compression`).
- Uses a standard 3×3 homography matrix. Computed in pure JS; warping itself uses OpenCV.js `warpPerspective` if loaded, else a hand-rolled bilinear sampler on `OffscreenCanvas`.
- Aspect-ratio invariant: if the corner geometry implies a ratio wildly different from A4 (e.g. landscape photograph of a square flyer), the target size is recomputed from the quad's actual implied ratio — **never forced to A4**.

### Stage 3 — `lib/paperEnhance.js` (Readability Enhancement)

**Purpose:** Make the text crisper, flatten uneven lighting, preserve colour where meaningful.

Pipeline (pure-canvas, `OffscreenCanvas`):
1. **Greyscale-only probe copy** for analysis — perceptual weights 0.299R + 0.587G + 0.114B.
2. **Skip-early gate:** if Laplacian variance of the probe exceeds a threshold (image is already sharp and evenly lit), return the input unchanged. Over-processing is the #1 way enhancement makes papers less readable.
3. **Sauvola-style adaptive threshold** with window 25px, k=0.2 — flattens uneven lighting.
4. **Optional 3×3 median filter** — only when noise variance on the probe is above threshold.
5. **Contrast stretch** — remap so true-black text → 0, paper background → ~240 (not 255; preserves texture and annotations).

**User-facing toggle** in `PageReview`:
- `Auto` (default) — the pipeline above.
- `B&W document` — force full binarisation (for dark scans / dot-matrix printouts).
- `Colour original` — skip all enhancement (preserve coloured diagrams, stamps, highlighter).

**Performance budget:** capture → warp → enhance for one page must complete in **< 1.5s on mid-range Android** (Snapdragon 6xx class). All image data stays in `ImageBitmap` / `OffscreenCanvas` — no DOM `<img>` round-trips on the hot path.

### Manual Crop — `CropEditor.jsx`

When auto-detection is wrong (or refused), the user taps "Adjust edges" on any thumbnail in `PageReview`. The editor shows:
- The raw captured frame with four draggable corner handles (each handle ≥ 44×44px — mobile-first tap target invariant).
- Handles snap to high-gradient edges when within 20px (gentle assist, never forced — the user can drag anywhere).
- A live-updating preview pane below the editor showing the warped-and-enhanced result (≤ 100ms update).
- `Reset to auto` / `Reset to full frame` buttons — always recoverable.

Per-page crop state is held in `cameraStore.capturedPages[i].crop` as `{ corners: [...], mode: 'auto' | 'manual' | 'none' }` and persists across navigation within the upload flow.

---

## 5B. OCR-Assisted Metadata Prefill ★ Phase 8

> Once the PDF is assembled in `PdfPreview`, we kick off OCR in a Web Worker on the first 1–2 pages. By the time the user reaches `StepMetadata`, suggestions for `courseName`, `courseCode`, and `examType` are typically ready.

### Architecture

```
PdfPreview (PDF assembled)
     │
     ├──▶ useOcrPrefill() triggers ocrWorker.js
     │         │
     │         └──▶ scribe.js-ocr (Tesseract inside)
     │                     │
     │                     └──▶ text + layout returned
     │
     └──▶ wizardStore.ocrSuggestions populated
                   │
                   └──▶ StepMetadata renders ✨ Suggestion pills
```

### `lib/scribeClient.js`

```javascript
// Lazy init. Points scribe at same-origin vendor assets.
await initScribe({ vendorPath: '/vendor/scribe/' })

// Extract text from first N pages of a PDF Blob.
const { text, layout } = await ocrFirstPages(pdfBlob, {
  maxPages: 2,
  language: 'eng',
})
```

**Rules:**
1. `scribe.js-ocr` is loaded only inside `src/workers/ocrWorker.js` — **never** imported by the main bundle.
2. All scribe runtime assets (WASM, `eng.traineddata` / `eng_fast.traineddata`, fonts) are copied from `node_modules` into `public/vendor/scribe/` by a `postinstall` script. This is required because scribe.js in the browser **must** be served same-origin — loading from a CDN is explicitly unsupported by its authors.
3. A single scribe worker instance is reused for all pages of one PDF; it is terminated when the upload wizard unmounts.
4. **OCR budget: 15s total.** If exceeded, abort gracefully and show no suggestions — never block the upload flow.
5. **Silent failure.** If scribe fails to init (low-memory kill on iOS, missing WASM, etc.), log once to console and continue. Users who never saw OCR suggestions should not see an error either.

### `lib/metadataExtract.js`

Pure function; no I/O. Pairs well with unit tests in Node.

```
extractFromOcr(text) → {
  suggestions: { courseName?, courseCode?, examType?, year?, month? },
  confidence:  { courseName: 0..1, courseCode: 0..1, examType: 0..1, ... },
}
```

#### `courseCode` — extraction rules

Target pattern: `[A-Z]{2,4}[ -]?\d{3,4}[A-Z]?` (matches `CS301`, `CS 301`, `CS-301`, `MA1011`, `ECE202A`, `BT-204`).

**Scoring** (highest wins):
- Label-adjacent (`Course Code`, `Subject Code`, `Paper Code`, `Code No`) → **+3**
- Parenthesised, right after a probable course name line → **+2**
- Standalone in header region (top 25% of page 1) → **+1**

Ties broken by position: nearer to page top wins (course codes are typically in the header).

**Normalisation (applied before the value leaves `metadataExtract`):**
1. `.trim()`
2. `.toUpperCase()`
3. Collapse internal whitespace and hyphens: `"CS 301"` / `"cs-301"` → `"CS301"`.

The normalised string is what populates `metadata.courseCode` AND what feeds the slug in `buildIdentifier`. This is what guarantees an OCR-suggested code and a manually-typed `"  cs 301  "` produce **byte-identical** identifiers.

#### `courseName` — extraction rules

- Line immediately above or below the chosen course code, OR a line starting with `Subject:` / `Paper:` / `Course:`.
- Strip trailing punctuation; collapse internal whitespace.
- **Reject** if length < 3 or > 120 chars.
- **Reject** if < 50% of characters are letters (filters out `"Time: 3 Hours, Max Marks: 100"`).
- **Do not auto Title-Case** — preserve source casing (`"B.Tech Data Structures"` stays as-is).

#### `examType` — keyword detection → canonical value

Match case-insensitively with `\b` word boundaries. First match wins using this priority order (most specific first):

| Canonical value | Keyword regex (case-insensitive) |
|---|---|
| `supplementary` | `supplementary` \| `supply exam` \| `supple` |
| `improvement` | `improvement` \| `betterment` |
| `model` | `model( question)? paper` \| `model exam` \| `mock` |
| `end-semester` | `end[- ]?semester` \| `semester end` \| `end sem` \| `ese` |
| `midsemester` | `mid[- ]?semester` \| `mid[- ]?sem` \| `mse` \| `internal assessment` |
| `make-up` | `make[- ]?up` \| `makeup exam` |
| `re-exam` | `re[- ]?exam` \| `re[- ]?test` \| `re[- ]?appear` |
| `save-a-year` | `save[- ]?a[- ]?year` \| `say exam` |
| `main` | `regular` \| `main exam` \| `end of semester` *(only if no stronger match)* |

If no keyword matches, `examType` is left empty — **never guess**.

### `StepMetadata` Integration — Suggestions, Not Auto-Fill

1. **Suggestion chips above each affected field:** `✨ Suggested: CS301 — Use?` with accept (✓) and dismiss (✕) controls.
2. **If a field is already non-empty**, the pill is shown but the field value is NOT overwritten. User agency is preserved.
3. **Slug-safety final check:** when `StepMetadata` builds the preview identifier, it runs the same `trim → toUpperCase → collapse whitespace/hyphens` normalisation on `courseCode` as `extractFromOcr` did. This is the last gate before identifier construction.
4. **No telemetry.** Whether the user accepted or edited a suggestion is local state only; never transmitted.

---

## 6. Upload Wizard — Updated Step Flow

```
Step 0 — Source Selection  (StepSource.jsx)      ★ NEW FIRST STEP
Step 1 — Capture / File    (Camera or fallback)
Step 2 — Metadata Form     (StepMetadata.jsx)    ← OCR suggestions appear here ★ Phase 8
Step 3 — Duplicate Check   (StepDedupCheck.jsx)
Step 4 — Upload            (StepUpload.jsx)
```

### Step 0 — Source Selection (`StepSource.jsx`)

This step is **skipped automatically on mobile** — camera is launched directly. On desktop or when camera permission is denied, this screen appears:

```
┌─────────────────────────────────┐
│  Add a Question Paper           │
│─────────────────────────────────│
│                                 │
│  ┌───────────────────────────┐  │
│  │  📷  Scan with Camera     │  │  ← PRIMARY (full width, prominent)
│  │  Point your camera at     │  │
│  │  the paper pages          │  │
│  └───────────────────────────┘  │
│                                 │
│  ─────────── or ──────────────  │
│                                 │
│  [ 📄 Upload existing PDF ]     │  ← fallback (smaller, secondary)
│                                 │
└─────────────────────────────────┘
```

### Step 2 — Metadata Form (Mobile-Optimised)

On mobile, fields are stacked full-width, inputs are tall (44px+), and the keyboard is managed carefully:

- **Institution search** opens as a full-screen bottom sheet — not an inline dropdown
- **Year / Exam Type** are large tap-target chip selectors — not dropdowns
- **Semester** is a horizontal scrollable chip row
- Form auto-scrolls to keep the focused field above the keyboard

---

## 7. Zustand State — `cameraStore.js`

```javascript
{
  capturedPages: [],     // Array of {
                         //   id, blob, dataUrl, timestamp,
                         //   crop: { corners, mode: 'auto'|'manual'|'none' }, ★ Phase 8
                         //   enhanceMode: 'auto'|'bw'|'colour',               ★ Phase 8
                         // }
  isCapturing: false,    // Camera UI open
  reviewMode: false,     // PageReview screen open
  cropEditing: null,     // id of page currently in CropEditor, or null        ★ Phase 8
  pdfBlob: null,         // Assembled PDF blob (post-conversion)
  pdfSize: 0,            // Bytes
  converting: false,     // image→PDF in progress
  convertProgress: 0,    // 0–1
  cameraError: null,     // 'permission_denied' | 'not_supported' | null
}
```

---

## 8. Updated Zustand State — `wizardStore.js`

```javascript
{
  step: 0,                  // 0=Source, 1=Capture, 2=Metadata, 3=Dedup, 4=Upload
  source: null,             // 'camera' | 'pdf_upload'
  metadata: {
    institution: { label: '', qid: '' },
    program: '',
    courseName: '',
    courseCode: '',
    year: '',
    month: '',
    examType: '',
    semester: '',
    language: 'en',
  },
  // ★ Phase 8 — OCR-assisted prefill
  ocrStatus: 'idle',        // 'idle' | 'running' | 'done' | 'failed'
  ocrSuggestions: {         // Populated by useOcrPrefill after scribe.js finishes
    courseName: null,       //   string | null
    courseCode: null,       //   string | null (already normalised)
    examType: null,         //   one of the 9 canonical values | null
    year: null,
    month: null,
  },
  ocrDismissed: {},         // { [fieldName]: true } — user dismissed the pill
  ocrAccepted: {},          // { [fieldName]: true } — user tapped "Use" on a ✨ pill.
                            //   Serialised at upload time into the `ocr-assist`
                            //   Archive.org metadata header as a sorted, comma-
                            //   separated list of field names (or `none`).
                            //   Local-only state; never transmitted as telemetry.
  pdfBlob: null,            // Set by Upload.jsx once the camera/PDF source has
                            //   produced a Blob. Drives useOcrPrefill — OCR only
                            //   runs once this is populated.
  // ★ end Phase 8
  file: null,               // Final PDF File object (from camera OR upload)
  fileHash: '',
  identifier: '',
  dedupStatus: null,
  duplicateItem: null,
  uploadStatus: null,
  uploadError: null,
}
```

---

## 9. Mobile Navigation — `BottomNav.jsx` ★ NEW

Replaces the top navbar as the primary navigation on mobile (`md:hidden`).

```
┌──────────────────────────────────────────┐
│  🏠 Home  │  🔍 Browse  │  📷  │  ℹ About │
│           │             │ Upload│          │
└──────────────────────────────────────────┘
```

- **Upload tab** is the center CTA — slightly larger icon, accent color
- Tapping Upload when logged out opens LoginSheet first
- Top `<Navbar>` remains for desktop (`hidden md:flex`)

---

## 10. Archive.org Authentication — The Complete System

*(Unchanged from previous version — see full auth flow, Workers, and Zustand store below.)*

### How Archive.org Authentication Works Technically

Archive.org exposes a login endpoint:
```
POST https://archive.org/services/xauthn/?op=login
Content-Type: application/x-www-form-urlencoded

email=user@example.com&password=userpassword&remember=CHECKED
&referer=https://archive.org&login=true&submit_by_js=true
```

On success, Archive.org returns two session cookies:
- `logged-in-user` — authenticated user's email/identifier
- `logged-in-sig` — session signature (acts as the auth token)

These cookies are valid for 1 year. With them, we can:
1. Confirm login was successful
2. Fetch the user's IAS3 S3 keys from `https://archive.org/account/s3.php`
3. Use those keys in `Authorization: LOW {accessKey}:{secretKey}` headers for all uploads

### Why a Cloudflare Worker Is Required for Auth

The xauthn endpoint does not emit CORS headers permitting cross-origin browser requests. The S3 keys page is an authenticated HTML page requiring cookie-based auth. Both operations must be proxied through our Cloudflare Pages Functions.

**No credentials are ever stored on the Worker.** They pass through per-request only.

### Auth State — Zustand Store (`store/authStore.js`)

```javascript
{
  isLoggedIn:   false,
  screenname:   null,
  email:        null,
  accessKey:    null,    // never displayed in UI
  secretKey:    null,    // never displayed in UI
  loginError:   null,
  isLoggingIn:  false,
}
```

### Login UX — `LoginSheet.jsx` (Bottom Sheet on Mobile)

Triggered by tapping Upload or Sign In.

**On mobile:** slides up as a bottom sheet (80vh), dismissable by swipe down or tap outside.
**On desktop:** centered modal overlay (unchanged behavior).

```
┌──────────────────────────────────────────┐
│  ▔▔▔  (drag handle)                      │
│                                          │
│  Sign in with Internet Archive           │
│                                          │
│  Email ______________________________    │
│  Password ___________________________    │
│  ☐ Remember me                           │
│                                          │
│  [ Sign In ]                             │
│                                          │
│  Don't have an account?                  │
│  → Sign up at archive.org ↗              │
│                                          │
│  🔒 Your password goes directly to       │
│  Archive.org. We never store it.         │
└──────────────────────────────────────────┘
```

---

## 11. Core Data Model — Metadata Schema

*(Unchanged)*

### Deterministic Item Identifier

```
quarchive--{wikidata-qid}--{course-code-slug}--{year}--{exam-type}
```

Examples:
- `quarchive--Q874586--cs301--2023--main`
- `quarchive--Q1329528--ma101--2022--supplementary`

### Metadata Fields

| Field | Archive.org Key | Example | Notes |
|---|---|---|---|
| Collection tag | `subject` | `quarchive` | Always present |
| Institution canonical | `subject` | `Q874586` | Wikidata QID |
| Institution display | `creator` | `University of Kerala` | |
| Exam year | `date` | `2023` | ISO year |
| Language | `language` | `en` / `ml` / `hi` | ISO 639-1 |
| Full description | `description` | `B.Sc CS - Data Structures (CS301) - April 2023 Main` | |
| Content hash | `sha256` | `a3f9...` | Web Crypto client-side |
| Exam type | `exam-type` | `supplementary` | Custom field |
| Semester | `semester` | `4` | Custom field |
| Course code | `course-code` | `CS301` | Custom field — always normalised (uppercase, no whitespace/hyphens) before identifier construction |
| Degree/program | `program` | `B.Sc Computer Science` | Custom field |
| **Source** | **`source`** | **`camera-scan`** / `pdf-upload` | Tracks upload method |
| **OCR assist** ★ Phase 8 | `ocr-assist` | `courseCode,examType` \| `none` | Comma-separated list of fields populated via OCR suggestion. For analytics-free visibility into how much OCR helped per item — never tied to user identity beyond the Archive.org uploader. |

---

## 12. Deduplication — Three-Layer Strategy

*(Unchanged — all three layers run before upload)*

### Layer 1 — Content Hash (Client-Side)
```javascript
const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
```

### Layer 2 — Deterministic Identifier Check
```javascript
const res = await fetch(`https://archive.org/metadata/${identifier}`);
// res.ok (200) → duplicate
```

### Layer 3 — IAS3 Checksum Header
Worker appends `x-archive-meta-sha256: {hash}` to the PUT request.

---

## 13. Cloudflare Workers

*(Unchanged — login.js, s3keys.js, upload.js — see previous version for full code)*

---

## 14. Archive.org Search Integration

*(Unchanged)*

Search API, filter patterns, and item URL patterns remain exactly as documented in the previous version.

---

## 15. Wikidata Institution Autocomplete

Local-first from Wikidata SPARQL cache (localStorage 7-day TTL), fresh Wikidata SPARQL fallback. No static seed file. Never queries on every keystroke.

On mobile: the institution search opens as a full-screen bottom sheet with a large search input at the top.

---

## 16. Pages

### `Home.jsx`
```
BottomNav (mobile) / Navbar (desktop)
Hero (short — mobile viewport has no room for tall heroes)
StatsStrip (horizontal scroll on mobile)
SearchBar (full-width, prominent)
FilterChips (horizontal scroll)
PaperGrid (full-width cards on mobile)
```

### `Upload.jsx`
Entry point. On mobile: immediately launches `CameraCapture`. On desktop: shows `StepSource`.

### `Browse.jsx`
Grid of universities / years / exam types. Full-width on mobile.

### `Paper.jsx` — `/paper/:identifier`
Breadcrumb → title → metadata → Download → PdfViewer (lazy).

### `About.jsx`
Mission, how-to (including camera scan flow), open source links.

---

## 17. Routing

| Path | Component | Notes |
|---|---|---|
| `/` | Home | |
| `/browse` | Browse | |
| `/upload` | Upload | Requires login |
| `/paper/:identifier` | Paper | |
| `/about` | About | |

---

## 18. Performance Constraints

| Concern | Rule |
|---|---|
| Search debounce | 300ms |
| Autocomplete debounce | 200ms local; 500ms Wikidata |
| Wikidata cache | `localStorage` 7-day TTL |
| PDF viewer | Lazy-load `pdfjs-dist` on paper routes only |
| File size | 50MB max before upload |
| SHA-256 hashing | Files > 10MB → Web Worker |
| **Image compression** | **`browser-image-compression` with `useWebWorker: true`** |
| **pdf-lib** | **Lazy-import on capture flow only — do not bundle into main chunk** |
| **Edge-detection lib (OpenCV.js or fallback)** ★ Phase 8 | **Dynamic import only; loaded when camera opens, never before** |
| **`scribe.js-ocr`** ★ Phase 8 | **Loaded only inside `ocrWorker.js`, never by the main bundle. Runtime assets served from `/vendor/scribe/` (same-origin, HTTP-cacheable).** |
| **OCR budget** ★ Phase 8 | **15s hard cap per upload. Exceeded → abort silently, no suggestions.** |
| **Capture pipeline per page** ★ Phase 8 | **Detect + warp + enhance < 1.5s on mid-range Android (Snapdragon 6xx).** |
| **Camera stream** | **Stop stream immediately on unmount — never leave open in background** |
| Stats strip | Fetch once on app load, cache in component state |
| **Initial JS bundle** | **Keep < 150KB gzipped. Camera, pdf-lib, edge-detection, and scribe.js are all dynamic imports. Phase 8 must not grow the main chunk by more than 5KB gzipped.** |

---

## 19. Moderation & Scope Enforcement

1. Upload UI states clearly: "Only previous year university exam question papers."
2. Camera scan produces PDF automatically — file type is never in question.
3. PDF upload fallback: validate MIME type + first 4 bytes magic (`%PDF`).
4. All uploads tied to real Archive.org accounts — no anonymous uploads.
5. All items use `subject: quarchive` — off-topic uploads invisible in our UI.

---

## 20. Environment & Build

*(Unchanged)*

### Zero Environment Variables

No environment variables needed. All endpoints are public; credentials pass per-request.

### Local Development

```bash
npm install
npm run dev          # frontend only
npm run dev:full     # with Cloudflare Workers (Wrangler)
```

### Build & Deploy

```bash
npm run build
# Cloudflare Pages auto-deploys dist/ on push to main
```

---

## 21. Invariants — Never Violate These

1. **Never store the user's Archive.org password** — sent once to login Worker, then gone.
2. **Never store credentials server-side** — Workers forward per-request and discard.
3. **Never upload using a shared Archive.org account.**
4. **Always run all three deduplication layers before upload begins.**
5. **The deterministic identifier formula must never change** — foundation of dedup.
6. **Never call Wikidata SPARQL on every keystroke.**
7. **Never accept non-PDF files for upload** — camera scan produces PDF internally; PDF upload is validated by MIME + magic bytes.
8. **Never display the user's password or secret key anywhere.**
9. **Always stop the camera MediaStream on unmount** — leaving it open drains battery and keeps the camera indicator light on.
10. **Camera is always the default on mobile** — never show the file picker first.
11. **Image-to-PDF conversion is always client-side** — never send raw images to any server.
12. **OCR is always client-side** ★ Phase 8 — scribe.js runs in a Web Worker on the user's device. No page image, raw text, or extracted field ever leaves the browser.
13. **OCR never silently auto-fills** ★ Phase 8 — suggestions appear as dismissible pills. A field the user has already typed into is never overwritten.
14. **OCR never blocks the upload flow** ★ Phase 8 — if scribe.js fails or exceeds the 15s budget, the wizard proceeds without suggestions.
15. **`courseCode` is normalised at every entry point** ★ Phase 8 — `trim() → toUpperCase() → collapse whitespace & hyphens`. Whether the value came from OCR, manual typing, or session restore, the resulting identifier slug must be byte-identical.
16. **Auto-crop never distorts aspect ratio** ★ Phase 8 — if the detected quad has confidence < 0.6 or area < 60% of the frame, fall back to the raw frame. A squished PDF is worse than an uncropped one.
17. **Enhancement is reversible per page** ★ Phase 8 — the original warped (or raw) ImageBitmap is kept in memory until the PDF is committed, so the user can switch enhancement modes in `PageReview` without re-capturing.
18. **Third-party WASM / model assets are served same-origin** ★ Phase 8 — scribe.js WASM, Tesseract language data, and any edge-detection WASM live under `public/vendor/…`. No CDN dependency on the upload path.

---

## 23. Playwright E2E Testing Strategy

Because this platform is mobile-first and relies heavily on browser APIs (like the camera) and third-party services (Archive.org, Cloudflare), End-to-End (E2E) testing with Playwright is critical. We prioritize simulating real-world conditions over unit-testing implementation details.

### 1. Mobile-First Emulation
All primary test suites must run using Playwright's mobile device profiles (e.g., `devices['Pixel 5']` and `devices['iPhone 13']`). This ensures we are testing the mobile UI components (`BottomNav`, `LoginSheet`, full-width cards) and touch interactions (swiping, bottom-sheet dismissal), not just the desktop fallbacks.

### 2. Mocking Archive.org APIs
We do not run tests against the live Archive.org production APIs to avoid rate limits and pollution.
- **Search API (`advancedsearch.php`)**: Intercept requests to this endpoint and return a static JSON fixture containing dummy paper metadata.
- **Metadata API (`metadata/:identifier`)**: Mock this for the deduplication check step, returning either a 404 (no duplicate) or a 200 with JSON (duplicate found).

### 3. Mocking Cloudflare Workers
The frontend interacts with Cloudflare Pages Functions (`/functions/api/*`). These should be intercepted at the network level in Playwright:
- **`/api/login`**: Return a mock successful response with fake `accessKey` and `secretKey`, or a 401 for invalid credentials testing.
- **`/api/s3keys`**: Return mock S3 keys to simulate session restoration.
- **`/api/upload`**: Intercept the PUT request. Verify the `Authorization` header and the `x-archive-meta-*` headers are correctly formatted, then return a mock 200 OK. Do not actually upload the generated PDF.

### 4. Mocking `getUserMedia` (Camera Capture)
Testing the "Scan Paper" flow is the most complex part of the suite.
- **Bypassing Permissions**: Configure the Playwright browser context to auto-grant camera permissions using `permissions: ['camera']`.
- **Fake Media Stream**: Use Playwright's launch arguments (e.g., `--use-fake-ui-for-media-stream` and `--use-fake-device-for-media-stream`) to feed a dummy video file or a static color frame to `getUserMedia`.
- **Testing the PDF Pipeline**: By feeding a static image into the fake camera stream, the test can "capture" frames, verify they appear in the `PageReview` tray, and assert that the `pdf-lib` pipeline outputs a Blob of type `application/pdf`.
- **Permission Denied State**: Create a specific test context that explicitly denies camera permissions to verify the fallback UI (prompt to upload PDF instead) appears correctly.

---

## 24. Open Questions / Future Work

- [ ] Verify exact CORS behavior of `archive.org/services/xauthn/?op=login` when proxied through Cloudflare Workers — test first
- [ ] Handle Archive.org accounts with 2FA (show graceful fallback to manual key entry)
- [ ] GitHub Action to refresh Wikidata SPARQL cache periodically
- [ ] Evaluate `advancedsearch.php` rate limits under real traffic
- [ ] Auto-detect paper orientation and rotate pages before PDF assembly
- [ ] Edge detection / document crop using canvas (help users frame papers accurately)
- [ ] "Papers near your university" via OpenStreetMap Nominatim
- [ ] PWA with offline access to previously viewed papers + background upload queue
- [ ] Malayalam / regional language UI localisation
- [ ] Handle poor lighting: suggest torch, show exposure feedback in viewfinder

---

*Architecture: Archive.org IAS3 + Cloudflare Pages Functions + Wikidata*
*UI reference: gpura.org — Kerala Digital Archive (Granthappura), adapted for mobile-first*
*Primary upload method: In-browser camera scan → client-side PDF assembly → Archive.org*
