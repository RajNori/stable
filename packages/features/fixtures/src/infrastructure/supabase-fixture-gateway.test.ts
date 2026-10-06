import { describe, expect, it } from "vitest";

import type { OfficialFixture } from "../application/fixture-commands.js";
import { fixtureMessages } from "../application/fixture-messages.js";
import { createSupabaseFixtureGateway } from "./supabase-fixture-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";
const startsAt = "2026-10-10T07:30:00.000Z";

function official(): OfficialFixture {
  return {
    clubId,
    teamId,
    startsAt,
    endsAt: null,
    venueId: null,
    courtLabel: null,
    competitionId: null,
    roundLabel: null,
    opponentName: "Visitors",
    officialStartAt: startsAt,
    officialVenueText: null,
    officialCourtLabel: null,
    homeAway: null,
  };
}

function row() {
  return {
    event_id: eventId,
    club_id: clubId,
    team_id: teamId,
    starts_at: "2026-10-10T18:30:00+11:00",
    ends_at: null,
    venue_id: null,
    court_label: null,
    event_status: "SCHEDULED",
    competition_id: null,
    round_label: null,
    opponent_name: "Visitors",
    source: "MANUAL",
    external_id: null,
    official_start_at: startsAt,
    official_venue_text: null,
    official_court_label: null,
    fixture_status: "SCHEDULED",
    home_away: null,
    team_score: null,
    opponent_score: null,
    result_status: null,
    last_external_sync_at: null,
    arrival_at: null,
    uniform_note: null,
    coach_focus: null,
    team_note: null,
  };
}

function client(options: {
  data?: unknown;
  error?: { message: string } | null;
  team?: unknown;
  teamError?: { message: string } | null;
}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve({
        data: options.data ?? null,
        error: options.error ?? null,
      });
    },
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  calls.push({ name: table, args: {} });
                  return Promise.resolve({
                    data: options.team === undefined ? null : options.team,
                    error: options.teamError ?? null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("fixture gateway", () => {
  it("creates, imports, and updates through separate operations", async () => {
    const db = client({ data: eventId });
    const gateway = createSupabaseFixtureGateway(db);
    await gateway.createManualFixture(official());
    await gateway.importFixture({ ...official(), externalId: "ext-1" });
    await gateway.updateOfficialFixture({
      ...official(),
      eventId,
      fixtureStatus: "SCHEDULED",
      teamScore: null,
      opponentScore: null,
      resultStatus: null,
    });
    await gateway.updateFixtureOverlay({
      eventId,
      arrivalAt: startsAt,
      uniformNote: "White",
      coachFocus: null,
      teamNote: null,
    });

    expect(db.calls.map((call) => call.name)).toEqual([
      "create_manual_fixture",
      "import_fixture",
      "update_official_fixture",
      "update_fixture_overlay",
    ]);
    expect(db.calls[0]?.args).not.toHaveProperty("p_arrival_at");
    expect(db.calls[0]?.args).not.toHaveProperty("p_external_id");
    expect(db.calls[1]?.args["p_external_id"]).toBe("ext-1");
    expect(db.calls[1]?.args).not.toHaveProperty("p_uniform_note");
    expect(db.calls[2]?.args).not.toHaveProperty("p_arrival_at");
    expect(db.calls[3]?.args).not.toHaveProperty("p_opponent_name");
    expect(db.calls[3]?.args).not.toHaveProperty("p_team_score");
  });

  it("reads a fixture row and an empty team list", async () => {
    const listed = client({ data: [row()] });
    const fixtures =
      await createSupabaseFixtureGateway(listed).listTeamFixtures(teamId);
    expect(fixtures[0]?.opponentName).toBe("Visitors");
    expect(fixtures[0]?.startsAt).toBe("2026-10-10T07:30:00.000Z");
    expect(fixtures[0]?.source).toBe("MANUAL");

    const missing = client({ data: [] });
    await expect(
      createSupabaseFixtureGateway(missing).readFixture(eventId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const read = client({ data: [row()] });
    await expect(
      createSupabaseFixtureGateway(read).readFixture(eventId),
    ).resolves.toMatchObject({ eventId, opponentName: "Visitors" });

    const created = client({ data: [eventId] });
    await expect(
      createSupabaseFixtureGateway(created).createManualFixture(official()),
    ).resolves.toEqual({ eventId });

    const invalidInstant = client({
      data: [{ ...row(), starts_at: "not-a-time" }],
    });
    await expect(
      createSupabaseFixtureGateway(invalidInstant).readFixture(eventId),
    ).rejects.toMatchObject({ code: "INTERNAL" });

    const invalidStatus = client({
      data: [{ ...row(), event_status: "ARCHIVED" }],
    });
    await expect(
      createSupabaseFixtureGateway(invalidStatus).listTeamFixtures(teamId),
    ).rejects.toMatchObject({ code: "INTERNAL" });

    const broken = client({ data: [{ opponent_name: "Visitors" }] });
    await expect(
      createSupabaseFixtureGateway(broken).listTeamFixtures(teamId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: fixtureMessages.readFailed,
    });
  });

  it("maps database failures and hides driver text", async () => {
    const codes = [
      ["UNAUTHENTICATED", "UNAUTHENTICATED", fixtureMessages.unauthenticated],
      ["FORBIDDEN", "FORBIDDEN", fixtureMessages.forbidden],
      ["NOT_FOUND", "NOT_FOUND", fixtureMessages.notFound],
      [
        "VALIDATION_FAILED",
        "VALIDATION_FAILED",
        fixtureMessages.validationFailed,
      ],
      ["CONFLICT", "CONFLICT", fixtureMessages.conflict],
    ] as const;
    for (const [sql, code, message] of codes) {
      await expect(
        createSupabaseFixtureGateway(
          client({ data: null, error: { message: `P0001: ${sql}` } }),
        ).importFixture({ ...official(), externalId: "ext-1" }),
      ).rejects.toMatchObject({ code, message });
    }
    await expect(
      createSupabaseFixtureGateway(
        client({
          data: null,
          error: { message: "P0001: CONFLICT opponent Visitors" },
        }),
      ).createManualFixture(official()),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: fixtureMessages.saveFailed,
    });
    await expect(
      createSupabaseFixtureGateway(
        client({ data: null, error: { message: "permission denied" } }),
      ).listTeamFixtures(teamId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: fixtureMessages.readFailed,
    });
    await expect(
      createSupabaseFixtureGateway(client({ data: null })).createManualFixture(
        official(),
      ),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: fixtureMessages.saveFailed,
    });
    await expect(
      createSupabaseFixtureGateway(
        client({ data: { id: eventId } }),
      ).listTeamFixtures(teamId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("reads a visible team and fails closed on a bad row", async () => {
    const db = client({
      team: { id: teamId, name: "U14 Boys", active: true, club_id: clubId },
    });
    await expect(
      createSupabaseFixtureGateway(db).readVisibleTeam(teamId),
    ).resolves.toEqual({
      id: teamId,
      name: "U14 Boys",
      active: true,
      clubId,
    });
    await expect(
      createSupabaseFixtureGateway(client({})).readVisibleTeam(teamId),
    ).resolves.toBeNull();
    await expect(
      createSupabaseFixtureGateway(
        client({ team: { id: teamId }, teamError: null }),
      ).readVisibleTeam(teamId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseFixtureGateway(
        client({ teamError: { message: "permission denied" } }),
      ).readVisibleTeam(teamId),
    ).rejects.toMatchObject({ message: fixtureMessages.readFailed });
  });
});
