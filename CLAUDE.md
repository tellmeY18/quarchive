# CLAUDE.md — Previous Year Question Papers (PYQP) Platform

> This is the authoritative reference for any developer or AI working on this codebase.
> Read this in full before writing code, making decisions, or modifying any existing pattern.

---

## 1. Project Identity

**What this is:**
A serverless, open-source platform for students to discover and upload previous year university exam question papers. Permanently free, no proprietary backend, built entirely on open infrastructure.

**What this is NOT:**
- A hosting service for textbooks, notes, or copyrighted material
- A platform requiring a central database or user registration on our side
- A scraper or aggregator of third-party content

**Core Philosophy — three constraints, always simultaneously:**
1. **Zero ongoing cost** — no servers, no paid APIs, no databases
2. **Permanent availability** — content outlives the project
3. **Open infrastructure** — no proprietary lock-in; every layer is replaceable

---

## 2. UI Design Reference — gpura.org

The visual design is inspired by **https://gpura.org** (Kerala Digital Archive / Granthappura). Study this site before touching any component.

### Design Language

| Attribute | Direction |
|---|---|
| Aesthetic | Editorial archive — clean, typographic, document-first |
| Tone | Institutional but approachable; academic without being sterile |
| Layout | Content-forward; generous whitespace; grid-based item display |
| Typography | Bilingual-ready (English + Malayalam/regional scripts); serif or semi-serif for headings, clean sans-serif for body |
| Color palette | Neutral base (off-white / warm white background); one restrained accent color; muted grays for metadata |
| Imagery | Thumbnail previews of paper pages; no decorative stock photos |
| Navigation | Simple top nav: logo left, links right, one CTA button ("Upload") |
| Stats bar | Prominent count display (total papers, universities, languages, states) — mirrors gpura.org's "8151 Items / 17 Languages / 42 Collections" strip |
| Item cards | Thumbnail + title + metadata chip row (university, year, exam type) — mirrors gpura.org's document cards |
| Footer | Minimal — project name, links (About, Contribute, GitHub), attribution |

### Key UI Patterns Borrowed from gpura.org

1. **Stats strip** — A horizontal banner of live counters (from Archive.org search API) below the hero. Shows: Papers archived, Universities, Languages, States.
2. **Section headers** — Short, purposeful titles ("Recent Uploads", "Browse by University", "Browse by Year") — not tabs, not accordions.
3. **Card grid** — 3-column desktop, 2 tablet, 1 mobile. Each card: thumbnail at top, title, institution name, year chip, exam-type chip.
4. **Browse facets** — Sidebar or horizontal chips for filtering by university, year, state, exam type.
5. **Bilingual labels** — Show institution names in both English and regional script when available from Wikidata.

### What gpura.org Does That We Must NOT Copy

- gpura.org uses Omeka S (server-side CMS) — we are fully static/serverless
- gpura.org has an admin-gated upload process — ours is self-serve
- gpura.org targets rare historical documents — ours targets contemporary exam papers

---

## 3. Tech Stack

### Frontend
| Layer | Choice | Reason |
|---|---|---|
| Framework | React 19 (Vite 8, SPA) | Cloudflare Pages ecosystem; large component ecosystem |
| Styling | Tailwind CSS v4 | Utility-first; CSS-first config via `@theme`; automatic content detection |
| Routing | React Router v7 (library mode) | Declarative; works on static hosting with `_redirects` |
| State | Zustand v5 | Lightweight; no boilerplate; ideal for auth + wizard state |
| HTTP | Native `fetch` | No axios; keep bundle lean |
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
| Geocoding (optional) | OpenStreetMap Nominatim | "Papers near your university" feature |

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
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── StatsStrip.jsx       ← Live counters (papers/universities/languages)
│   │   ├── search/
│   │   │   ├── SearchBar.jsx
│   │   │   ├── FilterChips.jsx
│   │   │   ├── PaperCard.jsx
│   │   │   └── PaperGrid.jsx
│   │   ├── auth/
│   │   │   ├── LoginModal.jsx       ← Archive.org login modal
│   │   │   ├── LoginForm.jsx        ← Email + password form
│   │   │   └── AuthStatus.jsx       ← Logged-in state indicator in Navbar
│   │   ├── upload/
│   │   │   ├── UploadWizard/
│   │   │   │   ├── index.jsx        ← Multi-step wizard root
│   │   │   │   ├── StepMetadata.jsx ← Paper metadata form
│   │   │   │   ├── StepDedupCheck.jsx
│   │   │   │   └── StepUpload.jsx
│   │   │   └── InstitutionSearch.jsx
│   │   └── paper/
│   │       └── PdfViewer.jsx
│   ├── hooks/
│   │   ├── useArchiveAuth.js        ← Archive.org login, logout, session state
│   │   ├── useArchiveSearch.js      ← Search API wrapper
│   │   ├── useWikidataLookup.js     ← SPARQL queries
│   │   ├── useFileHash.js           ← Web Crypto SHA-256
│   │   └── useUpload.js             ← Upload orchestration
│   ├── lib/
│   │   ├── archiveOrg.js            ← IAS3 upload, search, URL builders
│   │   ├── wikidata.js              ← SPARQL templates + parsers
│   │   ├── dedup.js                 ← All 3 dedup layers
│   │   ├── metadata.js              ← Schema builder + validator
│   │   └── universities.json        ← Curated seed list (name → Wikidata QID)
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Upload.jsx
│   │   ├── Paper.jsx
│   │   ├── Browse.jsx
│   │   └── About.jsx
│   ├── store/
│   │   ├── authStore.js             ← Zustand: Archive.org session state
│   │   └── wizardStore.js           ← Zustand: upload wizard state
│   └── styles/
│       └── index.css
├── functions/
│   └── api/
│       ├── login.js                 ← Proxy: Archive.org xauthn login
│       ├── s3keys.js                ← Proxy: Generate S3 keys for new accounts
│       └── upload.js                ← Proxy: IAS3 PUT upload
├── vite.config.js
└── package.json
```

---

## 5. Archive.org Authentication — The Complete System

This is the most critical and novel part of the architecture. **Users log in to Archive.org from within our site.** They never need to manually locate or copy S3 keys. The entire authentication is handled invisibly.

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

---

### Auth Flow — Sequence Diagram

```
User clicks "Sign in with Archive.org"
  │
  └── LoginModal opens (in our UI — no page redirect, no popup)
        │
        └── User enters Archive.org email + password
              │
              └── POST /api/login (our Cloudflare Worker)
                    │
                    ├── Worker POSTs to:
                    │     https://archive.org/services/xauthn/?op=login
                    │     body: email, password, remember=CHECKED, referer, login=true
                    │
                    ├── Archive.org returns Set-Cookie headers:
                    │     logged-in-user=...
                    │     logged-in-sig=...
                    │
                    ├── Worker extracts cookie values from response headers
                    │
                    └── Worker GETs https://archive.org/account/s3.php
                          with Cookie: logged-in-user=...; logged-in-sig=...
                          │
                          └── Parses HTML to extract:
                                accessKey  (regex on input[name=access] value)
                                secretKey  (regex on input[name=secret] value)
                                screenname (regex on page content)
                                │
                                └── Returns JSON to frontend:
                                      {
                                        ok: true,
                                        screenname: "username",
                                        email: "user@example.com",
                                        accessKey: "ABCD1234EFGH5678",
                                        secretKey: "abcd1234efgh5678",
                                        cookies: {
                                          loggedInUser: "...",
                                          loggedInSig: "..."
                                        }
                                      }

Frontend receives success response
  │
  ├── Stores based on "Remember me" checkbox:
  │     Checked  → localStorage  (persists across sessions)
  │     Unchecked → sessionStorage (clears when tab closes)
  │     Keys stored: pyqp_access_key, pyqp_secret_key, pyqp_screenname, pyqp_email
  │
  └── authStore (Zustand) updated:
        { isLoggedIn: true, screenname, email, accessKey, secretKey }
        │
        └── LoginModal closes
            Navbar updates: shows screenname + active Upload button
```

### Special Case: User Has No S3 Keys Yet

Some Archive.org accounts exist but have never visited the S3 keys page, so no keys have been generated. The login Worker detects this:

```
Login succeeds (cookies obtained)
  │
  └── GET archive.org/account/s3.php → HTML has no key values
        │
        └── Worker returns: { ok: false, error: 'no_keys', cookies: {...} }
              │
              └── Frontend shows inline sub-step in LoginModal:
                    "Your Archive.org account doesn't have upload keys yet.
                     We'll generate them automatically."
                     [Generate Keys →]
                    │
                    └── Frontend calls POST /api/s3keys with cookies
                          │
                          └── Worker POSTs to archive.org/account/s3.php
                                with action: generate-new-key
                                Returns freshly generated accessKey + secretKey
                                │
                                └── Login completes normally
```

### Cloudflare Worker — `/functions/api/login.js`

```javascript
export async function onRequestPost(context) {
  const body = await context.request.formData();
  const email    = body.get('email');
  const password = body.get('password');

  // Step 1: Authenticate with Archive.org
  const loginRes = await fetch('https://archive.org/services/xauthn/?op=login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email, password,
      remember: 'CHECKED',
      referer: 'https://archive.org',
      login: 'true',
      submit_by_js: 'true',
    }).toString(),
    redirect: 'manual',
  });

  // Extract session cookies
  const cookieMap = {};
  for (const [, value] of loginRes.headers.entries()) {
    if (value.startsWith('logged-in-user=')) {
      cookieMap.loggedInUser = value.split(';')[0].replace('logged-in-user=', '');
    }
    if (value.startsWith('logged-in-sig=')) {
      cookieMap.loggedInSig = value.split(';')[0].replace('logged-in-sig=', '');
    }
  }

  if (!cookieMap.loggedInUser || !cookieMap.loggedInSig) {
    return Response.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  // Step 2: Fetch S3 keys
  const s3Html = await (await fetch('https://archive.org/account/s3.php', {
    headers: {
      Cookie: `logged-in-user=${cookieMap.loggedInUser}; logged-in-sig=${cookieMap.loggedInSig}`,
    },
  })).text();

  const accessMatch = s3Html.match(/name="access"[^>]*value="([^"]+)"/);
  const secretMatch = s3Html.match(/name="secret"[^>]*value="([^"]+)"/);

  if (!accessMatch || !secretMatch) {
    return Response.json({ ok: false, error: 'no_keys', cookies: cookieMap }, { status: 200 });
  }

  return Response.json({
    ok: true,
    screenname: email.split('@')[0], // improve: parse from HTML if available
    email,
    accessKey: accessMatch[1],
    secretKey: secretMatch[1],
    cookies: cookieMap,
  });
}
```

### Cloudflare Worker — `/functions/api/s3keys.js`

Called only when `login.js` returns `{ error: 'no_keys' }`. Uses session cookies to trigger key generation on Archive.org, then returns the new keys.

### Auth State — Zustand Store (`store/authStore.js`)

```javascript
{
  isLoggedIn:   false,
  screenname:   null,    // Archive.org username
  email:        null,
  accessKey:    null,    // IAS3 access key — never displayed in UI
  secretKey:    null,    // IAS3 secret key — never displayed in UI
  loginError:   null,    // Shown in LoginModal on failure
  isLoggingIn:  false,   // Loading state during login request
}
```

### Session Persistence — App Load Sequence

In `App.jsx`, on mount:
1. Check `localStorage` for `pyqp_access_key` + `pyqp_secret_key` (Remember me was checked)
2. If found, restore into Zustand store immediately — no network call
3. Else check `sessionStorage` (current tab session only)
4. Validate keys are still live: `GET https://s3.us.archive.org/?check_auth=1` via Worker — if 403, clear storage, show logged-out state

---

## 6. Login UX — LoginModal Component

Triggered by:
- Clicking "Sign In" in the Navbar
- Clicking "Upload" while logged out (modal appears, then wizard opens after success)

This is an **in-page modal overlay**, never a redirect or popup window.

### Modal Layout

```
┌──────────────────────────────────────────────┐
│                                              │
│  Sign in with Internet Archive               │
│                                              │
│  Upload papers directly using your existing  │
│  Archive.org account.                        │
│                                              │
│  Email ______________________________        │
│                                              │
│  Password ___________________________        │
│  (your archive.org password)                 │
│                                              │
│  ☐ Remember me on this device               │
│                                              │
│  [ Sign In ]                                 │
│                                              │
│  Don't have an account?                      │
│  → Sign up at archive.org ↗                  │
│                                              │
│  ───────────────────────────────             │
│  🔒 Your password is sent directly to        │
│  Archive.org. We never store it.             │
│                                              │
└──────────────────────────────────────────────┘
```

### Modal States

| State | What the user sees |
|---|---|
| Default | Empty form |
| Loading | "Signing in..." spinner; fields + button disabled |
| Wrong credentials | Inline red error: "Incorrect email or password" |
| No keys | Sub-step: "Generating your upload keys..." with spinner, auto-proceeds |
| Network error | "Connection failed — please try again" + Retry button |
| Success | Modal closes; Navbar updates to show screenname |

### Navbar — `AuthStatus.jsx`

**Logged out:**
```
[Sign In]   [↑ Upload]
```
Clicking "Upload" triggers LoginModal first.

**Logged in:**
```
◉ screenname   [↑ Upload]   [Sign Out]
```
Clicking `screenname` → opens `https://archive.org/details/@{screenname}` in a new tab.
Clicking "Sign Out" → clears storage, resets Zustand store, reloads page.

---

## 7. Core Data Model — Metadata Schema

### Deterministic Item Identifier

```
pyqp--{wikidata-qid}--{course-code-slug}--{year}--{exam-type}
```

Examples:
- `pyqp--Q874586--cs301--2023--main`
- `pyqp--Q1329528--ma101--2022--supplementary`

Rules:
- `wikidata-qid` — Q-number from Wikidata for the institution
- `course-code-slug` — lowercase, alphanumeric + hyphens only
- `year` — 4-digit exam year
- `exam-type` — one of: `main`, `supplementary`, `model`, `improvement`

**Why deterministic?** Two users uploading the same paper compute the same identifier. Archive.org rejects the second as a conflict. Free structural deduplication with zero backend state.

### Metadata Fields

| Field | Archive.org Key | Example | Notes |
|---|---|---|---|
| Collection tag | `subject` | `pyqp` | Always present |
| Institution canonical | `subject` | `Q874586` | Wikidata QID, second subject value |
| Institution display | `creator` | `University of Kerala` | Human-readable |
| Exam year | `date` | `2023` | ISO year |
| Language | `language` | `en` / `ml` / `hi` | ISO 639-1 |
| Full description | `description` | `B.Sc CS - Data Structures (CS301) - April 2023 Main` | |
| Content hash | `sha256` | `a3f9...` | Computed client-side via Web Crypto |
| Exam type | `exam-type` | `supplementary` | Custom field |
| Semester | `semester` | `4` | Custom field |
| Course code | `course-code` | `CS301` | Custom field |
| Degree/program | `program` | `B.Sc Computer Science` | Custom field |

---

## 8. Deduplication — Three-Layer Strategy

All three layers run before any upload proceeds. A match at any layer cancels the upload.

### Layer 1 — Content Hash (Client-Side)

```javascript
// useFileHash.js
const hashBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
const hashHex = Array.from(new Uint8Array(hashBuffer))
  .map(b => b.toString(16).padStart(2, '0')).join('');

// Query Archive.org for this hash
const url = `https://archive.org/advancedsearch.php?q=subject:pyqp+AND+sha256:${hashHex}&output=json`;
// results.length > 0 → duplicate found
```

### Layer 2 — Deterministic Identifier Check

```javascript
// dedup.js
export function buildIdentifier({ wikidataQid, courseCode, year, examType }) {
  const slug = courseCode.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `pyqp--${wikidataQid}--${slug}--${year}--${examType}`;
}

const res = await fetch(`https://archive.org/metadata/${identifier}`);
// res.ok (200) → item exists → duplicate
```

### Layer 3 — IAS3 Checksum Header (During Upload)

The Cloudflare Worker appends `x-archive-meta-sha256: {hash}` to the PUT request. IAS3 skips writing the file if a matching checksum already exists in the item.

---

## 9. Cloudflare Worker — Upload Proxy (`/functions/api/upload.js`)

```javascript
export async function onRequestPost(context) {
  const formData  = await context.request.formData();
  const accessKey  = formData.get('accessKey');
  const secretKey  = formData.get('secretKey');
  const identifier = formData.get('identifier');
  const file       = formData.get('file');
  const meta       = JSON.parse(formData.get('meta'));

  const filename = encodeURIComponent(file.name);
  const iasUrl   = `https://s3.us.archive.org/${identifier}/${filename}`;

  const metaHeaders = Object.fromEntries(
    Object.entries(meta).map(([k, v]) => [`x-archive-meta-${k}`, v])
  );

  const iasRes = await fetch(iasUrl, {
    method: 'PUT',
    headers: {
      Authorization: `LOW ${accessKey}:${secretKey}`,
      'Content-Type': 'application/pdf',
      'x-archive-auto-make-bucket': '1',
      'x-archive-queue-derive': '1',  // Triggers OCR + thumbnails
      ...metaHeaders,
    },
    body: file.stream(),
  });

  return Response.json(
    { ok: iasRes.ok, status: iasRes.status, identifier },
    { status: iasRes.ok ? 200 : 502 }
  );
}
```

**Security invariants:**
- Keys forwarded immediately; never logged or stored
- Worker has no Archive.org credentials of its own
- All uploads are traceable to the user's personal Archive.org account

---

## 10. Upload Wizard UX — Complete Step-by-Step

Upload requires login. If the user clicks "Upload" while logged out, LoginModal appears first. After successful login, the wizard opens automatically.

---

### Step 1 — Metadata Form (`StepMetadata.jsx`)

```
Upload a Question Paper
──────────────────────────────────────────────

University / Institution    [Searchable autocomplete   ▾]
                            Wikidata-powered. Start typing...

Program / Degree            [________________________]
                            e.g. B.Sc Computer Science

Course Name                 [________________________]
                            e.g. Data Structures

Course Code (optional)      [________________________]
                            e.g. CS301

Exam Year                   [2024 ▾]
Month / Session             [April ▾]
Exam Type                   ○ Main  ○ Supplementary  ○ Model  ○ Improvement
Semester                    [Semester 4 ▾]

Language of paper           [English (en) ▾]

PDF File                    ╔══════════════════════════════╗
                            ║  Drop PDF here               ║
                            ║  or click to browse          ║
                            ║  Max 50MB · PDF only         ║
                            ╚══════════════════════════════╝

▸ Identifier preview: pyqp--Q874586--cs301--2024--main
  (collapsed <details> element, shown as user fills fields)

                                 [Check for Duplicates →]
```

**Validation before advancing:**
- Institution must resolve to a Wikidata QID — free-text is not accepted
- File must be PDF: MIME type validated + first 4 bytes magic check (`%PDF`)
- File ≤ 50MB
- Year, exam type, institution: required
- All other fields: strongly encouraged, warned but not blocked

---

### Step 2 — Duplicate Check (`StepDedupCheck.jsx`)

Non-interactive. Runs automatically after Step 1.

**Clean result:**
```
Checking if this paper already exists...

  ① Computing file fingerprint...          ✓
  ② Searching for matching files...        ✓
  ③ Checking for matching entry...         ✓

  ─────────────────────────────────────────
  ✓ This paper is new. Ready to upload.
  ─────────────────────────────────────────

              [← Edit Details]   [Upload Paper →]
```

**Duplicate found:**
```
  ─────────────────────────────────────────
  This paper is already archived.

  [thumbnail] B.Sc Computer Science — Data Structures
              University of Kerala · 2023 · Main
              Uploaded by: username

              [View on Archive.org ↗]
  ─────────────────────────────────────────

  Thanks for trying to contribute!
  Uploading a different paper?  [← Edit Details]
```

---

### Step 3 — Upload Progress (`StepUpload.jsx`)

```
Uploading to Internet Archive...

  CS301-DataStructures-April2024.pdf  (2.4 MB)
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░  58%

  This may take a moment depending on file size.
```

**On success:**
```
  ────────────────────────────────────────────────────
  ✓ Paper archived successfully!

  Permanently available at:
  archive.org/details/pyqp--Q874586--cs301--2024--main

  [View Paper ↗]    [Upload Another]

  Archive.org will process the PDF for full-text search
  and page-by-page preview within a few hours.
  ────────────────────────────────────────────────────
```

**On failure — by error type:**

| Error type | Message shown |
|---|---|
| 401 Unauthorized | "Your Archive.org session expired. Please sign in again." + [Sign In] |
| 503 Slow Down | "Archive.org is busy. Please wait a moment and try again." + [Retry] |
| Network error | "Connection failed. Check your internet and try again." + [Retry] |
| File rejected | "Archive.org rejected this file. Ensure it is a valid PDF and try again." |

---

## 11. Upload Wizard — Zustand State (`store/wizardStore.js`)

```javascript
{
  step: 1,                  // 1 = Metadata, 2 = Dedup, 3 = Upload
  metadata: {
    institution: { label: '', qid: '' },
    program: '',
    courseName: '',
    courseCode: '',
    year: '',
    month: '',
    examType: '',           // 'main' | 'supplementary' | 'model' | 'improvement'
    semester: '',
    language: 'en',
  },
  file: null,               // File object
  fileHash: '',             // SHA-256 hex string
  identifier: '',           // Computed deterministic identifier
  dedupStatus: null,        // null | 'checking' | 'clear' | 'duplicate'
  duplicateItem: null,      // Archive.org item metadata if duplicate found
  uploadStatus: null,       // null | 'uploading' | 'success' | 'error'
  uploadError: null,
}
```

---

## 12. Archive.org Search Integration

### Search API

```
GET https://archive.org/advancedsearch.php
  ?q=subject:pyqp AND {filters}
  &fl[]=identifier,title,creator,date,subject,description,sha256,semester,exam-type,course-code,program
  &rows=20
  &page=1
  &output=json
```

No proxy needed — CORS is permitted for GET requests.

### Filter Patterns

| Intent | Query addition |
|---|---|
| By university | `AND subject:Q874586` |
| By year | `AND date:2023` |
| By exam type | `AND exam-type:supplementary` |
| By language | `AND language:ml` |
| Full-text | `AND {user query}` |
| Hash lookup | `AND sha256:{hash}` |

### Item URL Patterns

| Resource | URL |
|---|---|
| Metadata | `https://archive.org/metadata/{identifier}` |
| PDF download | `https://archive.org/download/{identifier}/{filename}` |
| Detail page | `https://archive.org/details/{identifier}` |
| Thumbnail | `https://archive.org/services/img/{identifier}` |

---

## 13. Wikidata Institution Autocomplete

### SPARQL Query (for seeding `universities.json`)

```sparql
SELECT ?item ?itemLabel ?itemAltLabel WHERE {
  ?item wdt:P31 wd:Q3918.     # instance of: university
  ?item wdt:P17 wd:Q668.      # country: India
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en,ml,hi,ta,te,kn".
  }
}
ORDER BY ?itemLabel
LIMIT 500
```

### Autocomplete Behavior in `InstitutionSearch.jsx`

1. Load `universities.json` on component mount
2. Filter client-side as user types — **no API calls during typing**
3. Fall back to live Wikidata SPARQL only if local search returns zero matches (500ms debounce on that fallback)
4. Selected value stored as `{ label: "University of Kerala", qid: "Q874586" }`
5. Show institution name + QID chip once selected
6. Bilingual: if Wikidata has a Malayalam/regional label, show it below the English name

**Strictly never call Wikidata on every keystroke.**

---

## 14. Pages

### `Home.jsx`
```
Navbar
Hero (mission statement + prominent search bar)
StatsStrip (live counters: Papers · Universities · Languages · States)
SearchBar + FilterChips (university, year, exam type, language)
PaperGrid (search results, or "Recent Uploads" when no query active)
Footer
```

### `Browse.jsx`
Browse by university, year, state. Grid of filter options, each linking to a pre-filtered Home search.

### `Paper.jsx` — `/paper/:identifier`
```
Navbar
Breadcrumb: Home › University › Course
Paper title + metadata row (year, exam type, semester, language)
Download button (direct Archive.org link) + View on Archive.org link
PdfViewer (pdfjs-dist, lazy-loaded)
Footer
```

### `About.jsx`
Mission, how it works (Search → Download; Contribute → Upload), open source links, Archive.org attribution.

---

## 15. Routing

| Path | Component | Notes |
|---|---|---|
| `/` | Home | Search landing |
| `/browse` | Browse | Faceted browse |
| `/upload` | Upload | Wizard — requires login |
| `/paper/:identifier` | Paper | Detail + PDF viewer |
| `/about` | About | Mission, how-to |

`public/_redirects`:
```
/*  /index.html  200
```

---

## 16. Performance Constraints

| Concern | Rule |
|---|---|
| Search debounce | 300ms — never fire on every keystroke |
| Autocomplete debounce | 200ms for local filter; 500ms for Wikidata fallback |
| Wikidata cache | `localStorage` with 7-day TTL |
| PDF viewer | Lazy-load `pdfjs-dist` on paper detail routes only |
| File size | Enforce 50MB max client-side before hashing |
| SHA-256 hashing | Files over 10MB → run hash in a Web Worker |
| Stats strip | Fetch once on app load, cache in component state |

---

## 17. Moderation & Scope Enforcement

Archive.org is public and permanent. Mitigation:

1. Upload UI clearly states: "Only previous year university exam question papers. No textbooks, notes, or copyrighted course material."
2. PDF-only: validate MIME type + first 4 bytes magic number (`%PDF`).
3. All uploads tied to real Archive.org accounts — no anonymous uploads possible.
4. About page links to Archive.org's item flagging mechanism for abuse reports.
5. All items use `subject: pyqp` — our search only queries within this tag, so off-topic uploads are invisible in our UI even if they exist on Archive.org.

---

## 18. Environment & Build

### Zero Environment Variables

No environment variables needed — not for the frontend, not for the Workers. All endpoints are public; credentials are passed per-request.

### Local Development

```bash
npm install

# Frontend only
npm run dev

# With Pages Functions (Wrangler)
npm run dev:full
```

The `dev:full` script runs: `wrangler pages dev dist --compatibility-date=2024-09-01`

### Build & Deploy

```bash
npm run build
# Cloudflare Pages auto-deploys dist/ on push to main
```

Cloudflare Pages settings:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Node.js version:** 20

---

## 19. Invariants — Never Violate These

1. **Never store the user's Archive.org password anywhere** — not in memory, not in storage, not in logs. The password is sent once to the login Worker and never touched again.
2. **Never store credentials server-side** — Workers forward them per-request and discard immediately.
3. **Never upload using a shared Archive.org account** — every upload uses the authenticated user's own credentials.
4. **Always run all three deduplication layers before upload begins.**
5. **The deterministic identifier formula must never change** once papers are live — it is the foundation of the dedup system.
6. **Never call Wikidata SPARQL on every keystroke.**
7. **Never accept non-PDF files.**
8. **Never display the user's password or raw secret key in any UI element, log, or error message.**

---

## 20. Open Questions / Future Work

- [ ] Verify exact CORS behavior of `archive.org/services/xauthn/?op=login` when proxied through Cloudflare Workers — test this first, before any frontend auth work
- [ ] Handle Archive.org accounts with 2FA enabled (currently: show graceful message with link to manual key entry fallback)
- [ ] GitHub Action to regenerate `universities.json` from Wikidata monthly
- [ ] Evaluate `advancedsearch.php` rate limits under real traffic load
- [ ] Support image-based scanned papers (JPEG/PNG) by merging into a PDF client-side with `pdf-lib`
- [ ] "Papers near your university" map feature via OpenStreetMap Nominatim
- [ ] PWA support for offline access to previously viewed papers
- [ ] Malayalam / regional language UI localisation (following gpura.org's bilingual model)

---

*Architecture: Archive.org IAS3 + Cloudflare Pages Functions + Wikidata*
*UI reference: gpura.org — Kerala Digital Archive (Granthappura)*
