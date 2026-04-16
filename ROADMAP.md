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

- [ ] Create a new Git repository (`pyqp`)
- [ ] Add `.gitignore` (node_modules, dist, .wrangler, .env)
- [ ] Copy `CLAUDE.md` into repository root
- [ ] Copy this `ROADMAP.md` into repository root
- [ ] Create `README.md` with one-paragraph project description and link to Archive.org

### 0.2 Vite + React Initialisation

- [ ] Run `npm create vite@latest . -- --template react`
- [ ] Confirm dev server starts: `npm run dev` → `http://localhost:5173`
- [ ] Install Tailwind CSS and configure:
  - [ ] `npm install -D tailwindcss postcss autoprefixer`
  - [ ] `npx tailwindcss init -p`
  - [ ] Set `content` in `tailwind.config.js` to `["./index.html", "./src/**/*.{js,jsx}"]`
  - [ ] Add Tailwind directives to `src/styles/index.css`
  - [ ] Import `src/styles/index.css` in `src/main.jsx`
- [ ] Install React Router: `npm install react-router-dom`
- [ ] Install Zustand: `npm install zustand`
- [ ] Install Fontsource packages (choose one serif for headings, one sans for body):
  - [ ] `npm install @fontsource/lora` (or similar serif — matches gpura.org editorial tone)
  - [ ] `npm install @fontsource/inter` (or similar clean sans-serif)
  - [ ] Import both fonts in `src/styles/index.css`
- [ ] Set Tailwind `fontFamily` config to use your chosen fonts

### 0.3 Directory Structure

Create the full directory tree from CLAUDE.md §4 as empty placeholder files:

- [ ] `src/components/layout/` — `Navbar.jsx`, `Footer.jsx`, `StatsStrip.jsx`
- [ ] `src/components/search/` — `SearchBar.jsx`, `FilterChips.jsx`, `PaperCard.jsx`, `PaperGrid.jsx`
- [ ] `src/components/auth/` — `LoginModal.jsx`, `LoginForm.jsx`, `AuthStatus.jsx`
- [ ] `src/components/upload/UploadWizard/` — `index.jsx`, `StepMetadata.jsx`, `StepDedupCheck.jsx`, `StepUpload.jsx`
- [ ] `src/components/upload/` — `InstitutionSearch.jsx`
- [ ] `src/components/paper/` — `PdfViewer.jsx`
- [ ] `src/hooks/` — `useArchiveAuth.js`, `useArchiveSearch.js`, `useWikidataLookup.js`, `useFileHash.js`, `useUpload.js`
- [ ] `src/lib/` — `archiveOrg.js`, `wikidata.js`, `dedup.js`, `metadata.js`, `universities.json`
- [ ] `src/pages/` — `Home.jsx`, `Upload.jsx`, `Paper.jsx`, `Browse.jsx`, `About.jsx`
- [ ] `src/store/` — `authStore.js`, `wizardStore.js`
- [ ] `functions/api/` — `login.js`, `s3keys.js`, `upload.js`
- [ ] `public/_redirects` — content: `/*  /index.html  200`
- [ ] `public/robots.txt`

### 0.4 Router Skeleton (`App.jsx`)

- [ ] Define all five routes in `App.jsx` using React Router v6:
  - [ ] `/` → `<Home />`
  - [ ] `/browse` → `<Browse />`
  - [ ] `/upload` → `<Upload />`
  - [ ] `/paper/:identifier` → `<Paper />`
  - [ ] `/about` → `<About />`
- [ ] Wrap with `<BrowserRouter>`
- [ ] Each page component returns a placeholder `<div>` with its name
- [ ] Confirm all five routes render without errors locally

### 0.5 Cloudflare Pages Deployment Shell

- [ ] Create a Cloudflare account if you don't have one
- [ ] Connect the GitHub repository to Cloudflare Pages:
  - [ ] Build command: `npm run build`
  - [ ] Output directory: `dist`
  - [ ] Node.js version: `20`
- [ ] Push to `main` branch — confirm Cloudflare builds and deploys the placeholder shell
- [ ] Verify the `_redirects` rule works: visit `/about` directly — should not 404
- [ ] Install Wrangler locally for Pages Functions development: `npm install -D wrangler`
- [ ] Add dev script to `package.json`: `"dev:full": "wrangler pages dev dist --compatibility-date=2024-09-01"`
- [ ] Confirm `npm run build && npm run dev:full` serves Pages Functions locally

**Phase 0 complete when:** Five routes exist, Tailwind styles load, Cloudflare Pages deploys from `main`.

---

## Phase 1 — Design System & Layout Shell

> Goal: Pixel-faithful implementation of the gpura.org-inspired design language. No live data yet — all static. Study gpura.org before writing a single component.

### 1.1 Design Tokens (Tailwind Config)

- [ ] Visit https://gpura.org and note the exact colour palette (background, accent, text, muted)
- [ ] Define a custom colour palette in `tailwind.config.js`:
  - [ ] `pyqp-bg`: warm off-white (e.g. `#F9F7F4`)
  - [ ] `pyqp-accent`: one restrained accent (e.g. deep teal or warm orange — match gpura tone)
  - [ ] `pyqp-muted`: muted grey for metadata chips (e.g. `#6B7280`)
  - [ ] `pyqp-border`: subtle border colour
- [ ] Set `backgroundImage`, `borderRadius`, and `fontFamily` extensions
- [ ] Apply `bg-pyqp-bg` as the `<body>` default in `index.css`

### 1.2 Navbar (`Navbar.jsx`)

- [ ] Logo left — text-based for now (`PYQP` in serif font + tagline)
- [ ] Nav links right: `Browse`, `About`
- [ ] Auth slot right of links: render `<AuthStatus />` (static placeholder for now — just show `[Sign In]` and `[↑ Upload]` buttons with no functionality)
- [ ] Responsive: hamburger menu on mobile (Tailwind `md:hidden`)
- [ ] Sticky on scroll (`sticky top-0 z-50`)
- [ ] Thin bottom border separating it from page content

### 1.3 Footer (`Footer.jsx`)

- [ ] Project name + one-line description
- [ ] Links: `About`, `Contribute`, `GitHub` (placeholder `#` hrefs for now)
- [ ] Attribution line: "Powered by Internet Archive · Institution data from Wikidata"
- [ ] Minimal — single row on desktop, stacked on mobile

### 1.4 Stats Strip (`StatsStrip.jsx`) — Static Placeholder

- [ ] Four counters in a horizontal strip: `Papers Archived`, `Universities`, `Languages`, `States`
- [ ] Hardcode values for now (e.g. `0`, `0`, `0`, `0`) — live data wired in Phase 3
- [ ] Style to match gpura.org's equivalent banner: bold large number, small label beneath
- [ ] Full-width, accent-coloured or lightly tinted background

### 1.5 Paper Card (`PaperCard.jsx`) — Static Version

Create with hardcoded prop data for layout purposes:

- [ ] Thumbnail area (grey placeholder rectangle — real thumbnails in Phase 3)
- [ ] Paper title (truncated to 2 lines)
- [ ] Institution name
- [ ] Chip row: Year chip + Exam Type chip (e.g. `2023`, `Main`)
- [ ] Hover state: subtle shadow elevation
- [ ] Card links to `/paper/:identifier` (placeholder href)

### 1.6 Paper Grid (`PaperGrid.jsx`) — Static Version

- [ ] 3-column desktop / 2-column tablet / 1-column mobile grid
- [ ] Render 6 static `<PaperCard />` components with hardcoded dummy data
- [ ] Loading skeleton state (grey shimmer blocks — for use later when fetching)

### 1.7 Home Page Layout (`Home.jsx`) — Static

Assemble the full layout with static data:

- [ ] `<Navbar />`
- [ ] Hero section: mission statement heading + `<SearchBar />` placeholder (just a styled `<input>` for now)
- [ ] `<StatsStrip />`
- [ ] Section header: "Recent Uploads"
- [ ] `<PaperGrid />` (6 dummy cards)
- [ ] `<Footer />`
- [ ] Confirm it looks correct at 375px (mobile), 768px (tablet), 1280px (desktop)

### 1.8 Remaining Page Shells

Apply `<Navbar />` and `<Footer />` to each page; add a heading so they're identifiable:

- [ ] `Browse.jsx` — heading "Browse Papers" + placeholder text
- [ ] `Upload.jsx` — heading "Upload a Paper" + placeholder text
- [ ] `Paper.jsx` — heading "Paper Detail" + placeholder text
- [ ] `About.jsx` — write the actual mission copy (this is static, do it now):
  - [ ] What PYQP is
  - [ ] How to search and download
  - [ ] How to contribute (Upload flow overview)
  - [ ] Attribution: Archive.org, Wikidata
  - [ ] Link to GitHub repository

**Phase 1 complete when:** All pages render with correct layout, the card grid looks like gpura.org's document cards, and the design holds at all breakpoints.

---

## Phase 2 — Zustand Stores & Data Layer

> Goal: All application state is wired up and testable in isolation before any API calls or UI interactions.

### 2.1 Auth Store (`store/authStore.js`)

- [ ] Define Zustand store with the full shape from CLAUDE.md §5:
  ```
  isLoggedIn, screenname, email, accessKey, secretKey, loginError, isLoggingIn
  ```
- [ ] Actions:
  - [ ] `setLoggedIn(userData)` — sets all fields, clears `loginError`
  - [ ] `setLoginError(msg)` — sets `loginError`, clears loading
  - [ ] `setLoggingIn(bool)` — toggles `isLoggingIn`
  - [ ] `logout()` — resets all fields to defaults
- [ ] Session hydration function (called in `App.jsx` on mount):
  - [ ] Check `localStorage` for `pyqp_access_key`, `pyqp_secret_key`, `pyqp_screenname`, `pyqp_email`
  - [ ] If found → call `setLoggedIn(...)` without a network request
  - [ ] Else check `sessionStorage`
  - [ ] If neither → leave as logged-out
- [ ] Session validation stub: `validateSession()` — to be implemented in Phase 4 (mark as TODO)

### 2.2 Wizard Store (`store/wizardStore.js`)

- [ ] Define Zustand store with the full shape from CLAUDE.md §11:
  ```
  step, metadata, file, fileHash, identifier, dedupStatus, duplicateItem,
  uploadStatus, uploadError
  ```
- [ ] Actions:
  - [ ] `setStep(n)` — advances or retreats the wizard
  - [ ] `setMetadata(field, value)` — updates one metadata field
  - [ ] `setFile(file)` — stores the File object
  - [ ] `setFileHash(hash)` — stores SHA-256 hex
  - [ ] `setIdentifier(id)` — stores computed deterministic identifier
  - [ ] `setDedupStatus(status)` — `null | 'checking' | 'clear' | 'duplicate'`
  - [ ] `setDuplicateItem(item)` — stores Archive.org item if duplicate found
  - [ ] `setUploadStatus(status)` — `null | 'uploading' | 'success' | 'error'`
  - [ ] `setUploadError(msg)`
  - [ ] `resetWizard()` — resets all fields to initial state

### 2.3 Archive.org Library (`lib/archiveOrg.js`)

Implement all URL builders and helper functions — no side effects, pure functions:

- [ ] `buildItemUrl(identifier)` → `https://archive.org/details/{identifier}`
- [ ] `buildDownloadUrl(identifier, filename)` → `https://archive.org/download/{identifier}/{filename}`
- [ ] `buildThumbnailUrl(identifier)` → `https://archive.org/services/img/{identifier}`
- [ ] `buildMetadataUrl(identifier)` → `https://archive.org/metadata/{identifier}`
- [ ] `buildSearchUrl({ query, filters, rows, page })` → full `advancedsearch.php` URL with `fl[]` params
- [ ] `parseSearchResults(json)` → array of normalised paper objects
- [ ] `buildIAS3Url(identifier, filename)` → S3 upload URL

### 2.4 Metadata Library (`lib/metadata.js`)

- [ ] `buildIdentifier({ wikidataQid, courseCode, year, examType })` — the deterministic ID formula from CLAUDE.md §7:
  ```
  pyqp--{qid}--{course-slug}--{year}--{examType}
  ```
  - [ ] `courseCode` → lowercase, replace non-alphanumeric with `-`
  - [ ] Validate output with a unit test (manual console check is fine for v0.1.0)
- [ ] `buildMetaHeaders(metadata)` → object of `x-archive-meta-*` keys for the upload Worker
- [ ] `validateMetadata(metadata)` → returns `{ valid: bool, errors: [] }`:
  - [ ] Institution QID present and non-empty
  - [ ] Year is a 4-digit number
  - [ ] Exam type is one of `main | supplementary | model | improvement`
  - [ ] File is PDF and ≤ 50MB

### 2.5 Wikidata Library (`lib/wikidata.js`)

- [ ] SPARQL query template for Indian university search (from CLAUDE.md §13)
- [ ] `searchUniversitiesLocal(query, list)` — filters `universities.json` by substring match
- [ ] `searchUniversitiesRemote(query)` — calls Wikidata SPARQL API with 500ms debounce enforcement (debounce enforced in the hook, not here)
- [ ] `parseWikidataResults(json)` → `[{ label, qid, altLabel }]`

### 2.6 Deduplication Library (`lib/dedup.js`)

- [ ] `layer1HashCheck(hashHex)` — calls Archive.org search API for `sha256:{hash}` within `subject:pyqp`; returns `{ isDuplicate: bool, item: null | {} }`
- [ ] `layer2IdentifierCheck(identifier)` — fetches `archive.org/metadata/{identifier}`; `200 OK` → duplicate
- [ ] `runAllDedupLayers({ hashHex, identifier })` — runs Layer 1 then Layer 2 in sequence; stops on first match; returns `{ isDuplicate, item, layerTriggered }`
- [ ] Note: Layer 3 (IAS3 checksum header) is handled in the upload Worker, not here

### 2.7 Seed `universities.json`

- [ ] Run the SPARQL query from CLAUDE.md §13 against https://query.wikidata.org to export Indian universities
- [ ] Save result as `src/lib/universities.json` — array of `{ label, qid, altLabel }`
- [ ] Confirm file is ≤ 200KB (trim if needed — sort and take top 500 by alphabetical label)

**Phase 2 complete when:** All stores have correct shape, all lib functions are implemented (even if untested with live calls), and `universities.json` is populated.

---

## Phase 3 — Search, Browse & Paper Detail (Read-Only Features)

> Goal: A fully functional read-only experience. Users can search, filter, and view papers on Archive.org. No auth, no upload yet.

### 3.1 Archive.org Search Hook (`hooks/useArchiveSearch.js`)

- [ ] Accepts `{ query, filters }` as input
- [ ] Debounces calls to 300ms
- [ ] On each search, calls `buildSearchUrl(...)` from `lib/archiveOrg.js` and `fetch()`es it
- [ ] Returns `{ results, isLoading, error, totalResults }`
- [ ] Empty query → fetch most recent 20 uploads (`subject:pyqp`, sorted by `addeddate desc`)

### 3.2 Live Stats Strip (`StatsStrip.jsx`)

Replace the Phase 1 static placeholder:

- [ ] On component mount, call Archive.org search API with `subject:pyqp` and `rows=0` to get `numFound` (total papers count)
- [ ] For universities count: search for all unique `creator` values — approximate with `numFound` from a wildcard query or hardcode `0` if Archive.org doesn't support facet counts easily; revisit post-v0.1.0
- [ ] For languages and states: similar approach or hardcode `0` with a TODO comment
- [ ] Cache result in component state — do not re-fetch on every render
- [ ] Show loading skeleton while fetching

### 3.3 Search Bar & Filter Chips (`SearchBar.jsx`, `FilterChips.jsx`)

- [ ] `SearchBar.jsx`:
  - [ ] Controlled `<input>` with 300ms debounce
  - [ ] Fires `onSearch(query)` callback
  - [ ] Clear button (×) when query is non-empty
  - [ ] Keyboard: `Enter` fires immediately; `Escape` clears
- [ ] `FilterChips.jsx`:
  - [ ] Chips for: University, Year, Exam Type, Language
  - [ ] Each chip opens a dropdown with options (hardcode option lists for Year and Exam Type; Universities come from `universities.json`)
  - [ ] Selected chip turns accent-coloured
  - [ ] `onFilterChange(filters)` callback fires on every change

### 3.4 Live Paper Grid (`PaperGrid.jsx`)

- [ ] Wire `useArchiveSearch` into `PaperGrid`
- [ ] Show loading skeletons during fetch
- [ ] Show "No papers found" empty state with illustration
- [ ] Render real `<PaperCard />` components with Archive.org data
- [ ] Pagination: "Load more" button (increments `page` param); no infinite scroll for v0.1.0

### 3.5 Real Paper Card (`PaperCard.jsx`)

Replace static dummy data with real props:

- [ ] Thumbnail: `<img src={buildThumbnailUrl(identifier)} />` with lazy loading and fallback grey rectangle on error
- [ ] Title: from `description` field or constructed from `creator` + `course-code` + `date`
- [ ] Institution chip: `creator` field value
- [ ] Year chip: `date` field
- [ ] Exam Type chip: `exam-type` custom field
- [ ] Card links to `/paper/{identifier}`

### 3.6 Home Page — Fully Live (`Home.jsx`)

- [ ] `SearchBar` + `FilterChips` → pass query and filters down to `PaperGrid`
- [ ] When no query is active: section header "Recent Uploads"
- [ ] When query is active: section header "Search Results for '{query}'" + result count
- [ ] Pass filters from `FilterChips` to `useArchiveSearch`

### 3.7 Browse Page (`Browse.jsx`)

- [ ] Grid of university name buttons (sourced from `universities.json`) — clicking one navigates to `/?university={qid}` (Home page with filter pre-set)
- [ ] Section: Browse by Year — year chips from `2015` to current year
- [ ] Section: Browse by Exam Type — `Main`, `Supplementary`, `Model`, `Improvement`
- [ ] On mount, read URL params and pre-apply matching filters (so links from Browse work correctly)

### 3.8 Paper Detail Page (`Paper.jsx`)

- [ ] On mount, call `fetch(buildMetadataUrl(identifier))` to get full item metadata
- [ ] Breadcrumb: `Home › {institution} › {courseCode}`
- [ ] Title: constructed from description
- [ ] Metadata row: Year, Exam Type, Semester, Language
- [ ] Download button → `buildDownloadUrl(identifier, filename)` (direct Archive.org download; opens in new tab)
- [ ] "View on Archive.org" link → `buildItemUrl(identifier)`
- [ ] `PdfViewer` below (lazy-loaded — see §3.9)
- [ ] Handle 404: if `metadata` fetch returns `{ error: 'document not found' }`, show "Paper not found" message

### 3.9 PDF Viewer (`PdfViewer.jsx`)

- [ ] Install `pdfjs-dist`: `npm install pdfjs-dist`
- [ ] Lazy-load with `React.lazy` + `Suspense` — only loaded on `/paper/:identifier` routes
- [ ] Use `pdfjsLib.getDocument(url)` where `url` is the Archive.org download URL
- [ ] Render page 1 as a canvas by default
- [ ] Page navigation: Prev / Next buttons + "Page X of Y"
- [ ] Loading state: spinner while PDF loads
- [ ] Error state: "Could not load PDF preview — [Download directly ↗]"

**Phase 3 complete when:** A user can arrive at the site, search for papers, filter results, click a card, and view/download the paper — all without any account.

---

## Phase 4 — Authentication System

> ⚠️ This is the highest-risk phase. The Archive.org login endpoint's CORS behaviour when proxied is explicitly flagged as untested in CLAUDE.md §20. Verify the Worker first, before building any UI.

### 4.1 ⚠️ Verify Archive.org Login Endpoint (Do This First)

Before writing any UI:

- [ ] Write a minimal `functions/api/login.js` Worker (copy exact implementation from CLAUDE.md §5)
- [ ] Test it with `wrangler pages dev` locally:
  - [ ] Use a real Archive.org account (create one at archive.org if needed)
  - [ ] `curl -X POST http://localhost:8788/api/login -d "email=...&password=..."`
  - [ ] Confirm response contains `ok: true`, `accessKey`, `secretKey`
  - [ ] Confirm the cookie extraction regex works (check actual Set-Cookie header format)
- [ ] Test edge cases:
  - [ ] Wrong password → confirm `401` response and `{ ok: false, error: 'Invalid credentials' }`
  - [ ] Account with no S3 keys → confirm `{ ok: false, error: 'no_keys', cookies: {...} }`
- [ ] Deploy to Cloudflare Pages and test again (behaviour may differ from local Wrangler)
- [ ] Document the actual Set-Cookie header format you observe — it may differ from what CLAUDE.md assumes

### 4.2 S3 Keys Worker (`functions/api/s3keys.js`)

Only after 4.1 is confirmed working:

- [ ] Implement key generation Worker:
  - [ ] Accept POST with `{ loggedInUser, loggedInSig }` in request body
  - [ ] POST to `https://archive.org/account/s3.php` with `action: generate-new-key` and the session cookies
  - [ ] Parse response HTML for `accessKey` and `secretKey`
  - [ ] Return `{ ok: true, accessKey, secretKey }` or appropriate error
- [ ] Test with a real Archive.org account that has no S3 keys

### 4.3 Session Validation Worker (Optional but Recommended for v0.1.0)

- [ ] Add a minimal `functions/api/validate.js` Worker:
  - [ ] Accept `GET` with `Authorization: LOW {accessKey}:{secretKey}` header
  - [ ] Proxy to `https://s3.us.archive.org/?check_auth=1`
  - [ ] Return `{ ok: true }` or `{ ok: false }`
- [ ] Wire this into `validateSession()` in `authStore.js` — called on app load when keys are found in storage

### 4.4 Auth Store — Session Hydration

Complete the stub from Phase 2:

- [ ] In `App.jsx` `useEffect` on mount:
  - [ ] Attempt to load from `localStorage` first, then `sessionStorage`
  - [ ] If keys found, call `validateSession()` (Worker from §4.3)
  - [ ] If validation returns `403` or fails → call `logout()` + clear storage
  - [ ] If valid → call `setLoggedIn(...)` with stored values

### 4.5 Archive.org Auth Hook (`hooks/useArchiveAuth.js`)

- [ ] `login({ email, password, remember })`:
  - [ ] Calls `setLoggingIn(true)`
  - [ ] POST to `/api/login` with email + password
  - [ ] On `{ ok: true }`: call `setLoggedIn(userData)`; write to `localStorage` or `sessionStorage` based on `remember`
  - [ ] On `{ ok: false, error: 'no_keys' }`: set intermediate state `needsKeyGeneration: true` — triggers sub-step
  - [ ] On `{ ok: false, error: 'Invalid credentials' }`: call `setLoginError('Incorrect email or password')`
  - [ ] On network failure: call `setLoginError('Connection failed — please try again')`
- [ ] `generateKeys({ cookies })`:
  - [ ] POST to `/api/s3keys` with cookie values
  - [ ] On success: complete the login flow (call `setLoggedIn`, write storage)
  - [ ] On failure: `setLoginError('Could not generate keys — try again')`
- [ ] `logout()`:
  - [ ] Call `authStore.logout()`
  - [ ] Clear `localStorage` keys: `pyqp_access_key`, `pyqp_secret_key`, `pyqp_screenname`, `pyqp_email`
  - [ ] Clear `sessionStorage` equivalents

### 4.6 Login Form (`LoginForm.jsx`)

- [ ] Controlled email + password inputs
- [ ] "Remember me on this device" checkbox
- [ ] Submit calls `login(...)` from `useArchiveAuth`
- [ ] Disables all fields and button during loading
- [ ] Shows inline red error message from `authStore.loginError`
- [ ] "Don't have an account? Sign up at archive.org ↗" link
- [ ] Security note below button: "Your password is sent directly to Archive.org. We never store it." (with lock icon)

### 4.7 Login Modal (`LoginModal.jsx`)

- [ ] Modal overlay (`fixed inset-0 bg-black/50 z-50`)
- [ ] Modal panel centred (`max-w-md`)
- [ ] Title: "Sign in with Internet Archive"
- [ ] Subtitle explaining the purpose
- [ ] Render `<LoginForm />` inside
- [ ] Close button (×) top right — closes modal, clears `loginError`
- [ ] Implement all five modal states from CLAUDE.md §6:
  - [ ] Default — empty form
  - [ ] Loading — spinner, disabled fields
  - [ ] Wrong credentials — red error message inline
  - [ ] No keys — sub-step: "Generating your upload keys..." spinner + auto-proceeds when done
  - [ ] Network error — "Connection failed" + Retry button
- [ ] On success → close modal; if triggered from Upload CTA → proceed to wizard

### 4.8 Auth Status in Navbar (`AuthStatus.jsx`)

Logged-out state:

- [ ] `[Sign In]` button → opens `LoginModal`
- [ ] `[↑ Upload]` button → opens `LoginModal` first, then wizard after login

Logged-in state:

- [ ] `◉ {screenname}` → external link to `https://archive.org/details/@{screenname}` (new tab)
- [ ] `[↑ Upload]` button → opens wizard directly
- [ ] `[Sign Out]` button → calls `logout()`, clears storage

**Phase 4 complete when:** A real Archive.org user can sign in from within the site, see their screenname in the Navbar, and sign out. All five modal states are exercisable.

---

## Phase 5 — Upload System

> Goal: The full three-step upload wizard, working end to end with real Archive.org uploads.

### 5.1 Institution Search (`InstitutionSearch.jsx`)

- [ ] Load `universities.json` on mount (import directly — no fetch needed)
- [ ] Render a text input with a filtered dropdown list below it
- [ ] Filter locally (client-side) on every keystroke with no debounce (it's synchronous)
- [ ] If local results are empty after 500ms of no typing → trigger `searchUniversitiesRemote()` from `lib/wikidata.js`
- [ ] Show matched items in dropdown: English name on first line, regional alternative label on second line (if available)
- [ ] On selection: store `{ label, qid }` in wizard store; show a chip below the input with the QID
- [ ] "Clear" button removes selection
- [ ] **Never call Wikidata SPARQL on every keystroke (Invariant §19.6)**

### 5.2 File Hash Hook (`hooks/useFileHash.js`)

- [ ] Accept a `File` object
- [ ] Files ≤ 10MB: compute SHA-256 via `crypto.subtle.digest` on the main thread
- [ ] Files > 10MB: spawn a Web Worker to compute off the main thread (prevents UI freeze)
  - [ ] Create `src/workers/hashWorker.js` — receives an `ArrayBuffer`, returns hex string
  - [ ] Use `new Worker(new URL('../workers/hashWorker.js', import.meta.url))`
- [ ] Returns `{ hash, isHashing, error }`

### 5.3 Step 1 — Metadata Form (`StepMetadata.jsx`)

Implement the full form from CLAUDE.md §10:

- [ ] `<InstitutionSearch />` — must resolve to QID before allowing advance
- [ ] Program / Degree: free text input
- [ ] Course Name: free text input
- [ ] Course Code: free text input (optional — show `(optional)` label)
- [ ] Exam Year: `<select>` from current year down to 2000
- [ ] Month / Session: `<select>` — all twelve months
- [ ] Exam Type: radio group — `Main`, `Supplementary`, `Model`, `Improvement`
- [ ] Semester: `<select>` — Semester 1 through 8 + "Annual" option
- [ ] Language: `<select>` — at minimum: `en`, `ml`, `hi`, `ta`, `te`, `kn`
- [ ] PDF drop zone:
  - [ ] Accepts drag-and-drop
  - [ ] Accepts click-to-browse
  - [ ] Validates MIME type is `application/pdf`
  - [ ] Validates first 4 bytes are `25 50 44 46` (`%PDF`) — read via `FileReader`
  - [ ] Validates size ≤ 50MB (51200 KB) — enforce before hashing
  - [ ] Shows filename + size once accepted
  - [ ] Shows error inline if validation fails
- [ ] Identifier preview: `<details>` element (collapsed by default) showing computed identifier as fields are filled
- [ ] On valid submit: compute identifier → store in wizard; trigger file hashing → store hash; advance to Step 2

### 5.4 Step 2 — Duplicate Check (`StepDedupCheck.jsx`)

Non-interactive auto-running step:

- [ ] On mount, call `runAllDedupLayers({ hashHex, identifier })` from `lib/dedup.js`
- [ ] Show three-item checklist with spinner → ✓ as each layer completes:
  - [ ] "Computing file fingerprint..." (done before this step — show as already ✓)
  - [ ] "Searching for matching files..." (Layer 1 — hash check)
  - [ ] "Checking for matching entry..." (Layer 2 — identifier check)
- [ ] **Clean result:** show green "✓ This paper is new. Ready to upload." + `[← Edit Details]` + `[Upload Paper →]`
- [ ] **Duplicate found:** show the duplicate item (thumbnail + title + institution + year) with a "View on Archive.org ↗" link; show "Thanks for trying to contribute!" + `[← Edit Details]` (no upload button)

### 5.5 Upload Worker (`functions/api/upload.js`)

- [ ] Implement the Worker exactly as specified in CLAUDE.md §9
- [ ] Security checks:
  - [ ] Reject requests missing `accessKey`, `secretKey`, `identifier`, `file`, or `meta`
  - [ ] Content-Type of file must be `application/pdf`
- [ ] Meta headers: iterate `meta` object and prefix each key with `x-archive-meta-`
- [ ] Always include:
  - [ ] `x-archive-auto-make-bucket: 1`
  - [ ] `x-archive-queue-derive: 1` (triggers OCR + thumbnails)
  - [ ] `x-archive-meta-subject: pyqp` and `x-archive-meta-subject: {wikidataQid}`
  - [ ] `x-archive-meta-sha256: {hash}` (Layer 3 dedup)
- [ ] Return `{ ok, status, identifier }` with appropriate HTTP status

### 5.6 Upload Hook (`hooks/useUpload.js`)

- [ ] `startUpload()`:
  - [ ] Calls `setUploadStatus('uploading')`
  - [ ] Reads `accessKey`, `secretKey` from `authStore`
  - [ ] Reads `file`, `fileHash`, `identifier`, `metadata` from `wizardStore`
  - [ ] Builds `FormData` and POST to `/api/upload`
  - [ ] On success: `setUploadStatus('success')`
  - [ ] On `401`: `setUploadError('session_expired')`
  - [ ] On `503`: `setUploadError('slow_down')`
  - [ ] On network failure: `setUploadError('network')`
  - [ ] On any other non-ok: `setUploadError('rejected')`

### 5.7 Step 3 — Upload Progress (`StepUpload.jsx`)

- [ ] On mount, call `startUpload()` from `useUpload`
- [ ] Show filename + file size
- [ ] Progress bar — indeterminate (pulse animation) since `fetch` doesn't expose upload progress without `XMLHttpRequest`; revisit post-v0.1.0
- [ ] **Success state** (from CLAUDE.md §10):
  - [ ] "✓ Paper archived successfully!"
  - [ ] Permanent URL: `archive.org/details/{identifier}` as a clickable link
  - [ ] `[View Paper ↗]` + `[Upload Another]` buttons
  - [ ] Note about processing time for OCR + thumbnails
- [ ] **Error states** — four variants from CLAUDE.md §10 error table:
  - [ ] `session_expired` → "Your Archive.org session expired. Please sign in again." + `[Sign In]` button
  - [ ] `slow_down` → "Archive.org is busy. Please wait a moment and try again." + `[Retry]`
  - [ ] `network` → "Connection failed. Check your internet and try again." + `[Retry]`
  - [ ] `rejected` → "Archive.org rejected this file. Ensure it is a valid PDF and try again."

### 5.8 Upload Wizard Root (`UploadWizard/index.jsx`)

- [ ] Read `step` from `wizardStore`
- [ ] Render `StepMetadata` when `step === 1`
- [ ] Render `StepDedupCheck` when `step === 2`
- [ ] Render `StepUpload` when `step === 3`
- [ ] Step indicator at top: three dots or numbered steps with current step highlighted
- [ ] On unmount (user navigates away mid-wizard): call `resetWizard()` after confirmation dialog ("Are you sure? Your progress will be lost.")

### 5.9 Upload Page (`Upload.jsx`)

- [ ] If not logged in: show `<LoginModal />` immediately (do not show wizard)
- [ ] After login: show `<UploadWizard />`
- [ ] If already logged in on arrival: show wizard directly

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
- [ ] Colour contrast passes WCAG AA for all text on `pyqp-bg` background

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
