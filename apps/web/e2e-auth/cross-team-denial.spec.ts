import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { applyLocalSession } from "./local-session";

const MEMBER_EMAIL = "member@local.stable.test";
const LOCAL_PASSWORD = "local-dev-password";
const TEAM_A_ID = "99999999-9999-4999-8999-999999999999";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required for the local auth browser test.`);
  }
  if (value.startsWith("sb_secret_")) {
    throw new Error(`${name} must be the local publishable key.`);
  }
  return value;
}

async function authenticatedLocalClient() {
  const url = required("SUPABASE_URL");
  const publishableKey = required("SUPABASE_PUBLISHABLE_KEY");
  const client = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: MEMBER_EMAIL,
    password: LOCAL_PASSWORD,
  });
  if (error !== null || data.session === null) {
    throw new Error("Local RPC test sign-in failed.");
  }

  return createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    },
  });
}

test("a Team A coach keeps fixture visibility but is denied Team B coaching data", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const suffix = String(Date.now());
  const teamBName = `Cross Team ${suffix}`;
  const seasonName = `Cross Team Season ${suffix}`;
  const playerName = `Private Team B Player ${suffix}`;
  const opponent = `Team B Opponent ${suffix}`;
  const context = await browser.newContext();
  await applyLocalSession(context, MEMBER_EMAIL);
  const page = await context.newPage();

  // This account is the seeded Club Admin. It creates a second team and its
  // fixture, while its only coaching assignment remains on Team A.
  await page.goto(`/teams/${TEAM_A_ID}/staff`);
  await page.getByLabel("Club adult").selectOption({ label: "Local Member" });
  await page.locator("#staff-role").selectOption("HEAD_COACH");
  await page.getByRole("button", { name: "Assign role" }).click();
  await expect(
    page.getByRole("list", { name: "Staff assignments" }),
  ).toContainText("Head coach");

  await page.goto("/club-structure");
  await page.getByLabel("Season name").fill(seasonName);
  await page.getByLabel("Team name").fill(teamBName);
  await page.getByRole("button", { name: "Create season and team" }).click();
  const teamBLink = page.getByRole("link", { name: teamBName });
  await expect(teamBLink).toBeVisible();
  const teamBHref = await teamBLink.getAttribute("href");
  if (teamBHref === null) {
    throw new Error("Team B link did not include its route.");
  }
  const teamBId = teamBHref.split("/")[2];
  if (teamBId === undefined) {
    throw new Error("Team B route did not include its identifier.");
  }

  await page.goto("/players");
  const addPlayer = page.getByRole("region", { name: "Add player" });
  await addPlayer.getByLabel("Given name").fill(playerName);
  await addPlayer.getByLabel("Surname").fill("Synthetic");
  await addPlayer.getByRole("button", { name: "Add player" }).click();
  const player = page.getByRole("listitem").filter({ hasText: playerName });
  await expect(player).toBeVisible();
  await player.locator('select[name="teamId"]').selectOption(teamBId);
  await player.getByRole("button", { name: "Register team" }).click();
  await expect(player).toContainText(teamBName);
  const playerId = await player
    .locator('input[name="playerId"]')
    .first()
    .inputValue();

  await page.goto(`/teams/${teamBId}/fixtures`);
  const fixtureForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "Add fixture" }),
  });
  await fixtureForm.getByLabel("Opponent").fill(opponent);
  await fixtureForm.getByLabel("Official start").fill("2026-10-10T18:30");
  await fixtureForm.getByLabel("Home or away").selectOption("HOME");
  await fixtureForm.getByRole("button", { name: "Add fixture" }).click();
  const fixture = page.getByRole("listitem").filter({ hasText: opponent });
  await expect(fixture).toBeVisible();
  const gameLink = fixture.getByRole("link", { name: "Game day" });
  const gameHref = await gameLink.getAttribute("href");
  if (gameHref === null) {
    throw new Error("Team B game link did not include its route.");
  }
  const eventId = gameHref.split("/").at(-1);
  if (eventId === undefined) {
    throw new Error("Team B game route did not include its identifier.");
  }

  // Seed sensitive M4 values as a coach on Team B. After revoking that role,
  // the user stays a coach only for Team A, giving the denial checks real
  // Team B rows and child-specific note text to protect.
  await page.goto(`/teams/${teamBId}/staff`);
  await page.getByLabel("Club adult").selectOption({ label: "Local Member" });
  await page.locator("#staff-role").selectOption("HEAD_COACH");
  await page.getByRole("button", { name: "Assign role" }).click();
  await page.goto(gameHref);
  const stats = page.getByRole("region", {
    name: "Game score and player statistics",
  });
  await stats.getByLabel("Team final score").fill("81");
  await stats.getByLabel("Opponent final score").fill("74");
  await stats.getByRole("button", { name: "Save final score" }).click();
  await stats.getByLabel(`Points for ${playerName} Synthetic`).fill("12");
  await stats
    .getByLabel(`Approximate minutes for ${playerName} Synthetic`)
    .fill("25");
  await stats
    .getByRole("listitem")
    .filter({ hasText: playerName })
    .getByRole("button", { name: "Save stats" })
    .click();
  const review = page.getByRole("region", { name: "Post-game review" });
  const privateReview = `Team B review ${suffix}`;
  const privateNote = `Team B private note ${suffix}`;
  await review.getByLabel("What worked").fill(privateReview);
  await review.getByLabel("What needs improvement").fill("Private detail.");
  await review.getByRole("button", { name: "Save draft" }).click();
  await review
    .getByLabel(`${playerName} Synthetic private coaching note`)
    .fill(privateNote);
  await review.getByRole("button", { name: "Save private note" }).click();

  await page.goto(`/teams/${teamBId}/staff`);
  const coachAssignment = page
    .getByRole("list", { name: "Staff assignments" })
    .getByRole("listitem")
    .filter({ hasText: "Head coach" });
  await coachAssignment.getByRole("button", { name: "Revoke" }).click();
  await expect(coachAssignment).toContainText("(revoked)");
  await page.goto(`/teams/${TEAM_A_ID}/staff`);
  const teamACoach = page
    .getByRole("list", { name: "Staff assignments" })
    .getByRole("listitem")
    .filter({ hasText: "Head coach" });
  await expect(teamACoach).toContainText("Local Member");
  await expect(teamACoach).not.toContainText("(revoked)");

  // The existing non-M4 fixture projection remains visible to this dual-role
  // Club Admin, while coaching-only panels and data remain hidden on Team B.
  await page.goto(gameHref);
  await expect(page.locator("body")).toContainText(opponent);
  await expect(
    page.getByRole("region", { name: "Game score and player statistics" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Post-game review" }),
  ).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(privateReview);
  await expect(page.locator("body")).not.toContainText(privateNote);

  // Exercise the authoritative authenticated RPC boundary as well as the UI
  // projection. Team B has a real game event; authorization must fail before
  // any player-level validation or write can occur.
  const supabase = await authenticatedLocalClient();
  const attempts = [
    supabase.rpc("read_game_coaching_stats", { p_event_id: eventId }),
    supabase.rpc("read_post_game_review", { p_event_id: eventId }),
    supabase.rpc("read_private_player_game_note", {
      p_event_id: eventId,
      p_player_id: playerId,
    }),
    supabase.rpc("list_private_player_game_notes", { p_event_id: eventId }),
    supabase.rpc("save_game_player_stat", {
      p_event_id: eventId,
      p_player_id: playerId,
      p_points: 1,
      p_rebounds: 0,
      p_assists: 0,
      p_steals: 0,
      p_fouls: 0,
      p_approximate_minutes: 0,
    }),
    supabase.rpc("save_post_game_review", {
      p_event_id: eventId,
      p_what_worked: "Unauthorized Team B write attempt.",
      p_needs_improvement: "Must remain unchanged.",
      p_focus_codes: [],
      p_complete: false,
    }),
    supabase.rpc("save_private_player_game_note", {
      p_event_id: eventId,
      p_player_id: playerId,
      p_note: "Unauthorized Team B note attempt.",
    }),
  ];
  const results = await Promise.all(attempts);
  for (const [index, result] of results.entries()) {
    expect(result.error, `M4 RPC attempt ${index + 1} must be denied`).not.toBe(
      null,
    );
    expect(result.error?.code).toBe("42501");
  }

  await context.close();
});
