# Quarchive 🦆

> *Every paper. Every quack.*
>
> The open-source archive of previous year university exam question papers.
> Permanently free, powered by the Internet Archive.

## About the name

**Quarchive** = **Quack** + **Archive**. The project mascot — **Quackademic**, a scholarly duck who keeps papers safe — is planned but **not yet implemented**: the visual branding (logo, favicon, mascot illustrations, OG image) is deferred to **Phase 10** of [`ROADMAP.md`](./ROADMAP.md). Both Phase 9 (Bulk Upload) and Phase 10 (Branding) are currently on hold; maintenance and correctness work take priority.

Prompts for regenerating brand assets once Phase 10 starts live in [`Generate.md`](./Generate.md) (gitignored; each maintainer keeps their own copy). None of those assets are wired into the app yet.

## Features

- 🔍 **Search & Browse** — Find papers by university, course, year, or exam type
- 📄 **PDF Viewer** — Preview papers directly in the browser
- 📷 **Scan & Upload** — Snap the paper on your phone; auto-crop, enhance, and OCR-assisted metadata happen on device
- 📂 **Bulk Upload** *(Phase 9, deferred)* — Planned: drop a folder of PDFs from a laptop; path-aware metadata inference, per-file dedup, and a crash-resilient queue. Full design locked in `ROADMAP.md`, implementation paused.
- 🏛️ **Permanent Storage** — Every paper is stored on the Internet Archive — free forever
- ☁️ **No Backend** — Fully serverless, runs on Cloudflare Pages

## Tech Stack

- **Frontend:** React 19, Tailwind CSS v4, React Router v7, Zustand v5
- **Capture pipeline:** `pdf-lib`, `browser-image-compression`, pure-canvas Sobel + Hough edge detection
- **On-device OCR:** `scribe.js-ocr` (AGPL-3.0)
- **Storage:** Internet Archive (IAS3)
- **Institution Data:** Wikidata SPARQL
- **Hosting:** Cloudflare Pages + Pages Functions

## Brand *(deferred — Phase 10)*

The duck identity is planned but not implemented. The palette, mascot brief, voice rules, and asset generation prompts are locked in so whoever picks up Phase 10 can execute it as a single batch without design-by-committee:

| Token | Value | Role |
|---|---|---|
| Duck Yellow | `#F5C518` | Primary accent / CTA |
| Pond Ink | `#1A1D24` | Headings, strong text |
| Paper Cream | `#FAF6EE` | Page background |
| Reed | `#6B7A5A` | Muted secondary / metadata |

See `ROADMAP.md` Phase 10 for the full checklist and `Generate.md` for the Gemini Nano Banana prompts. Branding work is explicitly paused — do not pick up these tasks opportunistically.

**Voice (planned):**
- Primary tagline: *Every paper. Every quack.*
- Short-form: *Scan. Quack. Archive.*
- Long-form: *The open-source archive of previous year question papers.*

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Two dev modes

This project has two parts: a **React frontend** (the SPA) and **Cloudflare Pages Functions** (serverless workers in `functions/api/` that proxy requests to Archive.org). You need to choose the right dev mode depending on what you’re working on.

#### 1. Frontend only — `npm run dev`

```bash
npm run dev
```

Starts the Vite dev server at `http://localhost:5173` with hot module replacement.

**What works:** Browsing, searching, viewing papers, all UI/styling work.

**What doesn’t work:** Sign in, upload, and anything that calls `/api/*` endpoints — those routes are handled by the Cloudflare Pages Functions which aren’t running in this mode. You’ll see network errors if you try to log in.

Use this when you’re working on the UI, search, browse, or paper detail pages.

#### 2. Full stack — `npm run build && npm run dev:full`

```bash
npm run build
npm run dev:full
```

This first builds the frontend into `dist/`, then starts Wrangler (Cloudflare’s local dev tool) which serves both the static frontend **and** the Pages Functions at `http://localhost:8788`.

**What works:** Everything — including sign in with Archive.org, uploading papers, and all `/api/*` endpoints.

**Trade-off:** No hot reload. You need to re-run `npm run build` after each frontend change, then restart `npm run dev:full`. This mode is primarily for testing the auth and upload flows end-to-end.

### Which mode should I use?

| Task | Mode |
|------|------|
| UI work, styling, layout | `npm run dev` |
| Search, browse, paper detail | `npm run dev` |
| Testing sign-in flow | `npm run build && npm run dev:full` |
| Testing upload flow | `npm run build && npm run dev:full` |
| Working on worker functions (`functions/api/`) | `npm run build && npm run dev:full` |

### Project structure (key directories)

```
src/              → React frontend (pages, components, hooks, stores)
functions/api/    → Cloudflare Pages Functions (serverless workers)
  ├── login.js    → Proxies Archive.org login (needed because Archive.org doesn’t allow cross-origin requests)
  ├── s3keys.js   → Generates S3 upload keys for new Archive.org accounts
  ├── upload.js   → Proxies file uploads to Archive.org’s IAS3 storage
  └── validate.js → Checks if stored login credentials are still valid
public/
  ├── brand/      → Duck mascot, logos, favicons, OG image (populated in Phase 10; currently empty)
  └── _redirects  → SPA fallback for Cloudflare Pages
dist/             → Build output (generated by npm run build)
```

## Deployment

Quarchive is designed to be deployed on **Cloudflare Pages** which automatically hosts the static frontend and runs the `functions/api/` directory as serverless Pages Functions.

1. Push your forked repository to GitHub or GitLab.
2. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/) and navigate to **Workers & Pages**.
3. Click **Create application**, select the **Pages** tab, and choose **Connect to Git**.
4. Select your repository and configure the build settings:
   - **Framework preset:** `Vite` (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**.

Cloudflare Pages will automatically detect the `functions/` directory and deploy them alongside your React frontend.

**Environment Variables:**
None! Quarchive requires absolutely zero environment variables or secrets to be configured in Cloudflare. All authentication happens client-side and is securely passed through the workers per-request.

## Architecture

Quarchive is a fully static single-page application deployed on Cloudflare Pages. File uploads go directly to the Internet Archive via IAS3, proxied through Cloudflare Pages Functions for CORS. Institution metadata comes from Wikidata. There is no database, no auth server, and no ongoing cost.

The Pages Functions exist because Archive.org’s login and upload endpoints don’t support cross-origin browser requests. The workers act as thin pass-through proxies — they forward your credentials to Archive.org per-request and never store them.

## Contributing

1. Create an [Internet Archive account](https://archive.org/account/signup)
2. Fork this repository
3. Upload papers through the app, or contribute code via pull requests

## Credits

- **Mascot & brand:** Quackademic the duck — planned (Phase 10); prompts in `Generate.md` target Google Gemini "Nano Banana".
- **OCR:** [`scribe.js-ocr`](https://github.com/scribeocr/scribe.js) — AGPL-3.0
- **Permanent hosting:** [Internet Archive](https://archive.org/)
- **UI inspiration:** [gpura.org](https://gpura.org) — Kerala Digital Archive (Granthappura)

## License

See [LICENSE](LICENSE) for details.