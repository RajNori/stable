import { expect, test } from "@playwright/test";

import { openInvitationAcceptance } from "./invitation-handoff";
import { applyLocalSession } from "./local-session";

const TEAM_ID = "99999999-9999-4999-8999-999999999999";
const MEMBER_EMAIL = "member@local.stable.test";
const GUARDIAN_EMAIL = "guardian@local.stable.test";

test("guardian accepts a player invitation and records a Game Day RSVP", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const suffix = String(Date.now());
  const playerName = `Guardian Journey ${suffix}`;
  const opponent = `Synthetic RSVP ${suffix}`;

  const adminContext = await browser.newContext();
  await applyLocalSession(adminContext, MEMBER_EMAIL);
  const admin = await adminContext.newPage();
  await admin.goto("/players");

  const addPlayer = admin.getByRole("region", { name: "Add player" });
  await addPlayer.getByLabel("Given name").fill(playerName);
  await addPlayer.getByLabel("Surname").fill("Synthetic");
  await addPlayer.getByRole("button", { name: "Add player" }).click();
  const player = admin.getByRole("listitem").filter({ hasText: playerName });
  await expect(player).toContainText(`${playerName} Synthetic`);
  await player.getByRole("button", { name: "Register team" }).click();
  await player.getByLabel("Invitation email").fill(GUARDIAN_EMAIL);
  await player.getByRole("button", { name: "Create invitation" }).click();
  const invitationLink = await player
    .getByLabel("Invitation link")
    .inputValue();

  await admin.goto(`/teams/${TEAM_ID}/fixtures`);
  const fixtureForm = admin.locator("form").filter({
    has: admin.getByRole("button", { name: "Add fixture" }),
  });
  await fixtureForm.getByLabel("Opponent").fill(opponent);
  await fixtureForm.getByLabel("Official start").fill("2026-10-10T18:30");
  await fixtureForm.getByLabel("Home or away").selectOption("HOME");
  await fixtureForm.getByRole("button", { name: "Add fixture" }).click();
  const gameLink = admin
    .getByRole("listitem")
    .filter({ hasText: opponent })
    .getByRole("link", { name: "Game day" });
  await expect(gameLink).toBeVisible();
  const gameHref = await gameLink.getAttribute("href");
  expect(gameHref).toMatch(new RegExp(`^/teams/${TEAM_ID}/games/[0-9a-f-]+$`));
  if (gameHref === null) {
    throw new Error("Expected the new fixture to have a Game Day link.");
  }

  const guardianContext = await browser.newContext();
  await applyLocalSession(guardianContext, GUARDIAN_EMAIL);
  const guardian = await guardianContext.newPage();
  await openInvitationAcceptance(guardian, invitationLink);
  await guardian.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    guardian.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");
  await expect(guardian).toHaveURL(/\/invitations\/accept\?result=/);
  await guardian.waitForLoadState("networkidle");

  await guardian.goto(gameHref);
  const gameDay = guardian.getByRole("region", { name: "Game day" });
  await expect(gameDay.getByText(`Game: ${opponent}`)).toBeVisible();
  const rsvp = gameDay.getByRole("button", { name: "Save RSVP" });
  await expect(rsvp).toBeVisible();
  await gameDay.getByLabel("Status").selectOption("ATTENDING");
  await rsvp.click();
  await expect(gameDay.getByText("RSVP ATTENDING")).toBeVisible();

  await adminContext.close();
  await guardianContext.close();
});
