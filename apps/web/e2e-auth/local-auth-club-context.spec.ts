import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test("member session resolves the seeded club context and overview", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");

  await expect(page).not.toHaveURL(/fixture=/);
  await expect(
    page.locator("header").getByText("Mentone Mustangs", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "People", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Club overview" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Club overview" })
      .getByRole("heading", { name: "Needs attention" }),
  ).toBeVisible();
  await expect(page.getByLabel("Club context")).toHaveAttribute(
    "data-state",
    "member",
  );
  await context.close();
});

test("outsider session has no club and no club.read", async ({ browser }) => {
  const context = await browser.newContext();
  await applyLocalSession(context, OUTSIDER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");

  await expect(page).not.toHaveURL(/fixture=/);
  await expect(page.getByLabel("Club context")).toHaveAttribute(
    "data-state",
    "no-membership",
  );
  await expect(page.getByText("Signed in as Signed in")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Mentone Mustangs" }),
  ).toHaveCount(0);
  await expect(page.getByText("club.read")).toHaveCount(0);
  await context.close();
});
