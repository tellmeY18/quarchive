# Design

**https://brand.letsimpl.fyi is the source of truth for design.** Colour, type, spacing, components and accessibility live there, not here. This app vendors the plain files unedited into `brand/` and loads them in this order: `tokens/tokens.css`, `css/base.css`, `css/components.css`, then `styles.css`.

`styles.css` is the app layer only: page layout built from brand tokens using the brand's `ls-` classes. It defines no colours, fonts or components of its own. If something is missing from the brand, change the brand first.

## Decisions

| Decision | Choice |
|---|---|
| Stack | Static files, Preact + htm from `vendor/`, no build step, no runtime npm dependencies |
| Routing | Hash routes, so a static host needs no rewrite rules |
| State | URL as state; small guarded localStorage stores where persistence is required |
| Visual identity | Brand black/white system; square corners; mono UI type; reading type for prose |
| Navigation | Sticky header with live-text wordmark and theme button; bottom bar on phones; top nav + footer on wider screens |
| Primary viewport | Phone (≤430px), one column, bottom-anchored CTAs, 48px targets |
| Motion | Brand's 120ms state changes and 200ms sheets only; honour reduced motion |
| Third parties | None in the shell; CSP allows only Archive.org/Wikidata API hosts needed by the app |
| Storage | Internet Archive IAS3 via same-origin Pages Functions; no database, no account system of our own |

## Screens

- `#/` — search, filters, archived-paper count, results grid. Deep links carry university, year and exam type.
- `#/browse` — institutions from Wikidata plus year and exam-type entry points.
- `#/paper/:identifier` — metadata, download and Archive.org links, lazy canvas PDF viewer.
- `#/upload` — sign-in gate; camera-first on phones, PDF picker on desktop; metadata, dedup, upload steps.
- `#/upload/bulk` — batch PDF selection, shared institution, per-file metadata, serial OCR, bounded upload queue.
- `#/about` — mission, how it works, attribution, privacy.

Both auth and bulk metadata use the brand's bottom `ls-sheet` dialog. Empty states use `.ls-slot`; errors and warnings use `ls-callout` variants with an icon and a word, never colour alone.

## Data and privacy

Search and metadata come from Archive.org; institution search from Wikidata SPARQL, cached for seven days. Credentials go to the same-origin `/api/login`, `/api/s3keys` and `/api/validate` functions and are never stored server-side or displayed. Camera frames, image-to-PDF conversion and OCR stay in the browser; scribe.js WASM and language data are same-origin under `vendor/scribe/`. All external fetches are anonymous and abortable.

## Offline

`sw.js` precaches the app shell and serves navigations from the cached `./`. Cross-origin data stays on the network. Updates are checked on visibility/online/interval and applied only when the page is idle with no open dialog or focused input.

## Identity kit

The official Quarchive kit — the founder's duck in a graduation cap — is vendored unedited from `https://brand.letsimpl.fyi/assets/quarchive/` into `icons/` by `npm run brand`. The header wordmark itself remains live text in CSS, not an image.

This file contains no brand copy. Product words are kept to functional labels; founder-reviewed prose lives in `README.md`.
