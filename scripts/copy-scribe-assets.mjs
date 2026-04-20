#!/usr/bin/env node
/**
 * Postinstall: copy scribe.js-ocr runtime assets to public/vendor/scribe/
 *
 * Scribe.js in the browser MUST be served same-origin (loading from a CDN
 * is explicitly unsupported by its authors — see CLAUDE.md §5B / §21 invariant 18).
 *
 * We copy the scribe.js module code + its tessdata (language models) + WASM
 * dependencies out of node_modules into public/vendor/scribe/ so that the
 * Vite dev server and the Cloudflare Pages build both serve them from
 * our own origin.
 *
 * Safe to run repeatedly (idempotent). Silent if scribe.js-ocr is not
 * installed — this keeps `npm ci` on CI working when the optional dep
 * is stripped in some environments.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SCRIBE_SRC = path.join(projectRoot, 'node_modules', 'scribe.js-ocr');
const VENDOR_DST = path.join(projectRoot, 'public', 'vendor', 'scribe');

/** Entries to copy from node_modules/scribe.js-ocr → public/vendor/scribe. */
const ENTRIES = [
  // Core scribe.js module + its internal lib/ folder (workers, WASM, fonts).
  { from: 'scribe.js', to: 'scribe.js' },
  { from: 'lib', to: 'lib' },
  // Tesseract language data — required for OCR to actually run.
  { from: 'tess', to: 'tess' },
  // Fonts bundled by scribe (used for layout-aware text extraction).
  { from: 'fonts', to: 'fonts' },
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(src, dst) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dst, { recursive: true });
    const entries = await fs.readdir(src);
    await Promise.all(
      entries.map((entry) =>
        copyRecursive(path.join(src, entry), path.join(dst, entry)),
      ),
    );
  } else {
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }
}

async function main() {
  if (!(await pathExists(SCRIBE_SRC))) {
    // scribe.js-ocr not installed — nothing to copy. Phase 8 OCR will
    // silently fall back to "no suggestions" at runtime, which is the
    // documented behaviour (CLAUDE.md invariant 14).
    console.log(
      '[copy-scribe-assets] scribe.js-ocr not installed, skipping vendor copy',
    );
    return;
  }

  await fs.mkdir(VENDOR_DST, { recursive: true });

  let copied = 0;
  let skipped = 0;
  for (const { from, to } of ENTRIES) {
    const src = path.join(SCRIBE_SRC, from);
    const dst = path.join(VENDOR_DST, to);
    if (!(await pathExists(src))) {
      skipped++;
      continue;
    }
    // Clean destination so stale files don't linger across scribe.js upgrades.
    if (await pathExists(dst)) {
      await fs.rm(dst, { recursive: true, force: true });
    }
    await copyRecursive(src, dst);
    copied++;
  }

  // Write a small marker so we can detect a successful copy at runtime
  // without guessing at directory layout.
  await fs.writeFile(
    path.join(VENDOR_DST, '.quarchive-vendor'),
    JSON.stringify(
      {
        copiedAt: new Date().toISOString(),
        entries: ENTRIES.map((e) => e.to),
      },
      null,
      2,
    ),
  );

  console.log(
    `[copy-scribe-assets] copied ${copied} entries to public/vendor/scribe/ (skipped ${skipped})`,
  );
}

main().catch((err) => {
  // Never fail the install. Phase 8 is best-effort; the rest of Quarchive
  // must remain installable even if asset copy goes wrong.
  console.warn('[copy-scribe-assets] WARNING:', err.message);
});
