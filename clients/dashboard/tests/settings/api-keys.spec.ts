import { expect, test } from "@playwright/test";
import { installShellMocks } from "../helpers/shell-mocks";
import { seedAuthedSession, TEST_USER } from "../helpers/auth-seed";
import { ENGLISH_UI } from "../helpers/language";

test.use({ storageState: ENGLISH_UI });

// The API-keys backend (/api/v1/identity/api-keys) isn't built yet — the
// page renders an honest "coming soon" state so existing nav-links don't
// 404. There's no list/create/regenerate/delete to exercise. Specs assert
// the placeholder copy (the upstream "View roadmap" GitHub link was removed
// in the Volly rebrand).
test.beforeEach(async ({ page }) => {
  await seedAuthedSession(page, TEST_USER);
  await installShellMocks(page);
});

test.describe("settings/api-keys — placeholder", () => {
  test("renders the API keys section and the placeholder copy", async ({ page }) => {
    await page.goto("/settings/api-keys");

    // "API keys" also appears in the page masthead (<h1>) and the sidebar
    // nav — match the section <h3> exactly so the assertion is unambiguous.
    await expect(
      page.getByRole("heading", { name: "API keys", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /api keys aren't available yet/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/personal access tokens and service-to-service api keys/i),
    ).toBeVisible();
  });

  test("no longer links out to the upstream starter-kit roadmap", async ({ page }) => {
    await page.goto("/settings/api-keys");
    await expect(page.getByRole("heading", { name: /api keys aren't available yet/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /view roadmap/i })).toHaveCount(0);
  });
});
