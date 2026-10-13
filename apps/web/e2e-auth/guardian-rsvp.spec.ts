import { expect, test } from "@playwright/test";

import { openInvitationAcceptance } from "./invitation-handoff";
import { applyLocalSession } from "./local-session";
import { openPlayerManagement } from "./player-management";

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
  await openPlayerManagement(player);
  const selectedTeamName = await player
    .getByLabel("Team")
    .locator("option:checked")
    .textContent();
  await player.getByRole("button", { name: "Register team" }).click();
  if (selectedTeamName === null) {
    throw new Error(
      "Expected a selected team for the guardian journey player.",
    );
  }
  await expect(
    player
      .locator("header")
      .getByText(selectedTeamName.trim(), { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await openPlayerManagement(player);
  await expect(
    player.getByRole("button", { name: "Unregister team" }),
  ).toBeVisible();
  await player.getByLabel("Invitation email").fill(GUARDIAN_EMAIL);
  const invitationRequestFailures: string[] = [];
  const invitationPostEvents: string[] = [];
  const invitationPageErrors: string[] = [];
  const invitationStartedAt = new Map<object, number>();
  admin.on("request", (request) => {
    if (request.method() !== "POST") {
      return;
    }
    const path = new URL(request.url()).pathname;
    invitationStartedAt.set(request, Date.now());
    invitationPostEvents.push(`POST ${path} started`);
  });
  admin.on("requestfinished", (request) => {
    const startedAt = invitationStartedAt.get(request);
    if (startedAt === undefined) {
      return;
    }
    invitationPostEvents.push(
      `POST ${new URL(request.url()).pathname} finished in ${Date.now() - startedAt}ms`,
    );
    invitationStartedAt.delete(request);
  });
  admin.on("requestfailed", (request) => {
    if (request.method() === "POST") {
      invitationStartedAt.delete(request);
      invitationRequestFailures.push(
        `${new URL(request.url()).pathname}: ${request.failure()?.errorText ?? "failed"}`,
      );
    }
  });
  admin.on("response", (response) => {
    if (response.request().method() === "POST" && response.status() >= 400) {
      invitationRequestFailures.push(
        `${new URL(response.url()).pathname}: HTTP ${response.status()}`,
      );
    }
  });
  admin.on("pageerror", (error) => {
    invitationPageErrors.push(`${error.name}: ${error.message.slice(0, 160)}`);
  });
  const invitationNavigations: string[] = [];
  admin.on("framenavigated", (frame) => {
    if (frame === admin.mainFrame()) {
      invitationNavigations.push(new URL(frame.url()).pathname);
    }
  });
  await player.getByRole("button", { name: "Create invitation" }).click();
  const invitationLinkField = player.getByLabel("Invitation link");
  const invitationActionError = player.getByRole("alert");
  try {
    await expect(invitationLinkField).toBeVisible({ timeout: 15_000 });
  } catch (error: unknown) {
    const pageState = await Promise.race([
      admin.evaluate(() => ({
        path: window.location.pathname,
        invitationLinkVisible:
          document.querySelector('[aria-label="Invitation link"]') !== null,
        alerts: Array.from(document.querySelectorAll('[role="alert"]')).map(
          (alert) => alert.textContent?.slice(0, 160) ?? "",
        ),
      })),
      new Promise<{ diagnosticReadTimedOut: true }>((resolve) => {
        setTimeout(() => resolve({ diagnosticReadTimedOut: true }), 1_000);
      }),
    ]).catch(() => ({ diagnosticReadFailed: true }));
    throw new Error(
      `Invitation action produced no visible result: ${JSON.stringify({
        pageState,
        invitationNavigations,
        invitationPostEvents,
        requestFailures: invitationRequestFailures,
        pageErrors: invitationPageErrors,
      })}`,
      { cause: error },
    );
  }
  await expect(invitationActionError).toHaveCount(0);
  const invitationLink = await invitationLinkField.evaluate((field) =>
    field instanceof HTMLInputElement ? field.value : "",
  );
  expect(invitationLink).toMatch(/\/invitations\/accept#\S+$/u);

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

  // Guardians use the authorized Home/team journey, not the club-staff player
  // administration route. Keep this route fail-closed and direct the user back
  // to the role-specific context chooser instead of exposing roster records.
  await guardian.goto("/players");
  await expect(guardian.getByRole("alert")).toContainText(
    "Player administration is available to club staff with people-management access.",
  );
  await expect(
    guardian.getByRole("button", { name: "Add player" }),
  ).toHaveCount(0);
  await expect(
    guardian.getByRole("region", { name: "Players", exact: true }),
  ).toHaveCount(0);
  await guardian.getByRole("link", { name: "Open Home" }).last().click();
  const teamChooser = guardian.getByRole("region", {
    name: "Choose your team",
  });
  const guardianHome = guardian.getByText("Guardian home", { exact: true });
  await expect(teamChooser.or(guardianHome)).toBeVisible();
  if (await teamChooser.isVisible()) {
    await guardian.getByRole("link", { name: "U14 Boys", exact: true }).click();
  }
  await expect(guardianHome).toBeVisible();

  await guardian.goto(gameHref);
  const gameDay = guardian.getByRole("region", { name: "Game day" });
  await expect(gameDay.getByRole("heading", { name: opponent })).toBeVisible();
  const rsvp = gameDay.getByRole("button", { name: "Save RSVP" });
  await expect(rsvp).toBeVisible();
  await gameDay.getByLabel("Status").selectOption("ATTENDING");
  await rsvp.click();
  await expect(gameDay.getByText("Your RSVP", { exact: true })).toBeVisible();
  await expect(gameDay.getByText("attending", { exact: true })).toBeVisible();

  await adminContext.close();
  await guardianContext.close();
});
