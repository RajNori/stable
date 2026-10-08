import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const CLUB_ADMIN_EMAIL = "member@local.stable.test";
const TEAM_ID = "99999999-9999-4999-8999-999999999999";

test("active coach records game stats, completes a review, and plans practice", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await applyLocalSession(context, CLUB_ADMIN_EMAIL);
  const page = await context.newPage();
  const suffix = String(Date.now());
  const playerName = `Pilot Player ${suffix}`;
  const opponent = `Pilot Opponent ${suffix}`;

  await page.goto(`/teams/${TEAM_ID}/staff`);
  await page.getByLabel("Club adult").selectOption({ label: "Local Member" });
  await page.locator("#staff-role").selectOption("HEAD_COACH");
  await page.getByRole("button", { name: "Assign role" }).click();
  await expect(
    page.getByRole("list", { name: "Staff assignments" }),
  ).toContainText("Head coach");

  await page.goto("/players");
  const addPlayer = page.getByRole("region", { name: "Add player" });
  await addPlayer.getByLabel("Given name").fill(playerName);
  await addPlayer.getByLabel("Surname").fill("Synthetic");
  await addPlayer.getByRole("button", { name: "Add player" }).click();
  const player = page.locator("li").filter({ hasText: playerName });
  await expect(player.getByText(`${playerName} Synthetic`)).toBeVisible();
  await player.getByRole("button", { name: "Register team" }).click();

  await page.goto(`/teams/${TEAM_ID}/fixtures`);
  const fixtureForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add fixture" }),
  });
  await fixtureForm.getByLabel("Opponent").fill(opponent);
  await fixtureForm.getByLabel("Official start").fill("2026-10-10T18:30");
  await fixtureForm.getByLabel("Home or away").selectOption("HOME");
  await fixtureForm.getByRole("button", { name: "Add fixture" }).click();
  await page
    .locator("li")
    .filter({ hasText: opponent })
    .getByRole("link", { name: "Game day" })
    .click();

  const stats = page.getByRole("region", {
    name: "Game score and player statistics",
  });
  await stats.getByLabel("Team final score").fill("81");
  await stats.getByLabel("Opponent final score").fill("74");
  await stats.getByRole("button", { name: "Save final score" }).click();
  await expect(stats.getByLabel("Team final score")).toHaveValue("81");
  await expect(stats.getByLabel("Opponent final score")).toHaveValue("74");
  await stats.getByLabel(`Points for ${playerName} Synthetic`).fill("12");
  await stats
    .getByLabel(`Approximate minutes for ${playerName} Synthetic`)
    .fill("25");
  await stats
    .getByRole("listitem")
    .filter({ hasText: `${playerName} Synthetic` })
    .getByRole("button", { name: "Save stats" })
    .click();
  await expect(
    stats.getByLabel(`Points for ${playerName} Synthetic`),
  ).toHaveValue("12");

  const review = page.getByRole("region", { name: "Post-game review" });
  await review
    .getByLabel("What worked")
    .fill("Synthetic passing drill worked.");
  await review
    .getByLabel("What needs improvement")
    .fill("Synthetic spacing needs practice.");
  await review.getByLabel("Shooting").check();
  await review.getByRole("button", { name: "Complete review" }).click();
  await expect(review.getByText(/Completed /)).toBeVisible();
  await expect(review.getByText("Shooting", { exact: true })).toBeVisible();

  await page.goto(`/teams/${TEAM_ID}/training`);
  const training = page.getByRole("region", { name: "Training" });
  await training.getByLabel("Starts", { exact: true }).fill("2026-10-12T17:00");
  await training.getByLabel("Court").fill("Synthetic court");
  await training.getByRole("button", { name: "Add practice" }).click();

  const planner = page.getByRole("region", { name: "Practice planner" });
  const reviewFocus = planner.locator('input[name="focusRef"]').first();
  await expect(reviewFocus).toBeVisible();
  await planner.getByLabel("Plan title").fill("Synthetic shooting practice");
  await reviewFocus.check();
  await planner.getByRole("button", { name: "Save practice plan" }).click();
  await expect(planner.getByLabel("Plan title")).toHaveValue(
    "Synthetic shooting practice",
  );

  await context.close();
});
