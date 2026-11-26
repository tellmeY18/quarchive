# quarchive brand kit

quarchive (quarchive.letsimpl.fyi) is a serverless, open-source archive of previous-year university exam question
papers. This folder is its identity kit. Source of truth is this repo; apps copy from here
(`https://brand.letsimpl.fyi/assets/quarchive/...`).

Status: **ready** (founder-supplied, 2026-11-26).

## Identity

| | |
|---|---|
| Name | **quarchive** (lowercase, one word) |
| Descriptor | **Free. Free Software. Simple and Stupid.** |
| Licence line | AGPL-3.0-or-later |
| Site | quarchive.letsimpl.fyi |

There is no tagline. Do not write one; use the descriptor alone.

## The mark

A duck in a graduation cap. Round head, two solid eyes, a bill drawn as two open curves, and a mortarboard above with
a band, a cord and a bobble hanging on the right. Line work, not filled blocks: 6 units of stroke on a 256-unit grid,
so the drawing stays light and the shells stay open.

Geometry (256-unit grid, viewBox `0 0 256 256`): the mortarboard is a rhombus centred on x 128, spanning x 40.153 to
215.847 and y 25.069 to 95.222. The head is a circular arc closing at y 220.364, with the bill across the lower third.
Visible extent including the stroke is x 37.153 to 227.632, y 22.069 to 223.364 — that box is what the kit scales and
centres against, so the tassel on the right is accounted for.

The mark is *nearly* symmetric: every mirrored control point is exact about x 128, and the tassel is the one
deliberately one-sided element. Do not mirror or remove the tassel.

Small sizes: the stroke is 6 of 256, which is thinner than a typical app icon and reads faint below about 24 px. The
favicon is the same geometry with a `prefers-color-scheme` rule so it switches to white on a dark tab.

The wordmark is "quarchive" in Atkinson Hyperlegible Mono Bold (SIL OFL 1.1), converted to outlines so no file needs
the font. The mark is as tall as the type size and sits on the baseline. Gap between mark and word: about a third of
the type size.

## Use

- Default: black on white (`logo-primary.svg`). On black use `logo-primary-inverse.svg`.
- Clear space: at least half the mark's height on every side.
- Minimum size: the mark 32 px; the lockup 160 px wide.
- On a photo or any busy background use the one-colour logo on a solid white or black block.

Do not: add colour, a drop shadow or a gradient; round the corners; change the stroke weight; add or remove the bill,
the eyes or the tassel; rotate, outline or stretch it; redraw the wordmark in another font; put the mark inside a
rounded shape.

## Files

| File | Use |
|---|---|
| `logo-mark.svg`, `logo-mark-inverse.svg` | Symbol only, transparent |
| `logo-primary.svg`, `logo-primary-inverse.svg` | Lockup (mark + wordmark), 16:9, on page / on ink |
| `logo-mono.svg`, `logo-mono-inverse.svg` | One-colour lockup, transparent |
| `favicon.svg` | Browser tab; follows the device light/dark scheme |
| `app-icon.svg`, `app-icon-192.png`, `app-icon-512.png`, `apple-touch-icon-180.png` | App icons, full bleed, black on white |
| `app-icon-maskable.svg`, `app-icon-maskable-512.png` | Maskable icon (mark inside the 80% safe zone) |
| `splash.svg`, `splash-1080x1920.png` | PWA splash, 9:16 |
| `loading.svg`, `loading-1080x1920.png` | Loading screen, 9:16 (word "Loading") |
| `og-image.svg`, `og-image.png` | Social share image, 1200 x 630 |
| `github-social.svg`, `github-social.png` | GitHub social preview, 1280 x 640 |
| `avatar-400.png` | Profile picture |

## Licence

Design assets: CC BY-SA 4.0 (see `../../LICENSING.md`). The Atkinson Hyperlegible Mono outlines keep the OFL notice
in `../../fonts/`.

## Provenance

The mark was drawn by the founder in VectorCraft on 2026-11-26; its control points were normalised to exact
left-right symmetry, and this kit was generated from it by an AI assistant at the founder's direction, as a
documented exception to the no-agent-brand-material rule. See `../../CREDITS.md` and `../../tools/quarchive-kit.py`.
