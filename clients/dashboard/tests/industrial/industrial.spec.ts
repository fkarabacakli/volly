import { expect, test } from "@playwright/test";
import { installShellMocks } from "../helpers/shell-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";

// Industrial pages read the deterministic in-app mock API
// (src/api/industrial/mock), so specs only need the shell mocks.

test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
});

test.describe("live monitoring (/monitoring)", () => {
  test("selecting a device from the list opens its detail and deep-links it", async ({ page }) => {
    await page.goto("/monitoring");
    await expect(page.getByRole("heading", { name: "Canlı İzleme", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Soğuk Oda D1, Çevrimiçi" }).click();
    await expect(page).toHaveURL(/device=ist-01-th-07/);
    await expect(page.getByRole("heading", { name: "Cihaz ayrıntısı" })).toBeVisible();
    await expect(page.getByText("Son ölçümler")).toBeVisible();

    await page.getByRole("button", { name: "Seçimi kaldır" }).click();
    await expect(page).not.toHaveURL(/device=/);
  });

  test("layer chips hide a device kind from the map", async ({ page }) => {
    await page.goto("/monitoring");
    const map = page.getByRole("group", { name: "Tesis haritası" });
    await expect(map.getByRole("button", { name: /^Kamera 01,/ })).toBeVisible();

    await page.getByRole("button", { name: /Kameralar/ }).click();
    await expect(map.getByRole("button", { name: /^Kamera 01,/ })).toHaveCount(0);
  });
});

test.describe("inventory (/inventory)", () => {
  test("zone chip + search narrow the rack table via the URL", async ({ page }) => {
    await page.goto("/inventory");
    await expect(page.getByRole("heading", { name: "Stok Yönetimi", level: 1 })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "A1-01" })).toBeVisible();

    await page.getByRole("button", { name: "B Bölgesi", exact: true }).click();
    await expect(page).toHaveURL(/zone=B/);
    await expect(page.getByRole("rowheader", { name: "A1-01" })).toHaveCount(0);
    await expect(page.getByRole("rowheader", { name: "B1-01" })).toBeVisible();

    await page.getByRole("searchbox", { name: "Raf kodu ara" }).fill("B2-03");
    await expect(page.getByRole("rowheader")).toHaveCount(1);
    await expect(page.getByText("1 raf")).toBeVisible();
  });
});

test.describe("camera analytics (/cameras)", () => {
  test("filters alerts by type and opens the detail dialog", async ({ page }) => {
    await page.goto("/cameras");
    await expect(page.getByRole("heading", { name: "Kamera Analizi", level: 1 })).toBeVisible();
    await expect(page.getByText("Çevrimiçi kamera")).toBeVisible();

    await page.getByRole("button", { name: "Olay", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Yetkisiz Giriş" }).click();
    const list = page.locator("ul").filter({ has: page.getByRole("button", { name: /Yetkisiz Giriş/ }) });
    await expect(list.getByRole("button", { name: /Ambalaj Hasarı/ })).toHaveCount(0);

    await list.getByRole("button", { name: /Yetkisiz Giriş/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Yetkisiz Giriş" })).toBeVisible();
    await expect(dialog.getByText("Tespit zamanı")).toBeVisible();
  });
});

test.describe("sensors (/sensors)", () => {
  test("switches to the table view and metric via URL state", async ({ page }) => {
    await page.goto("/sensors");
    await expect(page.getByRole("heading", { name: "Sensörler", level: 1 })).toBeVisible();
    await expect(page.getByRole("table", { name: "Genel Ölçümler" })).toBeVisible();

    await page.getByRole("radio", { name: "Tablo" }).click();
    await expect(page).toHaveURL(/view=table/);
    await expect(page.getByRole("table", { name: "Tüm Ölçümler" })).toBeVisible();

    await page.getByRole("button", { name: "Ölçüm", exact: true }).click();
    await page.getByRole("menuitemradio", { name: /^Nem/ }).click();
    await expect(page).toHaveURL(/metric=humidity/);
    await expect(page.getByRole("columnheader", { name: /Nem \(%\)/ })).toBeVisible();
  });

  test("adding a second device compares both in the overall table", async ({ page }) => {
    await page.goto("/sensors");
    await page.getByRole("button", { name: /Soğuk Oda D1/ }).click();
    await expect(page).toHaveURL(/sensors=ist-01-th-01%2Cist-01-th-07|sensors=ist-01-th-01,ist-01-th-07/);
    const overall = page.getByRole("table", { name: "Genel Ölçümler" });
    await expect(overall.getByRole("columnheader", { name: "Ortam A1" })).toBeVisible();
    await expect(overall.getByRole("columnheader", { name: "Soğuk Oda D1" })).toBeVisible();
  });
});

test.describe("reports (/reports)", () => {
  test("picking sensors renders the comparison and summary table", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByText("Karşılaştırma için sensör seçin.")).toBeVisible();

    // The checkbox is visually hidden inside a chip-styled <label>; click the chip.
    await page.locator("label", { hasText: "Ortam A1" }).click();
    await page.locator("label", { hasText: "Soğuk Oda D1" }).click();
    await expect(page.getByRole("checkbox", { name: "Soğuk Oda D1" })).toBeChecked();
    await expect(page.getByText("2 seçili")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Karşılaştırma · Sıcaklık/ })).toBeVisible();
    await expect(page.getByRole("rowheader", { name: "Soğuk Oda D1" })).toBeVisible();
  });
});
