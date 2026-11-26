# Credits

- **Design system** — [letsimpl.fyi brand](https://brand.letsimpl.fyi), tokens, fonts and `ls-` components vendored unedited. Code AGPL-3.0-or-later; design and docs CC BY-SA 4.0. Fonts keep their SIL Open Font Licences in `brand/fonts/`.
- **Preact** — prebuilt ESM in `vendor/`, MIT licence.
- **htm** — prebuilt ESM in `vendor/`, MIT licence.
- **pdf.js** — prebuilt ESM + worker in `vendor/pdfjs/`, Apache-2.0 licence. Used for the lazy paper preview.
- **pdf-lib** — prebuilt ESM in `vendor/`, MIT licence. Used to assemble camera pages into a PDF.
- **browser-image-compression** — prebuilt ESM in `vendor/`, MIT licence. Used before PDF assembly.
- **scribe.js-ocr** — same-origin worker assets in `vendor/scribe/`, AGPL-3.0. Used for optional on-device OCR; no page image or extracted text leaves the browser.
- **Internet Archive** — permanent, free storage and the Advanced Search / metadata APIs.
- **Wikidata** — canonical institution identifiers and SPARQL queries.
- **gpura.org** — Kerala Digital Archive (Granthappura), the original UI inspiration for the mobile-first document layout.
- **Identity kit** — the provisional duck-with-cap mark in `icons/` was drawn by the founder in VectorCraft at their own request; symmetry normalisation, SVG/PNG export and the icon set were produced by an AI subagent. It is not yet part of the brand repo and is pending founder review. No third-party artwork was used.

Versions, source URLs and refresh commands for every vendored library are in `vendor/README.md`.
