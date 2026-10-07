import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const TEAM_ID = "99999999-9999-4999-8999-999999999999";
const MEMBER_EMAIL = "member@local.stable.test";
const OUTSIDER_EMAIL = "outsider@local.stable.test";

test.describe.configure({ timeout: 60_000 });

test("a club admin publishes, reads, and acknowledges a team announcement", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  await page.goto(`/teams/${TEAM_ID}/announcements`);

  const title = `Bring water ${String(Date.now())}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message").fill("Saturday is hot.");
  await page.getByLabel("Acknowledgement required").check();
  await page.getByRole("button", { name: "Publish announcement" }).click();

  const item = page.locator("li").filter({ hasText: title });
  await expect(item.getByText("Saturday is hot.")).toBeVisible();
  await item.getByRole("button", { name: "Mark read" }).click();
  await expect(item.getByText(title)).toBeVisible();
  await item.getByRole("button", { name: "Acknowledge" }).click();
  await expect(item.getByText("1 acknowledgements")).toBeVisible();
  await expect(item.getByRole("button", { name: "Acknowledge" })).toHaveCount(
    0,
  );
  await context.close();
});

test("a club admin registers a device and saves a preference", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  await page.goto("/notifications");

  await page.getByLabel("Device token").fill("ExponentPushToken[milestone-3]");
  await page.getByRole("button", { name: "Register device" }).click();
  await expect(page.getByLabel("Notifications")).toBeVisible();

  await page.getByLabel("ANNOUNCEMENT_PUBLISHED").uncheck();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByLabel("ANNOUNCEMENT_PUBLISHED")).not.toBeChecked();
  await context.close();
});

test("a club admin requests a fill-in and commits a duty allocation", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();
  await page.goto(`/teams/${TEAM_ID}/fixtures`);

  const opponent = `Visitors ${String(Date.now())}`;
  const createForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add fixture" }),
  });
  await createForm.getByLabel("Opponent").fill(opponent);
  await createForm.getByLabel("Official start").fill("2026-10-10T18:30");
  await createForm.getByLabel("Home or away").selectOption("HOME");
  await createForm.getByRole("button", { name: "Add fixture" }).click();
  await page
    .locator("li")
    .filter({ hasText: opponent })
    .getByRole("link", { name: "Game day" })
    .click();

  await expect(page.getByText("Fill-in None")).toBeVisible();
  await page.getByRole("button", { name: "Request fill-in" }).click();
  await expect(
    page.getByRole("button", { name: "Request fill-in" }),
  ).toHaveCount(0);

  await page.getByLabel("Label").fill("Scoreboard");
  await page.getByRole("button", { name: "Add open duty" }).click();
  await page.getByRole("button", { name: "Commit allocation" }).click();
  await expect(page.getByText("Duty Scoreboard")).toBeVisible();
  await page.getByRole("button", { name: "Acknowledge duty" }).click();
  await expect(page.getByText("Duty Scoreboard")).toBeVisible();
  await page.getByRole("button", { name: "Request duty swap" }).click();
  await expect(page.getByText("Open swap Scoreboard")).toBeVisible();
  await context.close();
});

test("an outsider cannot open team announcements", async ({ browser }) => {
  const context = await browser.newContext();
  await applyLocalSession(context, OUTSIDER_EMAIL);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByLabel("Club context")).toHaveAttribute(
    "data-state",
    "no-membership",
  );

  await page.goto(`/teams/${TEAM_ID}/announcements`);
  await expect(page.getByLabel("Announcements")).toHaveCount(0);
  await expect(page.getByText("Saturday is hot.")).toHaveCount(0);
  await context.close();
});
