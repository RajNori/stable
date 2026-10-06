import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test("club admin adds a player and sees the safe display name", async ({
  browser,
}) => {
  const suffix = Date.now().toString();
  const firstName = `Synth${suffix}`;
  const lastName = "Child";
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");

  await page.getByRole("link", { name: "Players" }).click();
  const add = page.getByRole("region", { name: "Add player" });
  await add.getByLabel("Given name").fill(firstName);
  await add.getByLabel("Surname").fill(lastName);
  await add.getByRole("button", { name: "Add player" }).click();

  const item = page.getByRole("listitem").filter({ hasText: firstName });
  await expect(item).toContainText(`${firstName} ${lastName}`);
  await expect(item).toContainText(`Shown to guardians as ${firstName} C.`);
  await expect(
    page
      .getByRole("region", { name: "Players", exact: true })
      .getByRole("alert"),
  ).toHaveCount(0);

  await item.getByLabel("Club adult").selectOption({ label: "Local Member" });
  await item.getByRole("button", { name: "Link guardian" }).click();
  await expect(item).toContainText("Local Member");
  await expect(
    item.getByRole("button", { name: "Unregister team" }),
  ).toHaveCount(0);
  await item.getByLabel("Team").selectOption({ label: "U14 Boys" });
  await item.getByRole("button", { name: "Register team" }).click();
  await expect(
    item.getByRole("button", { name: "Unregister team" }),
  ).toBeVisible();
  await item.getByRole("button", { name: "Unregister team" }).click();
  await expect(
    item.getByRole("button", { name: "Unregister team" }),
  ).toHaveCount(0);
  await expect(item).toContainText("No team");
  await context.close();
});

test("outsider cannot open player management", async ({ browser }) => {
  const context = await browser.newContext();
  await applyLocalSession(context, OUTSIDER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Players" })).toHaveCount(0);
  await page.goto("/players");
  await expect(page.locator('[data-state="no-membership"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Add player" })).toHaveCount(0);
  await context.close();
});
