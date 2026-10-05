import { ApplicationError } from "@stable/contracts";
import type { MembershipFact, Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  createCompetition,
  createSeason,
  createSeasonAndTeam,
  createTeam,
  createVenue,
  updateCompetition,
  updateSeason,
  updateTeam,
  updateVenue,
} from "./club-structure-commands.js";
import type {
  ClubStructureDirectory,
  ClubStructureWriter,
} from "./club-structure-commands.js";

const clubId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherClubId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const seasonId = "88888888-8888-4888-8888-888888888888";
const competitionId = "99999999-9999-4999-8999-999999999999";
const venueId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const teamId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const principal: Principal = { userId, displayName: "Local Member" };
const adminMembership: MembershipFact = {
  clubId,
  role: "CLUB_ADMIN",
  active: true,
};

function season(name = "2026 Winter") {
  return { id: seasonId, clubId, name, active: true };
}

function directory(
  overrides: Partial<ClubStructureDirectory> = {},
): ClubStructureDirectory {
  return {
    findSeason: async () => ({ id: seasonId, clubId }),
    findCompetition: async () => ({
      id: competitionId,
      clubId,
      seasonId,
    }),
    findVenue: async () => ({ id: venueId, clubId }),
    findTeam: async () => ({
      id: teamId,
      clubId,
      seasonId,
      competitionId: null,
      venueId: null,
      name: "U14 Boys",
      active: true,
    }),
    ...overrides,
  };
}

function writer(overrides: Partial<ClubStructureWriter> = {}): {
  writer: ClubStructureWriter;
  calls: unknown[];
} {
  const calls: unknown[] = [];
  return {
    calls,
    writer: {
      createSeason: async (command) => {
        calls.push(command);
        return season(command.name);
      },
      updateSeason: async (command) => {
        calls.push(command);
        return { ...season(command.name), active: command.active };
      },
      createCompetition: async (command) => {
        calls.push(command);
        return {
          id: competitionId,
          clubId: command.clubId,
          seasonId: command.seasonId,
          name: command.name,
          active: true,
        };
      },
      updateCompetition: async (command) => {
        calls.push(command);
        return {
          id: competitionId,
          clubId: command.clubId,
          seasonId,
          name: command.name,
          active: command.active,
        };
      },
      createVenue: async (command) => {
        calls.push(command);
        return {
          id: venueId,
          clubId: command.clubId,
          name: command.name,
          active: true,
        };
      },
      updateVenue: async (command) => {
        calls.push(command);
        return {
          id: venueId,
          clubId: command.clubId,
          name: command.name,
          active: command.active,
        };
      },
      createTeam: async (command) => {
        calls.push(command);
        return {
          id: teamId,
          clubId: command.clubId,
          seasonId: command.seasonId,
          competitionId: command.competitionId,
          venueId: command.venueId,
          name: command.name,
          active: true,
        };
      },
      updateTeam: async (command) => {
        calls.push(command);
        return {
          id: teamId,
          clubId: command.clubId,
          seasonId,
          competitionId: null,
          venueId: null,
          name: command.name,
          active: command.active,
        };
      },
      createSeasonAndTeam: async (command) => {
        calls.push(command);
        return {
          season: season(command.seasonName),
          team: {
            id: teamId,
            clubId: command.clubId,
            seasonId,
            competitionId: null,
            venueId: null,
            name: command.teamName,
            active: true,
          },
        };
      },
      ...overrides,
    },
  };
}

describe("club structure commands", () => {
  it("rejects a missing principal before any write", async () => {
    const fake = writer();
    await expect(
      createSeason({
        principal: null,
        memberships: [adminMembership],
        clubId,
        name: "Spring",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fake.calls).toEqual([]);
  });

  it("rejects a revoked admin and an admin of another club", async () => {
    const fake = writer();
    await expect(
      createVenue({
        principal,
        memberships: [{ ...adminMembership, active: false }],
        clubId,
        name: "Court",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createSeasonAndTeam({
        principal,
        memberships: [{ ...adminMembership, clubId: otherClubId }],
        clubId,
        seasonName: "Spring",
        teamName: "U12",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.calls).toEqual([]);
  });

  it("rejects an empty name before any write", async () => {
    const fake = writer();
    await expect(
      createSeason({
        principal,
        memberships: [adminMembership],
        clubId,
        name: "   ",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fake.calls).toEqual([]);
  });

  it("creates and deactivates a season for an active club admin", async () => {
    const fake = writer();
    const created = await createSeason({
      principal,
      memberships: [adminMembership],
      clubId,
      name: " Spring ",
      writer: fake.writer,
    });
    const updated = await updateSeason({
      principal,
      memberships: [adminMembership],
      seasonId,
      name: "Spring",
      active: false,
      directory: directory(),
      writer: fake.writer,
    });

    expect(created.name).toBe("Spring");
    expect(updated.active).toBe(false);
    expect(fake.calls[0]).toMatchObject({
      action: "season.created",
      actorUserId: userId,
      clubId,
      name: "Spring",
    });
    expect(fake.calls[1]).toMatchObject({
      action: "season.updated",
      active: false,
    });
    expect(JSON.stringify(fake.calls)).not.toContain("playerName");
  });

  it("refuses a competition or team whose season is in another club", async () => {
    const fake = writer();
    const otherSeason = directory({
      findSeason: async () => ({ id: seasonId, clubId: otherClubId }),
    });
    await expect(
      createCompetition({
        principal,
        memberships: [adminMembership],
        clubId,
        seasonId,
        name: "Championship",
        directory: otherSeason,
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The season is not in this club.",
    });
    await expect(
      createTeam({
        principal,
        memberships: [adminMembership],
        clubId,
        seasonId,
        competitionId: null,
        venueId: null,
        name: "U12",
        directory: otherSeason,
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ message: "The season is not in this club." });
    expect(fake.calls).toEqual([]);
  });

  it("refuses a team competition or venue from outside the club", async () => {
    const fake = writer();
    await expect(
      createTeam({
        principal,
        memberships: [adminMembership],
        clubId,
        seasonId,
        competitionId,
        venueId: null,
        name: "U12",
        directory: directory({
          findCompetition: async () => ({
            id: competitionId,
            clubId: otherClubId,
            seasonId,
          }),
        }),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({
      message: "The competition is not in this club.",
    });
    await expect(
      createTeam({
        principal,
        memberships: [adminMembership],
        clubId,
        seasonId,
        competitionId,
        venueId: null,
        name: "U12",
        directory: directory({
          findCompetition: async () => ({
            id: competitionId,
            clubId,
            seasonId: "12121212-1212-4121-8121-121212121212",
          }),
        }),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({
      message: "The competition is not in this club.",
    });
    await expect(
      createTeam({
        principal,
        memberships: [adminMembership],
        clubId,
        seasonId,
        competitionId: null,
        venueId,
        name: "U12",
        directory: directory({
          findVenue: async () => ({ id: venueId, clubId: otherClubId }),
        }),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ message: "The venue is not in this club." });
    await expect(
      createTeam({
        principal,
        memberships: [adminMembership],
        clubId,
        seasonId,
        competitionId: null,
        venueId,
        name: "U12",
        directory: directory({
          findVenue: async () => null,
        }),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ message: "The venue is not in this club." });
    expect(fake.calls).toEqual([]);
  });

  it("creates a competition, venue, and team, then deactivates them", async () => {
    const fake = writer();
    const catalog = directory();
    const competition = await createCompetition({
      principal,
      memberships: [adminMembership],
      clubId,
      seasonId,
      name: "Championship",
      directory: catalog,
      writer: fake.writer,
    });
    const venue = await createVenue({
      principal,
      memberships: [adminMembership],
      clubId,
      name: "Home Court",
      writer: fake.writer,
    });
    const team = await createTeam({
      principal,
      memberships: [adminMembership],
      clubId,
      seasonId,
      competitionId,
      venueId,
      name: "U14 Boys",
      directory: catalog,
      writer: fake.writer,
    });
    await createTeam({
      principal,
      memberships: [adminMembership],
      clubId,
      seasonId,
      competitionId: null,
      venueId: null,
      name: "U12",
      directory: catalog,
      writer: fake.writer,
    });
    const retired = await updateCompetition({
      principal,
      memberships: [adminMembership],
      competitionId,
      name: "Championship",
      active: false,
      directory: catalog,
      writer: fake.writer,
    });
    await updateVenue({
      principal,
      memberships: [adminMembership],
      venueId,
      name: "Home Court",
      active: false,
      directory: catalog,
      writer: fake.writer,
    });
    await updateTeam({
      principal,
      memberships: [adminMembership],
      teamId,
      name: "U14 Boys",
      active: false,
      directory: catalog,
      writer: fake.writer,
    });

    expect(competition.seasonId).toBe(seasonId);
    expect(venue.name).toBe("Home Court");
    expect(team.venueId).toBe(venueId);
    expect(retired.active).toBe(false);
    expect(
      fake.calls.map((call) => (call as { action: string }).action),
    ).toEqual([
      "competition.created",
      "venue.created",
      "team.created",
      "team.created",
      "competition.updated",
      "venue.updated",
      "team.updated",
    ]);
  });

  it("returns not found when the record is absent", async () => {
    const fake = writer();
    const missing = directory({
      findSeason: async () => null,
      findCompetition: async () => null,
      findVenue: async () => null,
      findTeam: async () => null,
    });
    await expect(
      updateSeason({
        principal,
        memberships: [adminMembership],
        seasonId,
        name: "Spring",
        active: true,
        directory: missing,
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateCompetition({
        principal,
        memberships: [adminMembership],
        competitionId,
        name: "Championship",
        active: true,
        directory: missing,
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateVenue({
        principal,
        memberships: [adminMembership],
        venueId,
        name: "Court",
        active: true,
        directory: missing,
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateTeam({
        principal,
        memberships: [adminMembership],
        teamId,
        name: "U12",
        active: true,
        directory: missing,
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fake.calls).toEqual([]);
  });

  it("creates a season and team in one command", async () => {
    const fake = writer();
    const created = await createSeasonAndTeam({
      principal,
      memberships: [adminMembership],
      clubId,
      seasonName: " Spring ",
      teamName: " U12 ",
      writer: fake.writer,
    });

    expect(created.season.name).toBe("Spring");
    expect(created.team.name).toBe("U12");
    expect(fake.calls[0]).toEqual({
      actorUserId: userId,
      clubId,
      seasonName: "Spring",
      teamName: "U12",
    });
  });

  it("hides writer failures and keeps application errors", async () => {
    const failing = writer({
      createSeason: async () => {
        throw new Error("relation seasons does not exist");
      },
    });
    await expect(
      createSeason({
        principal,
        memberships: [adminMembership],
        clubId,
        name: "Spring",
        writer: failing.writer,
      }),
    ).rejects.toEqual(
      new ApplicationError("INTERNAL", "Club structure could not be saved."),
    );

    const forbidden = writer({
      createVenue: async () => {
        throw new ApplicationError(
          "FORBIDDEN",
          "Club structure changes require an active club admin.",
        );
      },
    });
    await expect(
      createVenue({
        principal,
        memberships: [adminMembership],
        clubId,
        name: "Court",
        writer: forbidden.writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
