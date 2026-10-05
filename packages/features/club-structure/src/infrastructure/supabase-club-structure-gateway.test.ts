import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { clubStructureMessages } from "../application/club-structure-commands.js";
import { createSupabaseClubStructureGateway } from "./supabase-club-structure-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const seasonId = "88888888-8888-4888-8888-888888888888";
const competitionId = "12121212-1212-4121-8121-121212121212";
const venueId = "34343434-3434-4343-8343-343434343434";
const teamId = "99999999-9999-4999-8999-999999999999";
const userId = "22222222-2222-4222-8222-222222222222";
const driverText =
  "duplicate key value violates unique constraint users_email_key";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type RpcCall = {
  name: string;
  args: Record<string, unknown>;
};

function ok(data: unknown): QueryResult {
  return { data, error: null };
}

function fail(message: string): QueryResult {
  return { data: null, error: { message } };
}

function seasonRow(name = "2026 Winter", active = true) {
  return { id: seasonId, club_id: clubId, name, active };
}

function competitionRow() {
  return {
    id: competitionId,
    club_id: clubId,
    season_id: seasonId,
    name: "Championship",
    active: true,
  };
}

function venueRow() {
  return { id: venueId, club_id: clubId, name: "Home Court", active: true };
}

function teamRow(name = "U14 Boys") {
  return {
    id: teamId,
    club_id: clubId,
    season_id: seasonId,
    competition_id: null,
    venue_id: null,
    name,
    active: true,
  };
}

function createHarness(input?: {
  rpc?: (name: string, args: Record<string, unknown>) => QueryResult;
  rows?: Record<string, QueryResult>;
  user?: QueryResult & {
    data: { user: { id: string } | null };
  };
}) {
  const rpcCalls: RpcCall[] = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      const result = input?.rpc?.(name, args) ?? ok(seasonRow());
      return Promise.resolve(result);
    },
    from(table: string) {
      const result = input?.rows?.[table] ?? ok([]);
      const builder = {
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(result);
        },
        then(
          onFulfilled: (value: QueryResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return {
        select() {
          return builder;
        },
      };
    },
    auth: {
      getUser() {
        return Promise.resolve(
          input?.user ?? { data: { user: { id: userId } }, error: null },
        );
      },
    },
  };

  return {
    rpcCalls,
    gateway: createSupabaseClubStructureGateway(client),
  };
}

describe("supabase club structure gateway", () => {
  it("maps audited season, competition, venue, and team writes", async () => {
    const { gateway, rpcCalls } = createHarness({
      rpc: (name) => {
        if (
          name === "create_club_competition" ||
          name === "update_club_competition"
        ) {
          return ok(competitionRow());
        }
        if (name === "create_club_venue" || name === "update_club_venue") {
          return ok(venueRow());
        }
        if (name === "create_club_team" || name === "update_club_team") {
          return ok([teamRow()]);
        }
        if (name === "update_club_season") {
          return ok(seasonRow("2026 Winter", false));
        }
        return ok(seasonRow());
      },
    });

    const season = await gateway.writer.createSeason({
      action: "season.created",
      actorUserId: userId,
      clubId,
      name: "2026 Winter",
    });
    expect(season).toEqual({
      id: seasonId,
      clubId,
      name: "2026 Winter",
      active: true,
    });

    const updatedSeason = await gateway.writer.updateSeason({
      action: "season.updated",
      actorUserId: userId,
      clubId,
      seasonId,
      name: "2026 Winter",
      active: false,
    });
    expect(updatedSeason.active).toBe(false);

    const competition = await gateway.writer.createCompetition({
      action: "competition.created",
      actorUserId: userId,
      clubId,
      seasonId,
      name: "Championship",
    });
    expect(competition.seasonId).toBe(seasonId);
    await gateway.writer.updateCompetition({
      action: "competition.updated",
      actorUserId: userId,
      clubId,
      competitionId,
      name: "Championship",
      active: true,
    });

    const venue = await gateway.writer.createVenue({
      action: "venue.created",
      actorUserId: userId,
      clubId,
      name: "Home Court",
    });
    expect(venue.name).toBe("Home Court");
    await gateway.writer.updateVenue({
      action: "venue.updated",
      actorUserId: userId,
      clubId,
      venueId,
      name: "Home Court",
      active: true,
    });

    const team = await gateway.writer.createTeam({
      action: "team.created",
      actorUserId: userId,
      clubId,
      seasonId,
      competitionId: null,
      venueId: null,
      name: "U14 Boys",
    });
    expect(team.competitionId).toBeNull();
    await gateway.writer.updateTeam({
      action: "team.updated",
      actorUserId: userId,
      clubId,
      teamId,
      name: "U14 Boys",
      active: true,
    });

    expect(rpcCalls.map((call) => call.name)).toEqual([
      "create_club_season",
      "update_club_season",
      "create_club_competition",
      "update_club_competition",
      "create_club_venue",
      "update_club_venue",
      "create_club_team",
      "update_club_team",
    ]);
    expect(rpcCalls[0]?.args).toEqual({
      p_club_id: clubId,
      p_name: "2026 Winter",
    });
  });

  it("reads the created season and team after the combined command", async () => {
    const { gateway, rpcCalls } = createHarness({
      rpc: () =>
        ok({
          season_id: seasonId,
          team_id: teamId,
        }),
      rows: {
        seasons: ok(seasonRow("Autumn")),
        teams: ok(teamRow("U12 Girls")),
      },
    });

    const created = await gateway.writer.createSeasonAndTeam({
      actorUserId: userId,
      clubId,
      seasonName: "Autumn",
      teamName: "U12 Girls",
    });

    expect(created.season.name).toBe("Autumn");
    expect(created.team.name).toBe("U12 Girls");
    expect(rpcCalls[0]?.name).toBe("create_club_season_and_team");
  });

  it("hides driver text and maps only known operation codes", async () => {
    const hidden = createHarness({ rpc: () => fail(driverText) });
    await expect(
      hidden.gateway.writer.createSeason({
        action: "season.created",
        actorUserId: userId,
        clubId,
        name: "2026 Winter",
      }),
    ).rejects.toSatisfy((error: unknown) => {
      return (
        error instanceof ApplicationError &&
        error.code === "INTERNAL" &&
        error.message === clubStructureMessages.saveFailed &&
        !error.message.includes("duplicate")
      );
    });

    const forbidden = createHarness({ rpc: () => fail("42501: FORBIDDEN") });
    await expect(
      forbidden.gateway.writer.createVenue({
        action: "venue.created",
        actorUserId: userId,
        clubId,
        name: "Home Court",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: clubStructureMessages.forbidden,
    });

    const missing = createHarness({ rpc: () => fail("NOT_FOUND") });
    await expect(
      missing.gateway.writer.updateTeam({
        action: "team.updated",
        actorUserId: userId,
        clubId,
        teamId,
        name: "U14 Boys",
        active: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const invalid = createHarness({ rpc: () => fail("VALIDATION_FAILED") });
    await expect(
      invalid.gateway.writer.createTeam({
        action: "team.created",
        actorUserId: userId,
        clubId,
        seasonId,
        competitionId: null,
        venueId: null,
        name: "U14 Boys",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const signedOut = createHarness({ rpc: () => fail("UNAUTHENTICATED") });
    await expect(
      signedOut.gateway.writer.updateSeason({
        action: "season.updated",
        actorUserId: userId,
        clubId,
        seasonId,
        name: "2026 Winter",
        active: true,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });

    const dirty = createHarness({
      rpc: () => fail(`VALIDATION_FAILED: ${driverText}`),
    });
    await expect(
      dirty.gateway.writer.createCompetition({
        action: "competition.created",
        actorUserId: userId,
        clubId,
        seasonId,
        name: "Championship",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: clubStructureMessages.saveFailed,
    });
  });

  it("rejects an empty or unreadable operation result", async () => {
    const empty = createHarness({ rpc: () => ok([]) });
    await expect(
      empty.gateway.writer.updateVenue({
        action: "venue.updated",
        actorUserId: userId,
        clubId,
        venueId,
        name: "Home Court",
        active: false,
      }),
    ).rejects.toMatchObject({ message: clubStructureMessages.saveFailed });

    const missingIds = createHarness({
      rpc: () => ok({ season_id: seasonId }),
    });
    await expect(
      missingIds.gateway.writer.createSeasonAndTeam({
        actorUserId: userId,
        clubId,
        seasonName: "Autumn",
        teamName: "U12 Girls",
      }),
    ).rejects.toMatchObject({ message: clubStructureMessages.saveFailed });

    const missingRow = createHarness({
      rpc: () => ok({ season_id: seasonId, team_id: teamId }),
      rows: {
        seasons: ok(null),
        teams: ok(teamRow()),
      },
    });
    await expect(
      missingRow.gateway.writer.createSeasonAndTeam({
        actorUserId: userId,
        clubId,
        seasonName: "Autumn",
        teamName: "U12 Girls",
      }),
    ).rejects.toMatchObject({ message: clubStructureMessages.saveFailed });
  });

  it("lists club structure and looks up related rows for the same club", async () => {
    const { gateway } = createHarness({
      rows: {
        seasons: ok([seasonRow()]),
        competitions: ok([competitionRow()]),
        teams: ok([teamRow()]),
        venues: ok([venueRow()]),
      },
    });

    await expect(gateway.list(clubId)).resolves.toMatchObject({
      seasons: [{ name: "2026 Winter" }],
      competitions: [{ name: "Championship" }],
      teams: [{ name: "U14 Boys" }],
      venues: [{ name: "Home Court" }],
    });

    const lookup = createHarness({
      rows: {
        seasons: ok(seasonRow()),
        competitions: ok(competitionRow()),
        venues: ok(venueRow()),
        teams: ok(teamRow()),
      },
    });
    await expect(
      lookup.gateway.directory.findSeason(seasonId),
    ).resolves.toEqual({
      id: seasonId,
      clubId,
    });
    await expect(
      lookup.gateway.directory.findCompetition(competitionId),
    ).resolves.toEqual({
      id: competitionId,
      clubId,
      seasonId,
    });
    await expect(lookup.gateway.directory.findVenue(venueId)).resolves.toEqual({
      id: venueId,
      clubId,
    });
    await expect(
      lookup.gateway.directory.findTeam(teamId),
    ).resolves.toMatchObject({
      id: teamId,
      name: "U14 Boys",
    });

    const absent = createHarness({
      rows: {
        seasons: ok(null),
        competitions: ok(null),
        venues: ok(null),
        teams: ok(null),
      },
    });
    await expect(
      absent.gateway.directory.findSeason(seasonId),
    ).resolves.toBeNull();
    await expect(
      absent.gateway.directory.findCompetition(competitionId),
    ).resolves.toBeNull();
    await expect(
      absent.gateway.directory.findVenue(venueId),
    ).resolves.toBeNull();
    await expect(absent.gateway.directory.findTeam(teamId)).resolves.toBeNull();
  });

  it("hides read failures for lists, lookups, and memberships", async () => {
    const listed = createHarness({
      rows: { seasons: fail(driverText) },
    });
    await expect(listed.gateway.list(clubId)).rejects.toMatchObject({
      code: "INTERNAL",
      message: clubStructureMessages.readFailed,
    });

    const lookup = createHarness({
      rows: { competitions: fail(driverText) },
    });
    await expect(
      lookup.gateway.directory.findCompetition(competitionId),
    ).rejects.toMatchObject({ message: clubStructureMessages.readFailed });

    const malformed = createHarness({
      rows: {
        venues: ok({ id: venueId, club_id: clubId, name: "", active: true }),
      },
    });
    await expect(
      malformed.gateway.directory.findVenue(venueId),
    ).rejects.toMatchObject({ message: clubStructureMessages.saveFailed });

    const signedOut = createHarness({
      user: { data: { user: null }, error: null },
    });
    await expect(signedOut.gateway.readSession()).resolves.toEqual({
      principal: null,
      memberships: [],
    });

    const authFailed = createHarness({
      user: { data: { user: null }, error: { message: driverText } },
    });
    await expect(authFailed.gateway.readSession()).rejects.toMatchObject({
      message: clubStructureMessages.readFailed,
    });

    const member = createHarness({
      rows: {
        club_memberships: ok([
          { club_id: clubId, role: "CLUB_ADMIN", active: true },
        ]),
      },
    });
    await expect(member.gateway.readSession()).resolves.toEqual({
      principal: { userId },
      memberships: [{ clubId, role: "CLUB_ADMIN", active: true }],
    });

    const leakedRole = createHarness({
      rows: {
        club_memberships: ok([
          { club_id: clubId, role: driverText, active: true },
        ]),
      },
    });
    await expect(leakedRole.gateway.readSession()).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof ApplicationError &&
          error.message === clubStructureMessages.readFailed &&
          !error.message.includes("duplicate")
        );
      },
    );

    const unreadable = createHarness({
      rpc: () => ok("not-a-row"),
      rows: {
        seasons: ok([seasonRow()]),
        competitions: ok([1]),
        venues: ok([venueRow()]),
        teams: ok([teamRow()]),
        club_memberships: ok([null]),
      },
    });
    await expect(
      unreadable.gateway.writer.updateCompetition({
        action: "competition.updated",
        actorUserId: userId,
        clubId,
        competitionId,
        name: "Championship",
        active: true,
      }),
    ).rejects.toMatchObject({ message: clubStructureMessages.saveFailed });
    await expect(unreadable.gateway.list(clubId)).rejects.toMatchObject({
      message: clubStructureMessages.saveFailed,
    });
    await expect(unreadable.gateway.readSession()).rejects.toMatchObject({
      message: clubStructureMessages.readFailed,
    });

    const badShapes = [ok(["not-a-row"]), ok([null]), ok([venueRow()])];
    for (const seasons of badShapes) {
      const listed = createHarness({
        rows: {
          seasons,
          competitions: ok([1]),
          venues: ok([null]),
          teams: ok(["not-a-row"]),
        },
      });
      await expect(listed.gateway.list(clubId)).rejects.toMatchObject({
        message: clubStructureMessages.saveFailed,
      });
    }

    const badMemberships = [
      { club_id: 1, role: "CLUB_ADMIN", active: true },
      { club_id: clubId, role: 1, active: true },
      { club_id: clubId, role: "CLUB_ADMIN", active: "yes" },
    ];
    for (const membership of badMemberships) {
      const session = createHarness({
        rows: { club_memberships: ok([membership]) },
      });
      await expect(session.gateway.readSession()).rejects.toMatchObject({
        message: clubStructureMessages.readFailed,
      });
    }

    const badVenue = createHarness({
      rows: {
        seasons: ok([seasonRow()]),
        competitions: ok([competitionRow()]),
        venues: ok([null]),
        teams: ok([teamRow()]),
      },
    });
    await expect(badVenue.gateway.list(clubId)).rejects.toMatchObject({
      message: clubStructureMessages.saveFailed,
    });

    const badTeam = createHarness({
      rows: {
        seasons: ok([seasonRow()]),
        competitions: ok([competitionRow()]),
        venues: ok([venueRow()]),
        teams: ok(["not-a-row"]),
      },
    });
    await expect(badTeam.gateway.list(clubId)).rejects.toMatchObject({
      message: clubStructureMessages.saveFailed,
    });

    const notASeasonList = createHarness({
      rows: { seasons: ok({ id: seasonId }) },
    });
    await expect(notASeasonList.gateway.list(clubId)).rejects.toMatchObject({
      message: clubStructureMessages.readFailed,
    });

    const notAList = createHarness({
      rows: { club_memberships: ok({ club_id: clubId }) },
    });
    await expect(notAList.gateway.readSession()).rejects.toMatchObject({
      message: clubStructureMessages.readFailed,
    });
  });
});
