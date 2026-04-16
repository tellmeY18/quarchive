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
│   │   ├── useCamera.js             ← getUserMedia, torch, orientation ★ NEW
│   │   └── useImageToPdf.js         ← pdf-lib image assembly + compression ★ NEW
│   ├── lib/
│   │   ├── archiveOrg.js
│   │   ├── wikidata.js              ← Institution data via Wikidata SPARQL (no local seed file)
│   │   ├── dedup.js
│   │   ├── metadata.js
│   │   └── imageToPdf.js            ← Core conversion logic (pdf-lib) ★ NEW
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Upload.jsx
│   │   ├── Paper.jsx
│   │   ├── Browse.jsx
│   │   └── About.jsx
│   ├── store/
│   │   ├── authStore.js
│   │   ├── wizardStore.js
│   │   └── cameraStore.js           ← Captured pages state ★ NEW
│   └── styles/
│       └── index.css
├── functions/
│   └── api/
│       ├── login.js
│       ├── s3keys.js
│       └── upload.js
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

## 6. Upload Wizard — Updated Step Flow

```
Step 0 — Source Selection  (StepSource.jsx)      ★ NEW FIRST STEP
Step 1 — Capture / File    (Camera or fallback)
Step 2 — Metadata Form     (StepMetadata.jsx)
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

## 7. Zustand State — `cameraStore.js` ★ NEW

```javascript
{
  capturedPages: [],     // Array of { id, blob, dataUrl, timestamp }
  isCapturing: false,    // Camera UI open
  reviewMode: false,     // PageReview screen open
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
| Course code | `course-code` | `CS301` | Custom field |
| Degree/program | `program` | `B.Sc Computer Science` | Custom field |
| **Source** | **`source`** | **`camera-scan`** / `pdf-upload` | **★ NEW — tracks upload method** |

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
| **Camera stream** | **Stop stream immediately on unmount — never leave open in background** |
| Stats strip | Fetch once on app load, cache in component state |
| **Initial JS bundle** | **Keep < 150KB gzipped. Camera and pdf-lib are dynamic imports.** |

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

---

## 22. Open Questions / Future Work

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
