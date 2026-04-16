# PYQP — Development Roadmap to v0.1.0

> This roadmap takes you from an empty folder to a fully functional v0.1.0 release.
> Every phase builds on the previous. Do not skip phases — each one unblocks the next.
> Cross off items as you go. Sections marked ⚠️ contain known risk areas from CLAUDE.md.

---

## How to Read This Document

- **Phases** are sequential — complete one before starting the next.
- **Tasks** within a phase can often be parallelised, but dependencies are noted inline.
- **⚠️ Risk** markers call out items explicitly flagged as unknowns in CLAUDE.md.
- **Invariants** at the bottom of relevant phases restate the non-negotiable rules.

---

## Phase 0 — Project Scaffolding

> Goal: A working local dev environment and deployed Cloudflare Pages shell. Nothing functional yet — just wiring.

### 0.1 Repository Setup

- [x] Create a new Git repository (`pyqp`)
- [x] Add `.gitignore` (node_modules, dist, .wrangler, .env)
- [x] Copy `CLAUDE.md` into repository root
- [x] Copy this `ROADMAP.md` into repository root
- [x] Create `README.md` with one-paragraph project description and link to Archive.org

### 0.2 Vite + React Initialisation

- [x] Run `npm create vite@latest . -- --template react`
- [x] Confirm dev server starts: `npm run dev` → `http://localhost:5173`
- [x] Install Tailwind CSS v4 for Vite:
  - [x] `npm install -D tailwindcss @tailwindcss/vite`
  - [x] Add `@tailwindcss/vite` plugin to `vite.config.js` (alongside `@vitejs/plugin-react`)
  - [x] Create `src/styles/index.css` with `@import "tailwindcss";`
  - [x] Import `src/styles/index.css` in `src/main.jsx`
  - [x] No `tailwind.config.js` needed — Tailwind v4 uses `@theme` in CSS for customisation
  - [x] No `postcss.config.js` needed — the Vite plugin handles everything
  - [x] Content detection is automatic (scans all non-gitignored files)
- [x] Remove `postcss` and `autoprefixer` dev dependencies if present (not needed with Tailwind v4 Vite plugin)
- [x] Install React Router v7 (library/declarative mode): `npm install react-router`
- [x] Install Zustand v5: `npm install zustand`
- [x] Install Fontsource packages (choose one serif for headings, one sans for body):
  - [x] `npm install @fontsource/lora` (or similar serif — matches gpura.org editorial tone)
  - [x] `npm install @fontsource/inter` (or similar clean sans-serif)
  - [x] Import both fonts in `src/styles/index.css` (e.g. `@import "@fontsource/inter/400.css";`)
- [x] Define font families using `@theme` block in `src/styles/index.css`

### 0.3 Directory Structure

Create the full directory tree from CLAUDE.md §4 as empty placeholder files:

- [x] `src/components/layout/` — `Navbar.jsx`, `Footer.jsx`, `StatsStrip.jsx`
- [x] `src/components/search/` — `SearchBar.jsx`, `FilterChips.jsx`, `PaperCard.jsx`, `PaperGrid.jsx`
- [x] `src/components/auth/` — `LoginModal.jsx`, `LoginForm.jsx`, `AuthStatus.jsx`
- [x] `src/components/upload/UploadWizard/` — `index.jsx`, `StepMetadata.jsx`, `StepDedupCheck.jsx`, `StepUpload.jsx`
- [x] `src/components/upload/` — `InstitutionSearch.jsx`
- [x] `src/components/paper/` — `PdfViewer.jsx`
- [x] `src/hooks/` — `useArchiveAuth.js`, `useArchiveSearch.js`, `useWikidataLookup.js`, `useFileHash.js`, `useUpload.js`
- [x] `src/lib/` — `archiveOrg.js`, `wikidata.js`, `dedup.js`, `metadata.js`, `universities.json`
- [x] `src/pages/` — `Home.jsx`, `Upload.jsx`, `Paper.jsx`, `Browse.jsx`, `About.jsx`
- [x] `src/store/` — `authStore.js`, `wizardStore.js`
- [x] `functions/api/` — `login.js`, `s3keys.js`, `upload.js`
- [x] `public/_redirects` — content: `/*  /index.html  200`
- [x] `public/robots.txt`

### 0.4 Router Skeleton (`App.jsx`)

- [x] Define all five routes in `App.jsx` using React Router v7 (library/declarative mode):
  - [x] `/` → `<Home />`
  - [x] `/browse` → `<Browse />`
  - [x] `/upload` → `<Upload />`
  - [x] `/paper/:identifier` → `<Paper />`
  - [x] `/about` → `<About />`
- [x] Wrap with `<BrowserRouter>` (imported from `react-router`)
- [x] Each page component returns a placeholder `<div>` with its name
- [x] Confirm all five routes render without errors locally

### 0.5 Cloudflare Pages Deployment Shell

- [x] Create a Cloudflare account if you don't have one
- [x] Connect the GitHub repository to Cloudflare Pages:
  - [x] Build command: `npm run build`
  - [x] Output directory: `dist`
  - [x] Node.js version: `20`
- [x] Push to `main` branch — confirm Cloudflare builds and deploys the placeholder shell
- [x] Verify the `_redirects` rule works: visit `/about` directly — should not 404
- [x] Install Wrangler locally for Pages Functions development: `npm install -D wrangler`
- [x] Add dev script to `package.json`: `"dev:full": "wrangler pages dev dist --compatibility-date=2024-09-01"`
- [x] Confirm `npm run build && npm run dev:full` serves Pages Functions locally

**Phase 0 complete when:** Five routes exist, Tailwind styles load, Cloudflare Pages deploys from `main`.

---

## Phase 1 — Design System & Layout Shell

> Goal: Pixel-faithful implementation of the gpura.org-inspired design language. No live data yet — all static. Study gpura.org before writing a single component.

### 1.1 Design Tokens (`@theme` in CSS)

- [x] Visit https://gpura.org and note the exact colour palette (background, accent, text, muted)
- [x] Define a custom colour palette using `@theme` in `src/styles/index.css`:
  - [x] `--color-pyqp-bg`: warm off-white (e.g. `#F9F7F4`)
  - [x] `--color-pyqp-accent`: one restrained accent (e.g. deep teal or warm orange — match gpura tone)
  - [x] `--color-pyqp-muted`: muted grey for metadata chips (e.g. `#6B7280`)
  - [x] `--color-pyqp-border`: subtle border colour
- [x] Set custom font families, border-radius, and spacing in `@theme` block
- [x] Apply `bg-pyqp-bg` as the `<body>` default via `@layer base` in `index.css`

### 1.2 Navbar (`Navbar.jsx`)

- [x] Logo left — text-based for now (`PYQP` in serif font + tagline)
- [x] Nav links right: `Browse`, `About`
- [x] Auth slot right of links: render `<AuthStatus />` (static placeholder for now — just show `[Sign In]` and `[↑ Upload]` buttons with no functionality)
- [x] Responsive: hamburger menu on mobile (Tailwind `md:hidden`)
- [x] Sticky on scroll (`sticky top-0 z-50`)
- [x] Thin bottom border separating it from page content

### 1.3 Footer (`Footer.jsx`)

- [x] Project name + one-line description
- [x] Links: `About`, `Contribute`, `GitHub` (placeholder `#` hrefs for now)
- [x] Attribution line: "Powered by Internet Archive · Institution data from Wikidata"
- [x] Minimal — single row on desktop, stacked on mobile

### 1.4 Stats Strip (`StatsStrip.jsx`) — Static Placeholder

- [x] Four counters in a horizontal strip: `Papers Archived`, `Universities`, `Languages`, `States`
- [x] Hardcode values for now (e.g. `0`, `0`, `0`, `0`) — live data wired in Phase 3
- [x] Style to match gpura.org's equivalent banner: bold large number, small label beneath
- [x] Full-width, accent-coloured or lightly tinted background

### 1.5 Paper Card (`PaperCard.jsx`) — Static Version

Create with hardcoded prop data for layout purposes:

- [x] Thumbnail area (grey placeholder rectangle — real thumbnails in Phase 3)
- [x] Paper title (truncated to 2 lines)
- [x] Institution name
- [x] Chip row: Year chip + Exam Type chip (e.g. `2023`, `Main`)
- [x] Hover state: subtle shadow elevation
- [x] Card links to `/paper/:identifier` (placeholder href)

### 1.6 Paper Grid (`PaperGrid.jsx`) — Static Version

- [x] 3-column desktop / 2-column tablet / 1-column mobile grid
- [x] Render 6 static `<PaperCard />` components with hardcoded dummy data
- [x] Loading skeleton state (grey shimmer blocks — for use later when fetching)

### 1.7 Home Page Layout (`Home.jsx`) — Static

Assemble the full layout with static data:

- [x] `<Navbar />`
- [x] Hero section: mission statement heading + `<SearchBar />` placeholder (just a styled `<input>` for now)
- [x] `<StatsStrip />`
- [x] Section header: "Recent Uploads"
- [x] `<PaperGrid />` (6 dummy cards)
- [x] `<Footer />`
- [x] Confirm it looks correct at 375px (mobile), 768px (tablet), 1280px (desktop)

### 1.8 Remaining Page Shells

Apply `<Navbar />` and `<Footer />` to each page; add a heading so they're identifiable:

- [x] `Browse.jsx` — heading "Browse Papers" + placeholder text
- [x] `Upload.jsx` — heading "Upload a Paper" + placeholder text
- [x] `Paper.jsx` — heading "Paper Detail" + placeholder text
- [x] `About.jsx` — write the actual mission copy (this is static, do it now):
  - [x] What PYQP is
  - [x] How to search and download
  - [x] How to contribute (Upload flow overview)
  - [x] Attribution: Archive.org, Wikidata
  - [x] Link to GitHub repository

**Phase 1 complete when:** All pages render with correct layout, the card grid looks like gpura.org's document cards, and the design holds at all breakpoints.

---

## Phase 2 — Zustand Stores & Data Layer

> Goal: All application state is wired up and testable in isolation before any API calls or UI interactions.

### 2.1 Auth Store (`store/authStore.js`)

- [x] Define Zustand store with the full shape from CLAUDE.md §5:
  ```
  isLoggedIn, screenname, email, accessKey, secretKey, loginError, isLoggingIn
  ```
- [x] Actions:
  - [x] `setLoggedIn(userData)` — sets all fields, clears `loginError`
  - [x] `setLoginError(msg)` — sets `loginError`, clears loading
  - [x] `setLoggingIn(bool)` — toggles `isLoggingIn`
  - [x] `logout()` — resets all fields to defaults
- [x] Session hydration function (called in `App.jsx` on mount):
  - [x] Check `localStorage` for `pyqp_access_key`, `pyqp_secret_key`, `pyqp_screenname`, `pyqp_email`
  - [x] If found → call `setLoggedIn(...)` without a network request
  - [x] Else check `sessionStorage`
  - [x] If neither → leave as logged-out
- [x] Session validation stub: `validateSession()` — to be implemented in Phase 4 (mark as TODO)

### 2.2 Wizard Store (`store/wizardStore.js`)

- [x] Define Zustand store with the full shape from CLAUDE.md §11:
  ```
  step, metadata, file, fileHash, identifier, dedupStatus, duplicateItem,
  uploadStatus, uploadError
  ```
- [x] Actions:
  - [x] `setStep(n)` — advances or retreats the wizard
  - [x] `setMetadata(field, value)` — updates one metadata field
  - [x] `setFile(file)` — stores the File object
  - [x] `setFileHash(hash)` — stores SHA-256 hex
  - [x] `setIdentifier(id)` — stores computed deterministic identifier
  - [x] `setDedupStatus(status)` — `null | 'checking' | 'clear' | 'duplicate'`
  - [x] `setDuplicateItem(item)` — stores Archive.org item if duplicate found
  - [x] `setUploadStatus(status)` — `null | 'uploading' | 'success' | 'error'`
  - [x] `setUploadError(msg)`
  - [x] `resetWizard()` — resets all fields to initial state

### 2.3 Archive.org Library (`lib/archiveOrg.js`)

Implement all URL builders and helper functions — no side effects, pure functions:

- [x] `buildItemUrl(identifier)` → `https://archive.org/details/{identifier}`
- [x] `buildDownloadUrl(identifier, filename)` → `https://archive.org/download/{identifier}/{filename}`
- [x] `buildThumbnailUrl(identifier)` → `https://archive.org/services/img/{identifier}`
- [x] `buildMetadataUrl(identifier)` → `https://archive.org/metadata/{identifier}`
- [x] `buildSearchUrl({ query, filters, rows, page })` → full `advancedsearch.php` URL with `fl[]` params
- [x] `parseSearchResults(json)` → array of normalised paper objects
- [x] `buildIAS3Url(identifier, filename)` → S3 upload URL

### 2.4 Metadata Library (`lib/metadata.js`)

- [x] `buildIdentifier({ wikidataQid, courseCode, year, examType })` — the deterministic ID formula from CLAUDE.md §7:
  ```
  pyqp--{qid}--{course-slug}--{year}--{examType}
  ```
  - [x] `courseCode` → lowercase, replace non-alphanumeric with `-`
  - [x] Validate output with a unit test (manual console check is fine for v0.1.0)
- [x] `buildMetaHeaders(metadata)` → object of `x-archive-meta-*` keys for the upload Worker
- [x] `validateMetadata(metadata)` → returns `{ valid: bool, errors: [] }`:
  - [x] Institution QID present and non-empty
  - [x] Year is a 4-digit number
  - [x] Exam type is one of `main | supplementary | model | improvement`
  - [x] File is PDF and ≤ 50MB

### 2.5 Wikidata Library (`lib/wikidata.js`)

- [x] SPARQL query template for Indian university search (from CLAUDE.md §13)
- [x] `searchUniversitiesLocal(query, list)` — filters `universities.json` by substring match
- [x] `searchUniversitiesRemote(query)` — calls Wikidata SPARQL API with 500ms debounce enforcement (debounce enforced in the hook, not here)
- [x] `parseWikidataResults(json)` → `[{ label, qid, altLabel }]`

### 2.6 Deduplication Library (`lib/dedup.js`)

- [x] `layer1HashCheck(hashHex)` — calls Archive.org search API for `sha256:{hash}` within `subject:pyqp`; returns `{ isDuplicate: bool, item: null | {} }`
- [x] `layer2IdentifierCheck(identifier)` — fetches `archive.org/metadata/{identifier}`; `200 OK` → duplicate
- [x] `runAllDedupLayers({ hashHex, identifier })` — runs Layer 1 then Layer 2 in sequence; stops on first match; returns `{ isDuplicate, item, layerTriggered }`
- [x] Note: Layer 3 (IAS3 checksum header) is handled in the upload Worker, not here

### 2.7 ~~Seed universities.json~~ Live Wikidata Fetch with localStorage Cache

- [x] ~~Seed file removed~~ universities are now fetched live from Wikidata SPARQL and cached in localStorage (7-day TTL)

**Phase 2 complete when:** All stores have correct shape, all lib functions are implemented (even if untested with live calls), and `wikidata.js` fetches universities live with localStorage caching.

---

## Phase 3 — Search, Browse & Paper Detail (Read-Only Features)

> Goal: A fully functional read-only experience. Users can search, filter, and view papers on Archive.org. No auth, no upload yet.

### 3.1 Archive.org Search Hook (`hooks/useArchiveSearch.js`)

- [x] Accepts `{ query, filters }` as input
- [x] Debounces calls to 300ms
- [x] On each search, calls `buildSearchUrl(...)` from `lib/archiveOrg.js` and `fetch()`es it
- [x] Returns `{ results, isLoading, error, totalResults }`
- [x] Empty query → fetch most recent 20 uploads (`subject:pyqp`, sorted by `addeddate desc`)

### 3.2 Live Stats Strip (`StatsStrip.jsx`)

Replace the Phase 1 static placeholder:

- [x] On component mount, call Archive.org search API with `subject:pyqp` and `rows=0` to get `numFound` (total papers count)
- [x] For universities count: search for all unique `creator` values — approximate with `numFound` from a wildcard query or hardcode `0` if Archive.org doesn't support facet counts easily; revisit post-v0.1.0
- [x] For languages and states: similar approach or hardcode `0` with a TODO comment
- [x] Cache result in component state — do not re-fetch on every render
- [x] Show loading skeleton while fetching

### 3.3 Search Bar & Filter Chips (`SearchBar.jsx`, `FilterChips.jsx`)

- [x] `SearchBar.jsx`:
  - [x] Controlled `<input>` with 300ms debounce
  - [x] Fires `onSearch(query)` callback
  - [x] Clear button (×) when query is non-empty
  - [x] Keyboard: `Enter` fires immediately; `Escape` clears
- [x] `FilterChips.jsx`:
  - [x] Chips for: University, Year, Exam Type, Language
  - [x] Each chip opens a dropdown with options (hardcode option lists for Year and Exam Type; Universities come from `universities.json`)
  - [x] Selected chip turns accent-coloured
  - [x] `onFilterChange(filters)` callback fires on every change

### 3.4 Live Paper Grid (`PaperGrid.jsx`)

- [x] Wire `useArchiveSearch` into `PaperGrid`
- [x] Show loading skeletons during fetch
- [x] Show "No papers found" empty state with illustration
- [x] Render real `<PaperCard />` components with Archive.org data
- [x] Pagination: "Load more" button (increments `page` param); no infinite scroll for v0.1.0

### 3.5 Real Paper Card (`PaperCard.jsx`)

Replace static dummy data with real props:

- [x] Thumbnail: `<img src={buildThumbnailUrl(identifier)} />` with lazy loading and fallback grey rectangle on error
- [x] Title: from `description` field or constructed from `creator` + `course-code` + `date`
- [x] Institution chip: `creator` field value
- [x] Year chip: `date` field
- [x] Exam Type chip: `exam-type` custom field
- [x] Card links to `/paper/{identifier}`

### 3.6 Home Page — Fully Live (`Home.jsx`)

- [x] `SearchBar` + `FilterChips` → pass query and filters down to `PaperGrid`
- [x] When no query is active: section header "Recent Uploads"
- [x] When query is active: section header "Search Results for '{query}'" + result count
- [x] Pass filters from `FilterChips` to `useArchiveSearch`

### 3.7 Browse Page (`Browse.jsx`)

- [x] Grid of university name buttons (sourced from `universities.json`) — clicking one navigates to `/?university={qid}` (Home page with filter pre-set)
- [x] Section: Browse by Year — year chips from `2015` to current year
- [x] Section: Browse by Exam Type — `Main`, `Supplementary`, `Model`, `Improvement`
- [x] On mount, read URL params and pre-apply matching filters (so links from Browse work correctly)

### 3.8 Paper Detail Page (`Paper.jsx`)

- [x] On mount, call `fetch(buildMetadataUrl(identifier))` to get full item metadata
- [x] Breadcrumb: `Home › {institution} › {courseCode}`
- [x] Title: constructed from description
- [x] Metadata row: Year, Exam Type, Semester, Language
- [x] Download button → `buildDownloadUrl(identifier, filename)` (direct Archive.org download; opens in new tab)
- [x] "View on Archive.org" link → `buildItemUrl(identifier)`
- [x] `PdfViewer` below (lazy-loaded — see §3.9)
- [x] Handle 404: if `metadata` fetch returns `{ error: 'document not found' }`, show "Paper not found" message

### 3.9 PDF Viewer (`PdfViewer.jsx`)

- [x] Install `pdfjs-dist`: `npm install pdfjs-dist`
- [x] Lazy-load with `React.lazy` + `Suspense` — only loaded on `/paper/:identifier` routes
- [x] Use `pdfjsLib.getDocument(url)` where `url` is the Archive.org download URL
- [x] Render page 1 as a canvas by default
- [x] Page navigation: Prev / Next buttons + "Page X of Y"
- [x] Loading state: spinner while PDF loads
- [x] Error state: "Could not load PDF preview — [Download directly ↗]"

**Phase 3 complete when:** A user can arrive at the site, search for papers, filter results, click a card, and view/download the paper — all without any account.

---

## Phase 4 — Authentication System

> ⚠️ This is the highest-risk phase. The Archive.org login endpoint's CORS behaviour when proxied is explicitly flagged as untested in CLAUDE.md §20. Verify the Worker first, before building any UI.

### 4.1 ⚠️ Verify Archive.org Login Endpoint (Do This First)

Before writing any UI:

- [x] Write a minimal `functions/api/login.js` Worker (copy exact implementation from CLAUDE.md §5)
- [x] Test it with `wrangler pages dev` locally:
  - [x] Use a real Archive.org account (create one at archive.org if needed)
  - [x] `curl -X POST http://localhost:8788/api/login -d "email=...&password=..."`
  - [x] Confirm response contains `ok: true`, `accessKey`, `secretKey`
  - [x] Confirm the cookie extraction regex works (check actual Set-Cookie header format)
- [x] Test edge cases:
  - [x] Wrong password → confirm `401` response and `{ ok: false, error: 'Invalid credentials' }`
  - [x] Account with no S3 keys → confirm `{ ok: false, error: 'no_keys', cookies: {...} }`
- [x] Deploy to Cloudflare Pages and test again (behaviour may differ from local Wrangler)
- [x] Document the actual Set-Cookie header format you observe — it may differ from what CLAUDE.md assumes

### 4.2 S3 Keys Worker (`functions/api/s3keys.js`)

Only after 4.1 is confirmed working:

- [x] Implement key generation Worker:
  - [x] Accept POST with `{ loggedInUser, loggedInSig }` in request body
  - [x] POST to `https://archive.org/account/s3.php` with `action: generate-new-key` and the session cookies
  - [x] Parse response HTML for `accessKey` and `secretKey`
  - [x] Return `{ ok: true, accessKey, secretKey }` or appropriate error
- [x] Test with a real Archive.org account that has no S3 keys

### 4.3 Session Validation Worker (Optional but Recommended for v0.1.0)

- [x] Add a minimal `functions/api/validate.js` Worker:
  - [x] Accept `GET` with `Authorization: LOW {accessKey}:{secretKey}` header
  - [x] Proxy to `https://s3.us.archive.org/?check_auth=1`
  - [x] Return `{ ok: true }` or `{ ok: false }`
- [x] Wire this into `validateSession()` in `authStore.js` — called on app load when keys are found in storage

### 4.4 Auth Store — Session Hydration

Complete the stub from Phase 2:

- [x] In `App.jsx` `useEffect` on mount:
  - [x] Attempt to load from `localStorage` first, then `sessionStorage`
  - [x] If keys found, call `validateSession()` (Worker from §4.3)
  - [x] If validation returns `403` or fails → call `logout()` + clear storage
  - [x] If valid → call `setLoggedIn(...)` with stored values

### 4.5 Archive.org Auth Hook (`hooks/useArchiveAuth.js`)

- [x] `login({ email, password, remember })`:
  - [x] Calls `setLoggingIn(true)`
  - [x] POST to `/api/login` with email + password
  - [x] On `{ ok: true }`: call `setLoggedIn(userData)`; write to `localStorage` or `sessionStorage` based on `remember`
  - [x] On `{ ok: false, error: 'no_keys' }`: set intermediate state `needsKeyGeneration: true` — triggers sub-step
  - [x] On `{ ok: false, error: 'Invalid credentials' }`: call `setLoginError('Incorrect email or password')`
  - [x] On network failure: call `setLoginError('Connection failed — please try again')`
- [x] `generateKeys({ cookies })`:
  - [x] POST to `/api/s3keys` with cookie values
  - [x] On success: complete the login flow (call `setLoggedIn`, write storage)
  - [x] On failure: `setLoginError('Could not generate keys — try again')`
- [x] `logout()`:
  - [x] Call `authStore.logout()`
  - [x] Clear `localStorage` keys: `pyqp_access_key`, `pyqp_secret_key`, `pyqp_screenname`, `pyqp_email`
  - [x] Clear `sessionStorage` equivalents

### 4.6 Login Form (`LoginForm.jsx`)

- [x] Controlled email + password inputs
- [x] "Remember me on this device" checkbox
- [x] Submit calls `login(...)` from `useArchiveAuth`
- [x] Disables all fields and button during loading
- [x] Shows inline red error message from `authStore.loginError`
- [x] "Don't have an account? Sign up at archive.org ↗" link
- [x] Security note below button: "Your password is sent directly to Archive.org. We never store it." (with lock icon)

### 4.7 Login Modal (`LoginModal.jsx`)

- [x] Modal overlay (`fixed inset-0 bg-black/50 z-50`)
- [x] Modal panel centred (`max-w-md`)
- [x] Title: "Sign in with Internet Archive"
- [x] Subtitle explaining the purpose
- [x] Render `<LoginForm />` inside
- [x] Close button (×) top right — closes modal, clears `loginError`
- [x] Implement all five modal states from CLAUDE.md §6:
  - [x] Default — empty form
  - [x] Loading — spinner, disabled fields
  - [x] Wrong credentials — red error message inline
  - [x] No keys — sub-step: "Generating your upload keys..." spinner + auto-proceeds when done
  - [x] Network error — "Connection failed" + Retry button
- [x] On success → close modal; if triggered from Upload CTA → proceed to wizard

### 4.8 Auth Status in Navbar (`AuthStatus.jsx`)

Logged-out state:

- [x] `[Sign In]` button → opens `LoginModal`
- [x] `[↑ Upload]` button → opens `LoginModal` first, then wizard after login

Logged-in state:

- [x] `◉ {screenname}` → external link to `https://archive.org/details/@{screenname}` (new tab)
- [x] `[↑ Upload]` button → opens wizard directly
- [x] `[Sign Out]` button → calls `logout()`, clears storage

**Phase 4 complete when:** A real Archive.org user can sign in from within the site, see their screenname in the Navbar, and sign out. All five modal states are exercisable.

---

## Phase 5 — Upload System

> Goal: The full three-step upload wizard, working end to end with real Archive.org uploads.

### 5.1 Institution Search (`InstitutionSearch.jsx`)

- [x] Load `universities.json` on mount (import directly — no fetch needed)
- [x] Render a text input with a filtered dropdown list below it
- [x] Filter locally (client-side) on every keystroke with no debounce (it's synchronous)
- [x] If local results are empty after 500ms of no typing → trigger `searchUniversitiesRemote()` from `lib/wikidata.js`
- [x] Show matched items in dropdown: English name on first line, regional alternative label on second line (if available)
- [x] On selection: store `{ label, qid }` in wizard store; show a chip below the input with the QID
- [x] "Clear" button removes selection
- [x] **Never call Wikidata SPARQL on every keystroke (Invariant §19.6)**

### 5.2 File Hash Hook (`hooks/useFileHash.js`)

- [x] Accept a `File` object
- [x] Files ≤ 10MB: compute SHA-256 via `crypto.subtle.digest` on the main thread
- [x] Files > 10MB: spawn a Web Worker to compute off the main thread (prevents UI freeze)
  - [x] Create `src/workers/hashWorker.js` — receives an `ArrayBuffer`, returns hex string
  - [x] Use `new Worker(new URL('../workers/hashWorker.js', import.meta.url))`
- [x] Returns `{ hash, isHashing, error }`

### 5.3 Step 1 — Metadata Form (`StepMetadata.jsx`)

Implement the full form from CLAUDE.md §10:

- [x] `<InstitutionSearch />` — must resolve to QID before allowing advance
- [x] Program / Degree: free text input
- [x] Course Name: free text input
- [x] Course Code: free text input (optional — show `(optional)` label)
- [x] Exam Year: `<select>` from current year down to 2000
- [x] Month / Session: `<select>` — all twelve months
- [x] Exam Type: radio group — `Main`, `Supplementary`, `Model`, `Improvement`
- [x] Semester: `<select>` — Semester 1 through 8 + "Annual" option
- [x] Language: `<select>` — at minimum: `en`, `ml`, `hi`, `ta`, `te`, `kn`
- [x] PDF drop zone:
  - [x] Accepts drag-and-drop
  - [x] Accepts click-to-browse
  - [x] Validates MIME type is `application/pdf`
  - [x] Validates first 4 bytes are `25 50 44 46` (`%PDF`) — read via `FileReader`
  - [x] Validates size ≤ 50MB (51200 KB) — enforce before hashing
  - [x] Shows filename + size once accepted
  - [x] Shows error inline if validation fails
- [x] Identifier preview: `<details>` element (collapsed by default) showing computed identifier as fields are filled
- [x] On valid submit: compute identifier → store in wizard; trigger file hashing → store hash; advance to Step 2

### 5.4 Step 2 — Duplicate Check (`StepDedupCheck.jsx`)

Non-interactive auto-running step:

- [x] On mount, call `runAllDedupLayers({ hashHex, identifier })` from `lib/dedup.js`
- [x] Show three-item checklist with spinner → ✓ as each layer completes:
  - [x] "Computing file fingerprint..." (done before this step — show as already ✓)
  - [x] "Searching for matching files..." (Layer 1 — hash check)
  - [x] "Checking for matching entry..." (Layer 2 — identifier check)
- [x] **Clean result:** show green "✓ This paper is new. Ready to upload." + `[← Edit Details]` + `[Upload Paper →]`
- [x] **Duplicate found:** show the duplicate item (thumbnail + title + institution + year) with a "View on Archive.org ↗" link; show "Thanks for trying to contribute!" + `[← Edit Details]` (no upload button)

### 5.5 Upload Worker (`functions/api/upload.js`)

- [x] Implement the Worker exactly as specified in CLAUDE.md §9
- [x] Security checks:
  - [x] Reject requests missing `accessKey`, `secretKey`, `identifier`, `file`, or `meta`
  - [x] Content-Type of file must be `application/pdf`
- [x] Meta headers: iterate `meta` object and prefix each key with `x-archive-meta-`
- [x] Always include:
  - [x] `x-archive-auto-make-bucket: 1`
  - [x] `x-archive-queue-derive: 1` (triggers OCR + thumbnails)
  - [x] `x-archive-meta-subject: pyqp` and `x-archive-meta-subject: {wikidataQid}`
  - [x] `x-archive-meta-sha256: {hash}` (Layer 3 dedup)
- [x] Return `{ ok, status, identifier }` with appropriate HTTP status

### 5.6 Upload Hook (`hooks/useUpload.js`)

- [x] `startUpload()`:
  - [x] Calls `setUploadStatus('uploading')`
  - [x] Reads `accessKey`, `secretKey` from `authStore`
  - [x] Reads `file`, `fileHash`, `identifier`, `metadata` from `wizardStore`
  - [x] Builds `FormData` and POST to `/api/upload`
  - [x] On success: `setUploadStatus('success')`
  - [x] On `401`: `setUploadError('session_expired')`
  - [x] On `503`: `setUploadError('slow_down')`
  - [x] On network failure: `setUploadError('network')`
  - [x] On any other non-ok: `setUploadError('rejected')`

### 5.7 Step 3 — Upload Progress (`StepUpload.jsx`)

- [x] On mount, call `startUpload()` from `useUpload`
- [x] Show filename + file size
- [x] Progress bar — indeterminate (pulse animation) since `fetch` doesn't expose upload progress without `XMLHttpRequest`; revisit post-v0.1.0
- [x] **Success state** (from CLAUDE.md §10):
  - [x] "✓ Paper archived successfully!"
  - [x] Permanent URL: `archive.org/details/{identifier}` as a clickable link
  - [x] `[View Paper ↗]` + `[Upload Another]` buttons
  - [x] Note about processing time for OCR + thumbnails
- [x] **Error states** — four variants from CLAUDE.md §10 error table:
  - [x] `session_expired` → "Your Archive.org session expired. Please sign in again." + `[Sign In]` button
  - [x] `slow_down` → "Archive.org is busy. Please wait a moment and try again." + `[Retry]`
  - [x] `network` → "Connection failed. Check your internet and try again." + `[Retry]`
  - [x] `rejected` → "Archive.org rejected this file. Ensure it is a valid PDF and try again."

### 5.8 Upload Wizard Root (`UploadWizard/index.jsx`)

- [x] Read `step` from `wizardStore`
- [x] Render `StepMetadata` when `step === 1`
- [x] Render `StepDedupCheck` when `step === 2`
- [x] Render `StepUpload` when `step === 3`
- [x] Step indicator at top: three dots or numbered steps with current step highlighted
- [x] On unmount (user navigates away mid-wizard): call `resetWizard()` after confirmation dialog ("Are you sure? Your progress will be lost.")

### 5.9 Upload Page (`Upload.jsx`)

- [x] If not logged in: show `<LoginModal />` immediately (do not show wizard)
- [x] After login: show `<UploadWizard />`
- [x] If already logged in on arrival: show wizard directly

**Phase 5 complete when:** A logged-in user can upload a real PDF to Archive.org through the wizard, see the success screen, and find the paper at the Archive.org URL.

---

## Phase 6 — Polish, Error Handling & Hardening

> Goal: Production-quality robustness before the v0.1.0 release tag.

### 6.1 Global Error Handling

- [ ] Add a React error boundary (`ErrorBoundary.jsx`) wrapping the router
- [ ] Show a friendly "Something went wrong" page with a reload button
- [ ] Catch unhandled promise rejections in search and display inline "Search failed — try again" messages
- [ ] Validate Archive.org API responses before reading fields (guard against schema changes)

### 6.2 Scope Enforcement & Moderation UI

- [ ] Upload wizard Step 1: add a clear disclaimer box:
  > "Only upload previous year university exam question papers. No textbooks, notes, or copyrighted course material."
- [ ] Add validation text below the PDF dropzone: "PDF files only · Max 50MB · Question papers only"
- [ ] About page: link to `https://archive.org/about/dmca.php` for abuse reports
- [ ] Verify PDF magic byte check (`%PDF`) is working correctly — test with a renamed `.txt` file

### 6.3 Performance Audit

- [ ] Run `npm run build` and check bundle size — verify `pdfjs-dist` is NOT in the main bundle
- [ ] Run Lighthouse on Home page — target ≥ 90 Performance on desktop
- [ ] Confirm `universities.json` import is not causing a large synchronous parse on first load (consider `React.lazy` + dynamic import if > 200KB)
- [ ] Verify Wikidata localStorage cache is written and read correctly (7-day TTL)
- [ ] Confirm search debounce is 300ms — not firing on every keystroke

### 6.4 Responsive & Accessibility

- [ ] Test all pages at 375px, 768px, 1280px — no horizontal overflow
- [ ] All interactive elements have visible `:focus` rings
- [ ] All images have `alt` attributes
- [ ] Modal is focus-trapped when open (keyboard navigation cannot leave the modal)
- [ ] Colour contrast passes WCAG AA for all text on `--color-pyqp-bg` background

### 6.5 Security Invariant Checklist

Review each invariant from CLAUDE.md §19:

- [ ] Password never appears in `authStore`, `localStorage`, `sessionStorage`, or any console log
- [ ] `secretKey` never appears in any UI element or error message
- [ ] Worker logs (Cloudflare dashboard) do not contain credentials — review Worker code
- [ ] Every upload uses the logged-in user's own `accessKey`/`secretKey` — no shared account
- [ ] All three dedup layers run before `setUploadStatus('uploading')` is called
- [ ] Deterministic identifier formula matches CLAUDE.md §7 exactly — do not change it
- [ ] `InstitutionSearch` does not call Wikidata SPARQL on every keystroke — confirm with browser DevTools Network tab
- [ ] No non-PDF file can pass the dropzone validation — test with images, text files, zip files

### 6.6 Copy & Content

- [ ] All placeholder text is replaced with real copy
- [ ] `About.jsx` is complete and accurate
- [ ] `robots.txt` is configured (allow all crawlers — content should be indexed)
- [ ] `<title>` tags are set per page (use `react-helmet-async` or equivalent):
  - [ ] Home: "PYQP — Previous Year Question Papers"
  - [ ] Paper: "{course} — {year} — {institution} | PYQP"
  - [ ] Browse: "Browse Papers | PYQP"
  - [ ] Upload: "Upload a Paper | PYQP"
  - [ ] About: "About | PYQP"

### 6.7 404 & Edge Cases

- [ ] `/paper/:identifier` with a non-existent identifier shows a friendly 404
- [ ] Archive.org search returning 0 results shows "No papers found — be the first to upload one! [↑ Upload]"
- [ ] Navigating to `/upload` while on mobile — wizard is usable (test on real device or DevTools mobile emulation)
- [ ] Session expiry mid-wizard (keys invalidated between login and upload) — handled by `session_expired` error state in StepUpload

---

## Phase 7 — Pre-Release Checklist

> Everything below must be done before tagging `v0.1.0`.

### 7.1 End-to-End Testing (Manual)

- [ ] **Happy path — new user, new paper:**
  - [ ] Arrive at `/`
  - [ ] Search for a university — confirm results appear
  - [ ] Click a paper — detail page loads; PDF previews
  - [ ] Click Upload — LoginModal appears
  - [ ] Sign in with real Archive.org account — modal closes, screenname appears in Navbar
  - [ ] Fill in all metadata for a real test paper
  - [ ] Drop a real PDF ≤ 50MB
  - [ ] Advance to dedup check — confirm it passes
  - [ ] Advance to upload — confirm upload succeeds
  - [ ] Visit the Archive.org URL from the success screen — confirm item exists

- [ ] **Dedup — duplicate paper:**
  - [ ] Upload the same PDF a second time
  - [ ] Dedup check (Layer 1 hash) should catch it and show the existing item

- [ ] **Auth persistence — Remember me:**
  - [ ] Login with "Remember me" checked
  - [ ] Close and reopen the browser
  - [ ] Confirm user is still logged in (keys loaded from localStorage)

- [ ] **Auth persistence — session only:**
  - [ ] Login without "Remember me"
  - [ ] Close the tab
  - [ ] Confirm user is logged out (sessionStorage cleared)

- [ ] **Error state — wrong password:**
  - [ ] Enter wrong credentials
  - [ ] Confirm inline error appears in modal

- [ ] **Scope enforcement:**
  - [ ] Try uploading a `.jpg` renamed to `.pdf` — confirm rejection by magic byte check
  - [ ] Try uploading a file > 50MB — confirm rejection before hashing

### 7.2 Cloudflare Pages — Production Verification

- [ ] All three Workers (`login.js`, `s3keys.js`, `upload.js`) deployed and responding correctly
- [ ] `_redirects` rule confirmed working on production URL (not just local)
- [ ] Build passes with zero warnings related to missing env vars
- [ ] Confirm Cloudflare free tier limits are not being approached (check Analytics)

### 7.3 Repository Hygiene

- [ ] No hardcoded credentials, email addresses, or test account details in any file
- [ ] `.gitignore` is clean — no `dist/`, `.wrangler/`, or `node_modules/` tracked
- [ ] `README.md` is accurate and includes:
  - [ ] What PYQP is
  - [ ] Live URL
  - [ ] How to run locally (Prerequisites, `npm install`, `npm run dev`)
  - [ ] How to run with Pages Functions (`npm run dev:full`)
  - [ ] Architecture overview (3 sentences)
  - [ ] Contributing guide (link to Archive.org account creation)
- [ ] `CLAUDE.md` is up to date with any decisions made during development

### 7.4 Tag the Release

- [ ] Ensure `main` branch is green (no broken routes, no console errors)
- [ ] Create Git tag: `git tag v0.1.0`
- [ ] Push tag: `git push origin v0.1.0`
- [ ] Create GitHub Release from tag with changelog:
  - [ ] Read-only paper search and browsing
  - [ ] Archive.org authentication (email + password, no redirect)
  - [ ] Three-step upload wizard with three-layer deduplication
  - [ ] PDF preview via pdfjs-dist
  - [ ] Permanently free — no backend, no database, no ongoing cost

---

## Post-v0.1.0 Backlog (Do Not Build Now)

These items are explicitly deferred. Reference CLAUDE.md §20 for the full list.

- [ ] 2FA support for Archive.org accounts
- [ ] `universities.json` auto-regeneration via GitHub Actions (monthly)
- [ ] Image-based scan upload (JPEG/PNG → merged PDF via `pdf-lib`)
- [ ] "Papers near your university" map (OpenStreetMap Nominatim)
- [ ] PWA / offline mode for previously viewed papers
- [ ] Malayalam / regional language UI localisation
- [ ] Real-time upload progress via `XMLHttpRequest` instead of `fetch`
- [ ] Faceted stats (universities count, languages count, states count) — requires Archive.org facet support investigation
- [ ] `advancedsearch.php` rate limit investigation under real traffic

---

## Invariants — Quick Reference

> These must never be violated. Pin this to your monitor during Phase 4 and 5 development.

1. **Never store the Archive.org password** — anywhere, at any point, for any reason.
2. **Never store credentials server-side** — Workers forward per-request only.
3. **Never upload via a shared account** — always use the authenticated user's keys.
4. **Always run all three dedup layers** before the upload begins.
5. **Never change the deterministic identifier formula** once papers are live.
6. **Never call Wikidata SPARQL on every keystroke.**
7. **Never accept non-PDF files.**
8. **Never display the password or secret key** in any UI, log, or error message.

---

*Target: v0.1.0 — a functional, permanently free, serverless question paper archive.*
*Infrastructure: Archive.org IAS3 + Cloudflare Pages + Wikidata.*
*Design reference: gpura.org (Kerala Digital Archive).*
