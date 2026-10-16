import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { readHostedEnv, STAGING } from "./hosted-env";
import { hostedRole } from "./hosted-session";

// Pilot acceptance against the hosted Preview + approved staging Supabase.
// Every write uses a run-unique "[E2E]" label, future-dated events are well
// clear of the seeded pilot week, and each test archives or unregisters what
// it created so repeat runs leave the demo data usable.
const env = readHostedEnv();
const RUN = `[E2E] ${new Date().toISOString().slice(0, 16)}`;

function localDateTime(daysFromNow: number, hour: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  const day = date.toISOString().slice(0, 10);
  return `${day}T${String(hour).padStart(2, "0")}:00`;
}

async function expectSecondSwapAcceptanceToConflict(
  email: string,
  requestId: string,
): Promise<void> {
  const admin = createClient(env.supabaseUrl, env.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const tokenHash = link.data.properties?.hashed_token;
  if (link.error !== null || tokenHash === undefined) {
    throw new Error("Staging Auth did not return the swap acceptance proof.");
  }
  const recipient = createClient(env.supabaseUrl, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const session = await recipient.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  expect(session.error).toBeNull();
  const secondAcceptance = await recipient.rpc("accept_duty_swap", {
    p_request_id: requestId,
  });
  expect(secondAcceptance.error?.message).toBe("CONFLICT");
}

test.describe.configure({ mode: "serial" });

test("Admin configures a team: player, registration, guardian and staff invitations", async ({
  browser,
}) => {
  const { context, page } = await hostedRole(browser, env, STAGING.adminCoach);
  const given = `${RUN} Player`;
  try {
    await page.goto("/players");
    const addPlayer = page.getByRole("region", { name: "Add player" });
    await addPlayer.getByLabel("Given name").fill(given);
    await addPlayer.getByLabel("Surname").fill("Synthetic");
    await addPlayer.getByRole("button", { name: "Add player" }).click();
    const player = page.locator("li").filter({ hasText: given });
    await expect(player).toBeVisible();

    await player.getByLabel("Team").selectOption(STAGING.primaryTeam);
    await player.getByRole("button", { name: "Register team" }).click();
    await expect(
      page
        .locator("li")
        .filter({ hasText: given })
        .getByRole("button", { name: "Unregister team" }),
    ).toBeVisible();

    await page
      .locator("li")
      .filter({ hasText: given })
      .getByRole("button", { name: "Create invitation" })
      .click();
    await expect(page.getByLabel("Invitation link")).not.toHaveValue("");

    await page.goto(`/teams/${STAGING.primaryTeam}/staff`);
    await page
      .getByLabel("Invitation email")
      .fill(`e2e-staff-${Date.now()}@stable.invalid`);
    await page.getByLabel("Invitation role").selectOption("TEAM_MANAGER");
    await page.getByRole("button", { name: "Create invitation" }).click();
    await expect(page.getByLabel("Invitation link")).not.toHaveValue("");
  } finally {
    // Leave no synthetic player on the pilot roster.
    await page.goto("/players");
    const created = page.locator("li").filter({ hasText: given });
    if ((await created.count()) > 0) {
      const unregister = created.getByRole("button", {
        name: "Unregister team",
      });
      if ((await unregister.count()) > 0) await unregister.click();
      const deactivate = page
        .locator("li")
        .filter({ hasText: given })
        .getByRole("button", { name: "Deactivate" });
      if ((await deactivate.count()) > 0) await deactivate.click();
    }
    await context.close();
  }
});

test("Manager and Guardian complete the weekly loop: fixture, RSVP, availability, duty, announcement", async ({
  browser,
}) => {
  type HostedRoleSession = Awaited<ReturnType<typeof hostedRole>>;
  const manager = await hostedRole(browser, env, STAGING.manager);
  const guardian = await hostedRole(browser, env, STAGING.guardianTwo);
  const adultSessions = new Map<string, HostedRoleSession>([
    [STAGING.manager, manager],
    [STAGING.guardianTwo, guardian],
  ]);
  const additionalSessions: HostedRoleSession[] = [];
  const adult = async (email: string) => {
    const existing = adultSessions.get(email);
    if (existing !== undefined) return existing;
    const created = await hostedRole(browser, env, email);
    adultSessions.set(email, created);
    additionalSessions.push(created);
    return created;
  };
  const eligibleAdults = [
    STAGING.adminCoach,
    STAGING.assistantCoach,
    STAGING.manager,
    STAGING.guardianOne,
    STAGING.guardianTwo,
    STAGING.guardianThree,
    STAGING.adminOnly,
  ];
  const opponent = `${RUN} Opponent`;
  const title = `${RUN} Notice`;
  const dutyLabel = `${RUN} Scoreboard`;
  try {
    // Manager creates a fixture well beyond the seeded pilot week.
    await manager.page.goto(`/teams/${STAGING.primaryTeam}/fixtures`);
    const form = manager.page.locator("form").filter({
      has: manager.page.getByRole("button", { name: "Add fixture" }),
    });
    await form.getByLabel("Opponent").fill(opponent);
    await form.getByLabel("Official start").fill(localDateTime(60, 18));
    await form.getByLabel("Home or away").selectOption("HOME");
    await form.getByRole("button", { name: "Add fixture" }).click();
    const gameLink = manager.page
      .getByRole("listitem")
      .filter({ hasText: opponent })
      .getByRole("link", { name: "Game day" });
    const gameHref = await gameLink.getAttribute("href");
    expect(gameHref).toMatch(
      new RegExp(`^/teams/${STAGING.primaryTeam}/games/[0-9a-f-]+$`),
    );
    if (gameHref === null) throw new Error("Game Day link missing.");

    // Guardian RSVPs for their own child only.
    await guardian.page.goto(gameHref);
    const gameDay = guardian.page.getByRole("region", { name: "Game day" });
    await expect(gameDay).toContainText(opponent);
    const rsvpForms = gameDay.locator("form").filter({
      has: guardian.page.getByRole("button", { name: "Save RSVP" }),
    });
    await expect(rsvpForms).toHaveCount(1);
    await rsvpForms.getByLabel("Status").selectOption("ATTENDING");
    await rsvpForms.getByRole("button", { name: "Save RSVP" }).click();
    await expect(
      gameDay.getByText("RSVP ATTENDING", { exact: true }),
    ).toBeVisible();

    // Manager sees who is available.
    await manager.page.goto(gameHref);
    await expect(
      manager.page
        .getByRole("region", { name: "Game day" })
        .getByText(
          /^Attending [1-9]\d*, unavailable \d+, unsure \d+, unanswered \d+$/,
        ),
    ).toBeVisible();

    // Manager creates and allocates a duty.
    await manager.page.getByLabel("Label").fill(dutyLabel);
    await manager.page.getByRole("button", { name: "Add open duty" }).click();
    await manager.page
      .getByRole("button", { name: "Commit allocation" })
      .click();
    await expect(
      manager.page.getByRole("button", { name: "Commit allocation" }),
    ).toHaveCount(0);

    // A guardian responds for one of their own players; the manager confirms
    // that response so the run does not leave an open fill-in request behind.
    await manager.page.getByRole("button", { name: "Request fill-in" }).click();
    await guardian.page.goto(gameHref);
    const guardianResponse = guardian.page
      .getByRole("region", { name: "Game day" })
      .locator("form")
      .filter({
        has: guardian.page.getByRole("button", {
          name: "Respond to fill-in",
        }),
      })
      .first();
    await expect(guardianResponse).toBeVisible();
    await guardianResponse
      .getByRole("button", { name: "Respond to fill-in" })
      .click();
    await manager.page.goto(gameHref);
    const confirmation = manager.page
      .getByRole("region", { name: "Game day" })
      .locator("form")
      .filter({
        has: manager.page.getByRole("button", { name: "Confirm fill-in" }),
      })
      .first();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Confirm fill-in" }).click();
    await expect(
      manager.page.getByRole("region", { name: "Game day" }),
    ).not.toContainText("Fill-in None");

    // Find the adult selected by the balanced allocator, then have a different
    // eligible adult accept. The second acceptance must fail as a conflict.
    let requesterEmail: string | undefined;
    for (const email of eligibleAdults) {
      const session = await adult(email);
      await session.page.goto(gameHref);
      if (
        (await session.page
          .getByText(`Duty ${dutyLabel}`, { exact: true })
          .count()) > 0 &&
        (await session.page
          .getByRole("button", { name: "Request duty swap" })
          .count()) > 0
      ) {
        requesterEmail = email;
        await session.page
          .getByRole("button", { name: "Request duty swap" })
          .click();
        await expect(session.page.getByRole("status")).toHaveText(
          "Swap offered. Eligible adults on this team can now take this duty.",
        );
        break;
      }
    }
    if (requesterEmail === undefined) {
      throw new Error("No eligible synthetic adult received the E2E duty.");
    }

    let accepterEmail: string | undefined;
    let swapRequestId: string | undefined;
    for (const email of eligibleAdults) {
      if (email === requesterEmail) continue;
      const session = await adult(email);
      await session.page.goto(gameHref);
      const acceptForm = session.page
        .getByRole("region", { name: "Game day" })
        .locator("form")
        .filter({
          has: session.page.getByRole("button", { name: "Accept swap" }),
        })
        .first();
      if ((await acceptForm.count()) === 0) continue;
      swapRequestId = await acceptForm
        .locator('input[name="requestId"]')
        .inputValue();
      await acceptForm.getByRole("button", { name: "Accept swap" }).click();
      await expect(session.page.getByRole("status")).toHaveText(
        "You have taken this duty.",
      );
      await expect(
        session.page.getByRole("button", { name: "Accept swap" }),
      ).toHaveCount(0);
      accepterEmail = email;
      break;
    }
    if (accepterEmail === undefined || swapRequestId === undefined) {
      throw new Error(
        "A second eligible adult could not accept the duty swap.",
      );
    }
    await expectSecondSwapAcceptanceToConflict(accepterEmail, swapRequestId);

    // Manager publishes an acknowledgement-required update.
    await manager.page.goto(`/teams/${STAGING.primaryTeam}/announcements`);
    await manager.page.getByLabel("Title").fill(title);
    await manager.page.getByLabel("Message").fill(`${RUN} synthetic message`);
    await manager.page.getByLabel("Acknowledgement required").check();
    await manager.page
      .getByRole("button", { name: "Publish announcement" })
      .click();
    await expect(
      manager.page.getByRole("listitem").filter({ hasText: title }),
    ).toContainText("0 acknowledgements");

    // Guardian acknowledges; manager sees it.
    await guardian.page.goto(`/teams/${STAGING.primaryTeam}/announcements`);
    const notice = guardian.page
      .getByRole("listitem")
      .filter({ hasText: title });
    await notice.getByRole("button", { name: "Acknowledge" }).click();
    await expect(
      guardian.page
        .getByRole("listitem")
        .filter({ hasText: title })
        .getByRole("button", { name: "Acknowledge" }),
    ).toHaveCount(0);
    await manager.page.reload();
    await expect(
      manager.page.getByRole("listitem").filter({ hasText: title }),
    ).toContainText("1 acknowledgements");
  } finally {
    // Hide the run-unique fixture from the pilot schedule after the journey.
    await manager.page.goto(`/teams/${STAGING.primaryTeam}/fixtures`);
    const runFixture = manager.page
      .getByRole("listitem")
      .filter({ hasText: opponent });
    if ((await runFixture.count()) > 0) {
      await runFixture
        .getByLabel(`Status for ${opponent}`)
        .selectOption("CANCELLED");
      await runFixture
        .getByRole("button", { name: "Save official fixture" })
        .click();
    }
    // Archive the synthetic update so it never becomes the pilot's
    // "latest team update".
    await manager.page.goto(`/teams/${STAGING.primaryTeam}/announcements`);
    const item = manager.page.getByRole("listitem").filter({ hasText: title });
    const archive = item.getByRole("button", { name: "Archive" });
    if ((await archive.count()) > 0) await archive.click();
    await manager.context.close();
    await guardian.context.close();
    await Promise.all(
      additionalSessions.map((session) => session.context.close()),
    );
  }
});

test("Coach records stats, completes a review and plans the next practice", async ({
  browser,
}) => {
  const coach = await hostedRole(browser, env, STAGING.adminCoach);
  const opponent = `${RUN} Coach Opponent`;
  try {
    await coach.page.goto(`/teams/${STAGING.primaryTeam}/fixtures`);
    const form = coach.page.locator("form").filter({
      has: coach.page.getByRole("button", { name: "Add fixture" }),
    });
    await form.getByLabel("Opponent").fill(opponent);
    await form.getByLabel("Official start").fill(localDateTime(-1, 9));
    await form.getByLabel("Home or away").selectOption("AWAY");
    await form.getByRole("button", { name: "Add fixture" }).click();
    await coach.page
      .getByRole("listitem")
      .filter({ hasText: opponent })
      .getByRole("link", { name: "Game day" })
      .click();

    const stats = coach.page.getByRole("region", {
      name: "Game score and player statistics",
    });
    await stats.getByLabel("Team final score").fill("61");
    await stats.getByLabel("Opponent final score").fill("58");
    await stats.getByRole("button", { name: "Save final score" }).click();
    await expect(stats.getByLabel("Team final score")).toHaveValue("61");

    const firstPlayer = stats
      .getByRole("listitem")
      .filter({ has: coach.page.getByLabel(/^Points for /) })
      .first();
    await firstPlayer.getByLabel(/^Points for /).fill("7");
    await firstPlayer.getByRole("button", { name: "Save stats" }).click();
    await expect(
      stats
        .getByRole("listitem")
        .filter({ has: coach.page.getByLabel(/^Points for /) })
        .first()
        .getByLabel(/^Points for /),
    ).toHaveValue("7");

    const review = coach.page.getByRole("region", { name: "Post-game review" });
    await review.getByLabel("What worked").fill(`${RUN} passing worked.`);
    await review
      .getByLabel("What needs improvement")
      .fill(`${RUN} spacing needs work.`);
    await review.getByLabel("Shooting").check();
    await review.getByRole("button", { name: "Complete review" }).click();
    await expect(review.getByText(/Completed /)).toBeVisible();

    await coach.page.goto(`/teams/${STAGING.primaryTeam}/training`);
    const training = coach.page.getByRole("region", { name: "Training" });
    await training
      .getByLabel("Starts", { exact: true })
      .fill(localDateTime(61, 17));
    await training.getByLabel("Court").fill(`${RUN} court`);
    await training.getByRole("button", { name: "Add practice" }).click();
    const planner = coach.page.getByRole("region", {
      name: "Practice planner",
    });
    const focus = planner.locator('input[name="focusRef"]').first();
    await expect(focus).toBeVisible();
    await planner.getByLabel("Plan title").fill(`${RUN} shooting practice`);
    await focus.check();
    await planner.getByRole("button", { name: "Save practice plan" }).click();
    await expect(planner.getByLabel("Plan title")).toHaveValue(
      `${RUN} shooting practice`,
    );
  } finally {
    await coach.context.close();
  }
});

test("Security: roles cannot reach another team's or coaching-only data", async ({
  browser,
}) => {
  const coachingRegion = "Game score and player statistics";

  // Team Manager and Club-Admin-only see Game Day but never coaching data.
  for (const email of [STAGING.manager, STAGING.adminOnly]) {
    const role = await hostedRole(browser, env, email);
    await role.page.goto(
      `/teams/${STAGING.primaryTeam}/games/${STAGING.completedGame}`,
    );
    // Positive proof the page rendered (panel or an access alert), so a
    // crashed page cannot pass the absence checks below.
    await expect(
      role.page
        .getByRole("region", { name: "Game day" })
        .or(role.page.getByRole("alert"))
        .first(),
    ).toBeVisible();
    await expect(
      role.page.getByRole("region", { name: coachingRegion }),
    ).toHaveCount(0);
    await expect(
      role.page.getByRole("region", { name: "Post-game review" }),
    ).toHaveCount(0);
    await role.context.close();
  }

  // A coach on the other team cannot open this team's Game Day.
  const other = await hostedRole(browser, env, STAGING.otherTeamCoach);
  await other.page.goto(
    `/teams/${STAGING.primaryTeam}/games/${STAGING.completedGame}`,
  );
  await expect(
    other.page.getByRole("region", { name: coachingRegion }),
  ).toHaveCount(0);
  await expect(other.page.getByRole("alert").first()).toBeVisible();
  await other.context.close();

  // A single-team guardian cannot open the other team, or player management.
  const guardian = await hostedRole(browser, env, STAGING.guardianTwo);
  await guardian.page.goto(
    `/teams/${STAGING.secondTeam}/games/${STAGING.secondTeamGame}`,
  );
  await expect(guardian.page.getByRole("alert").first()).toBeVisible();
  await expect(
    guardian.page.getByRole("button", { name: "Save RSVP" }),
  ).toHaveCount(0);
  await guardian.page.goto("/players");
  await expect(guardian.page.locator("body")).toBeVisible();
  await expect(
    guardian.page.getByRole("button", { name: "Register team" }),
  ).toHaveCount(0);
  await guardian.context.close();

  // Database layer: the guardian's own session is refused coaching RPCs.
  const admin = createClient(env.supabaseUrl, env.secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: STAGING.guardianTwo,
  });
  const tokenHash = link.data.properties?.hashed_token;
  if (tokenHash === undefined) throw new Error("No one-time proof.");
  const client = createClient(env.supabaseUrl, env.publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const session = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  expect(session.error).toBeNull();
  const stats = await client.rpc("read_game_coaching_stats", {
    p_event_id: STAGING.completedGame,
  });
  expect(stats.error?.message).toBe("FORBIDDEN");
  const notes = await client.rpc("list_private_player_game_notes", {
    p_event_id: STAGING.completedGame,
  });
  expect(notes.error?.message).toBe("FORBIDDEN");
});
