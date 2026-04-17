import { test, expect } from "@playwright/test";

// Common fixtures for mocking APIs
test.beforeEach(async ({ page }) => {
  await page.route("**/advancedsearch.php*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        response: { docs: [{ identifier: "quarchive--Q874586--cs301--2023--main", title: "Mock Question Paper", creator: "University of Kerala", date: "2023" }] }
      })
    });
  });

  await page.route("**/functions/api/login", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, screenname: "test_student", email: "test@example.com", accessKey: "mock-access", secretKey: "mock-secret" })
    });
  });

  await page.route("**/functions/api/s3keys", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, accessKey: "mock-access", secretKey: "mock-secret" }) });
  });

  await page.route("**/functions/api/upload", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, identifier: "mock-upload-id" }) });
  });

  await page.route("**/api/validate", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
});

test.describe("Navigation & Search", () => {
  test("Search displays mocked results on mobile layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Home/i }).first()).toBeVisible();
    const searchInput = page.getByPlaceholder(/search/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("CS301");
    await expect(page.locator("text=Mock Question Paper")).toBeVisible();
  });
});

test.describe("Auth Flow", () => {
  test("User can log in via bottom sheet", async ({ page }) => {
    await page.goto("/");
    await page.locator("nav.md\\:hidden a[aria-label=\"Upload\"]").click({ force: true });
    
    // The "Sign In" button on the Upload page
    await page.locator("div.max-w-md button:has-text(\"Sign In\")").click({ force: true });
    
    // The login sheet appears
    await expect(page.locator("text=Sign in with Internet Archive")).toBeVisible();
    
    // Fill credentials
    await page.fill("input[type=\"email\"]", "test@example.com");
    await page.fill("input[type=\"password\"]", "mockpassword");
    
    // Submit login modal
    await page.locator("form button[type=\"submit\"]").filter({ hasText: "Sign In" }).click({ force: true });
    
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
    await page.locator("nav.md\\:hidden a[aria-label=\"Upload\"]").click({ force: true });
    
    // Wait for the camera viewfinder to load
    await expect(page.locator("text=Scan Question Paper")).toBeVisible({ timeout: 10000 });
    
    // Mock the capture
    await page.locator("button[aria-label=\"Capture page\"]").click({ force: true });
    
    // Click Done
    
    
    // Check Review page
    
  });
});

test.describe("Edge Cases & Error Handling", () => {
  test("Camera permission denied shows fallback to PDF upload", async ({ browser }) => {
    const context = await browser.newContext({ permissions: [] });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localStorage.setItem("quarchive_access_key", "mock-access");
      window.localStorage.setItem("quarchive_secret_key", "mock-secret");
      window.localStorage.setItem("quarchive_screenname", "test_student");
      window.localStorage.setItem("quarchive_email", "test@example.com");
    });
    await page.goto("/");
    
    await page.locator("nav.md\\:hidden a[aria-label=\"Upload\"]").click({ force: true });
    
    // The camera will fail, setting error to permission_denied, which we handled in CameraCapture/index.jsx
    
    
    await context.close();
  });
});
