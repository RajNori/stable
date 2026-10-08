import { expect, test } from "@playwright/test";

import { openInvitationAcceptance } from "./invitation-handoff";
import { applyLocalSession } from "./local-session";

const TEAM_ID = "99999999-9999-4999-8999-999999999999";
const MEMBER_EMAIL = "member@local.stable.test";
const MANAGER_EMAIL = "outsider@local.stable.test";
const GUARDIAN_EMAIL = "guardian@local.stable.test";

test("a non-admin team manager maintains fixtures and team operations", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const suffix = String(Date.now());
  const opponent = `Manager Opponent ${suffix}`;
  const updatedOpponent = `Updated Manager Opponent ${suffix}`;
  const playerName = `Manager Journey ${suffix}`;
  const announcementTitle = `Manager notice ${suffix}`;
  const dutyLabel = `Manager scoreboard ${suffix}`;

  // A Club Admin invites the pre-provisioned outsider as a team-scoped manager.
  const adminContext = await browser.newContext();
  await applyLocalSession(adminContext, MEMBER_EMAIL);
  const admin = await adminContext.newPage();
  await admin.goto(`/teams/${TEAM_ID}/staff`);
  await admin.getByLabel("Invitation email").fill(MANAGER_EMAIL);
  await admin.getByLabel("Invitation role").selectOption("TEAM_MANAGER");
  await admin.getByRole("button", { name: "Create invitation" }).click();
  const managerInvitation = await admin
    .getByLabel("Invitation link")
    .inputValue();

  const managerContext = await browser.newContext();
  await applyLocalSession(managerContext, MANAGER_EMAIL);
  const manager = await managerContext.newPage();
  await openInvitationAcceptance(manager, managerInvitation);
  await manager.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    manager.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");
  await expect(manager).toHaveURL(/\/invitations\/accept\?result=/);
  await manager.waitForLoadState("networkidle");

  // A manager may create and update manual fixture metadata, but receives no
  // Milestone 4 coaching projection or score/stat controls.
  await manager.goto(`/teams/${TEAM_ID}/fixtures`);
  const createFixture = manager.locator("form").filter({
    has: manager.getByRole("button", { name: "Add fixture" }),
  });
  await createFixture.getByLabel("Opponent").fill(opponent);
  await createFixture.getByLabel("Official start").fill("2026-10-10T18:30");
  await createFixture.getByLabel("Home or away").selectOption("HOME");
  await createFixture.getByRole("button", { name: "Add fixture" }).click();

  let fixture = manager.getByRole("listitem").filter({ hasText: opponent });
  await expect(fixture).toBeVisible();
  await fixture.getByLabel(`Opponent for ${opponent}`).fill(updatedOpponent);
  await fixture.getByLabel(`Round for ${opponent}`).fill("M5 pilot round");
  await fixture.getByRole("button", { name: "Save official fixture" }).click();
  fixture = manager.getByRole("listitem").filter({ hasText: updatedOpponent });
  await expect(fixture).toContainText("M5 pilot round");

  await fixture
    .getByLabel(`Team note for ${updatedOpponent}`)
    .fill("Synthetic manager fixture note");
  await fixture.getByRole("button", { name: "Save team overlay" }).click();
  await expect(
    fixture.getByLabel(`Team note for ${updatedOpponent}`),
  ).toHaveValue("Synthetic manager fixture note");
  const gameLink = fixture.getByRole("link", { name: "Game day" });
  const gameHref = await gameLink.getAttribute("href");
  expect(gameHref).toMatch(new RegExp(`^/teams/${TEAM_ID}/games/[0-9a-f-]+$`));
  if (gameHref === null) {
    throw new Error("Expected the new fixture to have a Game Day link.");
  }

  await manager.goto(gameHref);
  await expect(
    manager.getByRole("region", {
      name: "Game score and player statistics",
    }),
  ).toHaveCount(0);

  // Publish the synthetic player and obtain a guardian RSVP so the allocation
  // has one eligible, real recipient when the manager assigns the duty.
  await admin.goto("/players");
  const addPlayer = admin.getByRole("region", { name: "Add player" });
  await addPlayer.getByLabel("Given name").fill(playerName);
  await addPlayer.getByLabel("Surname").fill("Synthetic");
  await addPlayer.getByRole("button", { name: "Add player" }).click();
  const player = admin.getByRole("listitem").filter({ hasText: playerName });
  await player.getByRole("button", { name: "Register team" }).click();
  await player.getByLabel("Invitation email").fill(GUARDIAN_EMAIL);
  await player.getByRole("button", { name: "Create invitation" }).click();
  const guardianInvitation = await player
    .getByLabel("Invitation link")
    .inputValue();

  const guardianContext = await browser.newContext();
  await applyLocalSession(guardianContext, GUARDIAN_EMAIL);
  const guardian = await guardianContext.newPage();
  await openInvitationAcceptance(guardian, guardianInvitation);
  await guardian.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    guardian.getByRole("region", { name: "Accept invitation" }),
  ).toContainText("Invitation accepted.");
  await expect(guardian).toHaveURL(/\/invitations\/accept\?result=/);
  await guardian.waitForLoadState("networkidle");
  await guardian.goto(gameHref);
  const gameDay = guardian.getByRole("region", { name: "Game day" });
  await gameDay.getByLabel("Status").selectOption("ATTENDING");
  await gameDay.getByRole("button", { name: "Save RSVP" }).click();
  await expect(gameDay.getByText("RSVP ATTENDING")).toBeVisible();

  // Confirm the staff-facing announcement was persisted through the UI.
  await manager.goto(`/teams/${TEAM_ID}/announcements`);
  const message = `Synthetic manager message ${suffix}`;
  await manager.getByLabel("Title").fill(announcementTitle);
  await manager.getByLabel("Message").fill(message);
  await manager.getByRole("button", { name: "Publish announcement" }).click();
  const announcement = manager
    .getByRole("listitem")
    .filter({ hasText: announcementTitle });
  await expect(announcement).toContainText(message);

  // A manager can open a fill-in request and assign a duty. The guardian
  // projection verifies the allocation reached the sole RSVP candidate.
  await manager.goto(gameHref);
  await manager.getByRole("button", { name: "Request fill-in" }).click();
  await expect(
    manager.getByRole("button", { name: "Request fill-in" }),
  ).toHaveCount(0);
  await manager.getByLabel("Label").fill(dutyLabel);
  await manager.getByRole("button", { name: "Add open duty" }).click();
  await expect(
    manager.getByRole("button", { name: "Commit allocation" }),
  ).toBeVisible();
  await manager.getByRole("button", { name: "Commit allocation" }).click();
  await expect(
    manager.getByRole("button", { name: "Commit allocation" }),
  ).toHaveCount(0);

  await guardian.reload();
  await expect(gameDay.getByText(`Duty ${dutyLabel}`)).toBeVisible();

  await adminContext.close();
  await managerContext.close();
  await guardianContext.close();
});
