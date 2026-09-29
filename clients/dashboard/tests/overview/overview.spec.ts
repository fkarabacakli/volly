import { expect, test } from "@playwright/test";
import { installShellMocks } from "../helpers/shell-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";

// Genel Bakış — the industrial overview. Its data comes from the in-app
// mock industrial API (src/api/industrial), so only the shell needs route
// mocks. Turkish is the default UI language.

test.describe("overview (/)", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
  });

  test("renders the facility map and every overview card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Genel Bakış", level: 1 })).toBeVisible();
    await expect(page.getByRole("group", { name: "Tesis haritası" })).toBeVisible();
    for (const title of [
      "Soğuk Zincir İzleme",
      "Yapay Zeka Kamera Uyarıları",
      "Sistem Durumu",
      "Stok ve Raf Doluluğu",
      "Son Aktiviteler",
    ]) {
      await expect(page.getByRole("heading", { name: title, level: 2 })).toBeVisible();
    }
    // Map markers are real buttons — the IoT gateway is always labelled.
    await expect(page.getByRole("button", { name: /Master-1 IoT Gateway/ })).toBeVisible();
  });

  test("switching facility updates the URL and the subtitle", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/İstanbul Ana Depo · Akıllı Depo/)).toBeVisible();
    await page.getByRole("button", { name: "Tesis seç", exact: true }).click();
    await page.getByRole("menuitemradio", { name: /^Ankara/ }).click();
    await expect(page).toHaveURL(/facility=ank-01/);
    await expect(page.getByText(/Ankara Soğuk Hava Deposu · Soğuk Zincir/)).toBeVisible();
  });

  test("'Tüm olayları görüntüle' opens camera analytics", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /tüm olayları görüntüle/i }).click();
    await expect(page).toHaveURL(/\/cameras$/);
    await expect(page.getByRole("heading", { name: "Kamera Analizi", level: 1 })).toBeVisible();
  });

  test("the topbar carries no duplicate page tabs or status pill", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Genel Bakış", level: 1 })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link")).toHaveCount(0);
    await expect(page.getByText("Sistem Aktif")).toHaveCount(0);
  });
});

test.describe("shell navigation", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthedSession(page, TEST_USER);
    await installShellMocks(page);
  });

  test("lists the industrial pages and hides the starter-kit demo modules", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("complementary", { name: "Ana gezinme" });
    for (const label of ["Genel Bakış", "Canlı İzleme", "Stok Yönetimi", "Kamera Analizi", "Sensörler", "Raporlar"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    for (const href of ["/chat", "/catalog/products", "/tickets", "/wallet"]) {
      await expect(page.locator(`a[href="${href}"]`)).toHaveCount(0);
    }
  });

  test("the language switch in the profile menu flips the UI to English and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Profil menüsünü aç" }).click();
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Overview", level: 1 })).toBeVisible();
  });
});
