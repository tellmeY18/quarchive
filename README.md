# Quarchive

> The open-source archive of previous year university exam question papers.
> Permanently free, powered by the Internet Archive.

Quarchive is a static, serverless web app. Students can find papers by university, course, year and exam type, preview them in the browser, and upload scanned or photographed papers directly to the Internet Archive. There is no database, no account system of our own and no ongoing cost.

## How it works

- **Search & browse** — Archive.org Advanced Search API, filtered to `subject:quarchive`; institutions come from Wikidata.
- **Paper detail** — metadata, download and item links, with a lazy canvas PDF viewer.
- **Upload** — PDFs only. On a phone the camera is the first step: frames are detected, cropped, enhanced and assembled into a PDF on the device. Optional on-device OCR suggests metadata; nothing is auto-filled or sent away.
- **Bulk upload** — drop up to 50 PDFs, share an institution across the batch, confirm each file's metadata, then upload with bounded concurrency and per-file dedup.
- **Permanent storage** — files go to Archive.org IAS3 through same-origin Cloudflare Pages Functions, which exist only to proxy requests that Archive.org does not allow cross-origin.

## Stack and style

The design is the [letsimpl.fyi brand system](https://brand.letsimpl.fyi): black and white, Atkinson Hyperlegible Mono, square corners, `ls-` components, light/dark and accessibility settings. Brand files are vendored unedited into `brand/` and verified by `npm run brand:check`.

The app follows the org's house style: plain HTML/CSS with Preact + htm imported from `vendor/`, **no build step and no runtime npm dependencies**. Hash routes work on any static host. `sw.js` precaches the shell; `_headers` sets a strict CSP. The only server code is `functions/api/`.

## Development

Prerequisites: Node.js 20+, Python 3. From a Nix shell, `nix develop` supplies everything including Playwright and Chromium.

```bash
python3 tools/serve.py      # static UI at http://localhost:8080
npm test                    # node:test units + design/shell policy tests
npm run test:e2e            # Playwright against the production CSP
npm run brand               # re-fetch brand files from brand.letsimpl.fyi
npm run brand:check         # fail on vendored-brand drift
treefmt                     # format before committing
```

To exercise sign-in or upload, run the site through Cloudflare Pages Functions with `wrangler pages dev` against a staged `dist/`; the static server cannot handle `/api/*`. No environment variables or secrets are required to deploy.

## Deployment

Push to `main`. `.github/workflows/deploy.yml` runs the tests, stages `dist/` (including `functions/`), stamps `sw.js` and `js/config.js` with the same version, verifies every precached path exists and deploys to the Cloudflare Pages project `quarchive`.

## Identity

The official Quarchive kit — the founder's duck in a graduation cap — comes from the brand repo and is vendored unedited into `icons/` by `npm run brand`; see `icons/README.md`. The header wordmark itself is live text in CSS.

## Licence

Code: AGPL-3.0-or-later. Brand material and docs: see `../brand/LICENSING.md`. Vendored libraries keep their own licences; see `CREDITS.md` and `vendor/README.md`.
