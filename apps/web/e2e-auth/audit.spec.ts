import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const CLUB_ADMIN_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test("Club Admin can read the safe operational audit projection", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, CLUB_ADMIN_EMAIL);
  const page = await context.newPage();

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Operational audit" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Operational audit" }).click();
  await expect(
    page.getByRole("heading", { name: "Operational audit" }),
  ).toBeVisible();
  await expect(
    page.getByRole("form", { name: "Filter audit events" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Coaching history and player details are not shown/),
  ).toBeVisible();
  await context.close();
});

test("authenticated user without membership cannot read audit history", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, OUTSIDER_EMAIL);
  const page = await context.newPage();

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Operational audit" }),
  ).toHaveCount(0);
  await page.goto("/audit");
  await expect(page.locator('[data-state="no-membership"]')).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await context.close();
});
