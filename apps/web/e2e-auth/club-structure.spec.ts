import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test("club admin creates a season and team and reads them back", async ({
  browser,
}) => {
  const seasonName = `Autumn ${Date.now()}`;
  const teamName = `U12 ${Date.now()}`;
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");

  await page.getByRole("link", { name: "Club structure" }).click();
  await expect(page.getByRole("list", { name: "Seasons" })).toContainText(
    "2026 Winter",
  );
  await expect(page.getByRole("list", { name: "Teams" })).toContainText(
    "U14 Boys",
  );

  await page.getByLabel("Season name").fill(seasonName);
  await page.getByLabel("Team name").fill(teamName);
  await page.getByRole("button", { name: "Create season and team" }).click();

  await expect(page.getByRole("list", { name: "Seasons" })).toContainText(
    seasonName,
  );
  await expect(page.getByRole("list", { name: "Teams" })).toContainText(
    teamName,
  );
  await expect(
    page.getByRole("region", { name: "Club structure" }).getByRole("alert"),
  ).toHaveCount(0);

  await page.getByRole("link", { name: teamName }).click();
  await expect(page.getByRole("heading", { name: teamName })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCount(0);
  await page.getByLabel("Club adult").selectOption({ label: "Local Member" });
  await page.locator("#staff-role").selectOption({ label: "Assistant coach" });
  await page.getByRole("button", { name: "Assign role" }).click();

  const assigned = page.getByRole("list", { name: "Staff assignments" });
  const coach = assigned
    .getByRole("listitem")
    .filter({ hasText: "Assistant coach" });
  await expect(coach).toContainText("Local Member");
  await expect(coach.getByRole("button", { name: "Revoke" })).toBeVisible();
  await coach.getByRole("button", { name: "Revoke" }).click();
  await expect(coach).toContainText("(revoked)");
  await expect(
    page.getByRole("region", { name: "Team staff" }).getByRole("alert"),
  ).toHaveCount(0);
  await context.close();
});

test("outsider cannot open club structure management", async ({ browser }) => {
  const context = await browser.newContext();
  await applyLocalSession(context, OUTSIDER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Club structure" })).toHaveCount(
    0,
  );

  await page.goto("/club-structure");
  await expect(page.locator('[data-state="no-membership"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create season and team" }),
  ).toHaveCount(0);
  await context.close();
});
