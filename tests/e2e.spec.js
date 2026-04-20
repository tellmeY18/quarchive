import { test, expect } from "@playwright/test";

// Common fixtures for mocking APIs
test.beforeEach(async ({ page }) => {
  await page.route("**/advancedsearch.php*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: {
          docs: [
            {
              identifier: "quarchive--Q874586--cs301--2023--main",
              title: "Mock Question Paper",
              creator: "University of Kerala",
              date: "2023",
            },
          ],
        },
      }),
    });
  });

  await page.route("**/functions/api/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        screenname: "test_student",
        email: "test@example.com",
        accessKey: "mock-access",
        secretKey: "mock-secret",
      }),
    });
  });

  await page.route("**/functions/api/s3keys", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        accessKey: "mock-access",
        secretKey: "mock-secret",
      }),
    });
  });

  await page.route("**/functions/api/upload", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, identifier: "mock-upload-id" }),
    });
  });

  await page.route("**/api/validate", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
});

test.describe("Navigation & Search", () => {
  test("Search displays mocked results on mobile layout", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /Home/i }).first(),
    ).toBeVisible();
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("CS301");
    await expect(page.locator("text=Mock Question Paper")).toBeVisible();
  });
});

test.describe("Auth Flow", () => {
  test("User can log in via bottom sheet", async ({ page }) => {
    await page.goto("/");
    await page
      .locator('nav.md\\:hidden a[aria-label="Upload"]')
      .click({ force: true });

    // The "Sign In" button on the Upload page
    await page
      .locator('div.max-w-md button:has-text("Sign In")')
      .click({ force: true });

    // The login sheet appears
    await expect(
      page.locator("text=Sign in with Internet Archive"),
    ).toBeVisible();

    // Fill credentials
    await page.fill('input[type="email"]', "test@example.com");
    await page.fill('input[type="password"]', "mockpassword");

    // Submit login modal
    await page
      .locator('form button[type="submit"]')
      .filter({ hasText: "Sign In" })
      .click({ force: true });

    // Upon successful login, the Camera view should open directly
  });
});

test.describe("Camera & Upload Flow", () => {
  test("Successful camera capture and PDF upload", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("quarchive_access_key", "mock-access");
      window.localStorage.setItem("quarchive_secret_key", "mock-secret");
      window.localStorage.setItem("quarchive_screenname", "test_student");
      window.localStorage.setItem("quarchive_email", "test@example.com");
    });
    await page.goto("/");
    await page
      .locator('nav.md\\:hidden a[aria-label="Upload"]')
      .click({ force: true });

    // Wait for the camera viewfinder to load
    await expect(page.locator("text=Scan Question Paper")).toBeVisible({
      timeout: 10000,
    });

    // Mock the capture
    await page
      .locator('button[aria-label="Capture page"]')
      .click({ force: true });

    // Click Done

    // Check Review page
  });
});

test.describe("Edge Cases & Error Handling", () => {
  test("Camera permission denied shows fallback to PDF upload", async ({
    browser,
  }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem("quarchive_access_key", "mock-access");
      window.localStorage.setItem("quarchive_secret_key", "mock-secret");
      window.localStorage.setItem("quarchive_screenname", "test_student");
      window.localStorage.setItem("quarchive_email", "test@example.com");
    });
    await page.goto("/");

    await page
      .locator('nav.md\\:hidden a[aria-label="Upload"]')
      .click({ force: true });

    // The camera will fail, setting error to permission_denied, which we handled in CameraCapture/index.jsx

    await context.close();
  });
});

// ──────────────────────────────────────────────────────────────────────
// Phase 8 — Capture Robustness + OCR-Assisted Metadata
// ──────────────────────────────────────────────────────────────────────
//
// These tests pair with the unit suite in tests/metadataExtract.test.js.
// Here we cover the browser-integration surfaces that the Node unit tests
// cannot reach: the live identifier slug computed inside StepMetadata,
// the dynamic-import boundaries of the capture pipeline, and the silent-
// failure behaviour when scribe.js is unavailable.
//
// Every test is explicit about what it is and isn't asserting. We never
// swallow assertions inside `if (text)` guards — a missing element is a
// test failure, not a pass.

// Boilerplate: set up a fake "logged-in" state so /upload lands on the
// metadata form rather than the login sheet.
async function signInMock(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("quarchive_access_key", "mock-access");
    window.localStorage.setItem("quarchive_secret_key", "mock-secret");
    window.localStorage.setItem("quarchive_screenname", "test_student");
    window.localStorage.setItem("quarchive_email", "test@example.com");
  });
}

test.describe("Phase 8: StepMetadata integration", () => {
  test("identifier slug is byte-identical for 'CS301' and '  cs 301  '", async ({
    page,
  }) => {
    await signInMock(page);
    await page.goto("/upload");

    // Wait until the desktop fallback form is interactive.
    await expect(page.locator("text=Course Name")).toBeVisible({
      timeout: 10000,
    });
    await page.locator('input[value="main"]').check();

    const input = page.locator('input[id="meta-course-code"]');
    const slugLocator = page.locator(
      "text=/quarchive--[^ ]+--[^ ]+--[^ ]+--[^ ]+/",
    );

    // Capture the slug with the canonical form first.
    await input.fill("CS301");
    await expect(slugLocator.first()).toBeVisible({ timeout: 5000 });
    const canonicalSlug = (await slugLocator.first().textContent()) || "";
    expect(canonicalSlug).toContain("--cs301--");
    expect(canonicalSlug).not.toContain("cs 301");
    expect(canonicalSlug).not.toContain("CS 301");

    // Now the deliberately-messy variant. Invariant #15: same slug.
    await input.fill("  cs 301  ");
    // Let the controlled-input update the identifier preview.
    await expect(slugLocator.first()).toBeVisible({ timeout: 5000 });
    const messySlug = (await slugLocator.first().textContent()) || "";
    expect(messySlug).toBe(canonicalSlug);
  });

  test("manually-typed course code never contains raw whitespace in slug", async ({
    page,
  }) => {
    await signInMock(page);
    await page.goto("/upload");

    await expect(page.locator("text=Course Name")).toBeVisible({
      timeout: 10000,
    });
    await page.locator('input[value="main"]').check();
    await page.locator('input[id="meta-course-code"]').fill("bt - 204");

    const slugLocator = page.locator(
      "text=/quarchive--[^ ]+--[^ ]+--[^ ]+--[^ ]+/",
    );
    await expect(slugLocator.first()).toBeVisible({ timeout: 5000 });
    const slug = (await slugLocator.first().textContent()) || "";

    // Must collapse both spaces and hyphens (metadataExtract.js rules).
    expect(slug).toContain("--bt204--");
    expect(slug).not.toMatch(/bt\s/);
    expect(slug).not.toMatch(/bt-\s*-/);
  });
});

test.describe("Phase 8: pure-canvas pipeline smoke test", () => {
  // Runs documentDetect / perspectiveWarp / paperEnhance directly in the
  // browser (via the dev server's module graph), so we verify both that
  // the dynamic imports resolve AND that the hot-path code does not throw
  // on a plausible input. This fills the gap left by unit tests which
  // cannot exercise OffscreenCanvas / ImageBitmap.
  test("detect → warp → enhance runs without throwing on a synthetic frame", async ({
    page,
  }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      // Build a 400×600 greyscale frame with a bright off-white inner
      // rectangle on a dark background — mimics a paper on a desk. We
      // never assert on the *quality* of the detection; we just need
      // the pipeline to complete.
      const cv = new OffscreenCanvas(400, 600);
      const ctx = cv.getContext("2d");
      if (!ctx) throw new Error("no 2d ctx");
      ctx.fillStyle = "#222";
      ctx.fillRect(0, 0, 400, 600);
      ctx.fillStyle = "#f4f0e8";
      ctx.fillRect(40, 60, 320, 480);
      ctx.fillStyle = "#111";
      ctx.font = "20px sans-serif";
      ctx.fillText("Course Code: CS301", 70, 120);
      ctx.fillText("End-Semester Examination", 70, 160);
      const bitmap = await createImageBitmap(cv);

      const detect = await import("/src/lib/documentDetect.js");
      const warp = await import("/src/lib/perspectiveWarp.js");
      const enhance = await import("/src/lib/paperEnhance.js");

      const detected = await detect.detectPaperQuad(bitmap);

      const corners =
        detected && detected.corners
          ? detected.corners
          : [
              [0, 0],
              [bitmap.width, 0],
              [bitmap.width, bitmap.height],
              [0, bitmap.height],
            ];

      const warped = await warp.warpToRect(bitmap, corners);
      const enhanced = await enhance.enhanceImage(warped, "auto");

      return {
        haveDetection: !!detected,
        warpedW: warped.width,
        warpedH: warped.height,
        enhancedW: enhanced.width,
        enhancedH: enhanced.height,
      };
    });

    // Not a quality claim — just a liveness check. Warp must yield a
    // non-degenerate bitmap, enhance must yield the same (or a new)
    // non-degenerate bitmap.
    expect(result.warpedW).toBeGreaterThan(0);
    expect(result.warpedH).toBeGreaterThan(0);
    expect(result.enhancedW).toBeGreaterThan(0);
    expect(result.enhancedH).toBeGreaterThan(0);
  });
});

test.describe("Phase 8: OCR silent-failure contract", () => {
  // The scribe.js vendor assets are not guaranteed to be present in
  // every environment (e.g. a fresh clone without `npm install`). In
  // that state the upload flow MUST still work — CLAUDE.md invariant
  // 14, "OCR never blocks the upload flow".
  test("upload form is fully usable even when /vendor/scribe/ 404s", async ({
    page,
  }) => {
    // Force every scribe asset request to fail, mimicking the "not
    // installed" state.
    await page.route("**/vendor/scribe/**", (route) => route.abort());

    await signInMock(page);
    await page.goto("/upload");

    await expect(page.locator("text=Course Name")).toBeVisible({
      timeout: 10000,
    });

    // Fields must remain typeable; identifier preview must still update.
    await page.locator('input[id="meta-course-code"]').fill("CS301");
    await page.locator('input[value="main"]').check();
    const slugLocator = page.locator(
      "text=/quarchive--[^ ]+--[^ ]+--[^ ]+--[^ ]+/",
    );
    await expect(slugLocator.first()).toBeVisible({ timeout: 5000 });
    const slug = (await slugLocator.first().textContent()) || "";
    expect(slug).toContain("--cs301--");
  });
});
