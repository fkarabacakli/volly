import { expect, test } from "@playwright/test";
import { mockJsonResponse, mockProblemDetails } from "../helpers/api-mocks";

// The dashboard login page: Volly brand lockup, tenant/email/password card
// (Turkish is the default UI language), a facility-map brand panel on wide
// screens, and a demoMode-gated "Step into any role" picker that signs in
// instantly.

const TOKEN_RESPONSE = {
  accessToken: "header.payload.sig",
  refreshToken: "refresh",
  accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  refreshTokenExpiresAt: new Date(Date.now() + 7_200_000).toISOString(),
};

/** Force the runtime config so demoMode is deterministic per test. */
async function setConfig(page: import("@playwright/test").Page, demoMode: boolean) {
  await page.route("**/config.json", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiBase: "", defaultTenant: "root", demoMode }),
    }),
  );
}

test.describe("login — page chrome", () => {
  test.beforeEach(async ({ page }) => {
    await setConfig(page, true);
  });

  test("renders the Volly brand lockup and the Turkish welcome card", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Volly", { exact: true })).toBeVisible();
    await expect(page.getByText("Endüstriyel AI Platformu", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /tekrar hoş geldiniz/i })).toBeVisible();
    await expect(page.getByText(/tesislerinizi izlemek için giriş yapın/i)).toBeVisible();
  });

  test("renders the tenant + email + password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Firma kodu")).toBeVisible();
    await expect(page.getByLabel("E-posta")).toBeVisible();
    await expect(page.getByLabel("Parola", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /unuttum/i })).toHaveAttribute("href", "/forgot-password");
  });

  test("password visibility toggle flips the input type", async ({ page }) => {
    await page.goto("/login");
    const pwd = page.getByLabel("Parola", { exact: true });
    await expect(pwd).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /parolayı göster/i }).click();
    await expect(pwd).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: /parolayı gizle/i }).click();
    await expect(pwd).toHaveAttribute("type", "password");
  });

  test("submit is disabled until tenant + email + password are filled", async ({ page }) => {
    await page.goto("/login");
    const submit = page.getByRole("button", { name: /^giriş yap$/i });
    // Tenant defaults to "root"; fill the rest to enable.
    await expect(submit).toBeDisabled();
    await page.getByLabel("E-posta").fill("alice@acme.com");
    await page.getByLabel("Parola", { exact: true }).fill("secret123");
    await expect(submit).toBeEnabled();
  });
});

test.describe("login — manual sign in", () => {
  test.beforeEach(async ({ page }) => {
    await setConfig(page, true);
    await mockJsonResponse(page, "**/api/v1/identity/token/issue", TOKEN_RESPONSE);
  });

  test("POSTs credentials with the tenant header", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Firma kodu").fill("acme");
    await page.getByLabel("E-posta").fill("alice@acme.com");
    await page.getByLabel("Parola", { exact: true }).fill("Password123!");

    const reqPromise = page.waitForRequest(
      (r) => r.url().includes("/api/v1/identity/token/issue") && r.method() === "POST",
    );
    await page.getByRole("button", { name: /^giriş yap$/i }).click();
    const req = await reqPromise;

    expect(req.headers().tenant).toBe("acme");
    expect(JSON.parse(req.postData() ?? "{}")).toMatchObject({
      email: "alice@acme.com",
      password: "Password123!",
    });
  });

  test("surfaces a server error without leaving the page", async ({ page }) => {
    await mockProblemDetails(page, "**/api/v1/identity/token/issue", 401, {
      title: "Unauthorized",
      detail: "Invalid credentials.",
    });
    await page.goto("/login");
    await page.getByLabel("E-posta").fill("alice@acme.com");
    await page.getByLabel("Parola", { exact: true }).fill("wrongpw");
    await page.getByRole("button", { name: /^giriş yap$/i }).click();

    await expect(page.getByRole("alert")).toContainText(/invalid credentials/i);
    await expect(page.getByRole("heading", { name: /tekrar hoş geldiniz/i })).toBeVisible();
  });
});

test.describe("login — demo account picker", () => {
  test("the demo button is hidden when demoMode is off", async ({ page }) => {
    await setConfig(page, false);
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /demo hesabıyla giriş yap/i })).toHaveCount(0);
  });

  test("opens the demo dialog with the tenant rail — root is not offered", async ({ page }) => {
    await setConfig(page, true);
    await page.goto("/login");
    await page.getByRole("button", { name: /demo hesabıyla giriş yap/i }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /rolle girin/ })).toBeVisible();
    await expect(dialog.getByText(/canlı demo/i)).toBeVisible();
    const rail = dialog.getByRole("navigation", { name: /demo firmalar/i });
    await expect(rail.getByRole("button", { name: /acme corp/i })).toBeVisible();
    await expect(rail.getByRole("button", { name: /globex/i })).toBeVisible();
    // Root accounts are SuperAdmins, which the API refuses on the dashboard.
    await expect(rail.getByRole("button", { name: /^root/i })).toHaveCount(0);
    await expect(dialog.getByText("admin@root.com")).toHaveCount(0);
  });

  test("switching tenant swaps the user list", async ({ page }) => {
    await setConfig(page, true);
    await page.goto("/login");
    await page.getByRole("button", { name: /demo hesabıyla giriş yap/i }).click();
    const dialog = page.getByRole("dialog");
    const rail = dialog.getByRole("navigation", { name: /demo firmalar/i });

    // Acme is active first.
    await expect(dialog.getByText("admin@acme.com")).toBeVisible();
    await expect(dialog.getByText(/operasyon müdürü/i)).toBeVisible();
    await rail.getByRole("button", { name: /globex/i }).click();
    await expect(dialog.getByText("admin@globex.com")).toBeVisible();
  });

  test("tapping a demo user signs in instantly with that account's tenant", async ({ page }) => {
    await setConfig(page, true);
    await mockJsonResponse(page, "**/api/v1/identity/token/issue", TOKEN_RESPONSE);
    await page.goto("/login");
    await page.getByRole("button", { name: /demo hesabıyla giriş yap/i }).click();
    const dialog = page.getByRole("dialog");

    const reqPromise = page.waitForRequest(
      (r) => r.url().includes("/api/v1/identity/token/issue") && r.method() === "POST",
    );
    await dialog.getByRole("button", { name: /admin@acme\.com/i }).click();
    const req = await reqPromise;

    expect(req.headers().tenant).toBe("acme");
    expect(JSON.parse(req.postData() ?? "{}")).toMatchObject({ email: "admin@acme.com", password: "Password123!" });
  });
});
