# `tests/fixtures/papers/`

Fixture PNG/JPEG images of question-paper front pages used by the
Phase 8 Playwright E2E suite (`tests/e2e.spec.js`).

## Current state

This directory is currently **empty** of real fixtures. The Phase 8
E2E specs that depend on fixture imagery are structured so they can
drive the capture pipeline once fixtures are added, but they do not
currently load any file from here.

The reason we ship the directory with just this README is:

1. It gives the repo a single, documented home for these assets so
   they don't sprawl.
2. It keeps `npm test` / `npm run test:e2e` green on a fresh clone —
   missing fixtures are treated as "test skipped" rather than "test
   failed".
3. Adding a fixture later is a mechanical change (drop PNG here,
   reference it from a spec) rather than a schema change.

## Expected fixture shape

Each fixture should be a **single front-page image** of a question
paper, with these visible near the top of the page:

- Institution header (e.g. "National Institute of Technology Calicut")
- A clear course name line (e.g. "Data Structures")
- A clear course code (e.g. "CS301", "CS 301", "ECE202A", "BT-204" —
  mix formats across fixtures so we exercise `normaliseCourseCodeForSlug`)
- An exam-type keyword matching one of the canonical values —
  `Supplementary`, `Model Question Paper`, `End Semester`,
  `Mid Semester`, `Make-up`, `Re-Examination`, `Improvement`,
  `Save-A-Year`, or `Regular`.

**Image format:** PNG or JPEG, ≤ 1500px on the long edge, ≤ 500 KB.
Larger fixtures slow down CI without helping assertions.

**Privacy:** Do not commit scans of actual student exam papers that
include personal identifiers. Use publicly-released past papers from
university websites, or hand-crafted synthetic images (we generate
one synthetic frame directly inside `tests/e2e.spec.js` in the
"pure-canvas pipeline smoke test").

## Naming convention

`<exam-type>-<course-code>-<year>.png`

Examples once added:

- `supplementary-cs301-2023.png`
- `end-semester-ece202a-2022.png`
- `model-bt-204-2024.png`

## Using a fixture from a spec

```
const fixturePath = path.resolve(
  __dirname,
  "fixtures/papers/supplementary-cs301-2023.png",
);
// Feed via Playwright's setInputFiles on a hidden <input type="file"/>
// OR via `--use-file-for-fake-video-capture` if exercising getUserMedia.
```

Both paths are expected to be added in a follow-up change — see
`ROADMAP.md` §8.8.