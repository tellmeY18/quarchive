import { defineConfig } from "vitest/config";

/**
 * Vitest configuration — Phase 8 unit tests
 *
 * Scope:
 *   - Only pure-JS unit tests under tests/*.test.js (right now:
 *     tests/metadataExtract.test.js).
 *   - Playwright E2E specs (tests/e2e.spec.js) are explicitly excluded;
 *     they're run by `npm run test:e2e` through @playwright/test and
 *     must not be picked up by vitest (different expect API, browser-
 *     only fixtures).
 *
 * Environment:
 *   - `node` is sufficient — `metadataExtract.js` is pure string/regex
 *     work with no DOM, canvas, or worker dependencies. Keeping the
 *     env minimal also keeps `npm test` fast on CI.
 *
 * Globals:
 *   - `globals: true` so existing specs that were authored with Jest-
 *     style `describe` / `it` / `expect` globals run unchanged. This
 *     is how tests/metadataExtract.test.js is currently written; it
 *     pairs cleanly with the ROADMAP §8.8 note about wiring a Node
 *     test runner without rewriting the tests.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Keep Playwright's e2e spec out of the vitest run — it uses
    // @playwright/test's `test` / `expect` which are incompatible with
    // vitest's. Playwright config handles those separately.
    exclude: [
      "node_modules/**",
      "dist/**",
      "tests/e2e.spec.js",
      "tests/**/e2e.spec.js",
    ],
    // Each test file gets a fresh module registry so a stateful import
    // (e.g. the singleton ocrWorker cache in scribeClient.js) can't
    // leak between suites if future tests reach into those modules.
    isolate: true,
    // Phase 8 unit tests are all synchronous string processing — a
    // generous default timeout is plenty, but we keep it explicit so
    // future slow tests surface as obvious failures rather than hangs.
    testTimeout: 10_000,
  },
});
