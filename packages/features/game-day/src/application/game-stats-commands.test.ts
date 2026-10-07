import { describe, expect, it, vi } from "vitest";

import { ApplicationError } from "@stable/contracts";

import {
  saveGamePlayerStat,
  saveManualGameResult,
  readGamePlayerStatHistory,
  type GameStatsAccess,
  type GameStatsWriter,
} from "./game-stats-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "22222222-2222-4222-8222-222222222222";
const eventId = "33333333-3333-4333-8333-333333333333";
const playerId = "44444444-4444-4444-8444-444444444444";

function access(role: "HEAD_COACH" | "ASSISTANT_COACH" | "TEAM_MANAGER") {
  return {
    principal: { userId: "55555555-5555-4555-8555-555555555555" },
    clubMemberships: [],
    teamMemberships: [
      {
        clubId,
        teamId,
        role,
        active: true,
        teamActive: true,
      },
    ],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  } satisfies GameStatsAccess;
}

function writer(): GameStatsWriter {
  return {
    saveManualGameResult: vi.fn(async () => undefined),
    saveGamePlayerStat: vi.fn(async () => undefined),
    readGamePlayerStatHistory: vi.fn(async () => []),
    readGameCoachingStats: vi.fn(async () => ({
      eventId,
      clubId,
      teamId,
      source: "MANUAL" as const,
      teamScore: null,
      opponentScore: null,
      resultStatus: null,
      scheduledMinutes: 40,
      players: [],
    })),
  };
}

describe("M4 game result and player stat commands", () => {
  it.each(["HEAD_COACH", "ASSISTANT_COACH"] as const)(
    "%s can read restricted correction history",
    async (role) => {
      const target = writer();
      vi.mocked(target.readGamePlayerStatHistory).mockResolvedValueOnce([
        {
          eventId,
          playerId,
          actorId: "55555555-5555-4555-8555-555555555555",
          occurredAt: "2026-10-07T10:00:00.000Z",
          before: {
            points: 10,
            rebounds: 2,
            assists: 0,
            steals: 0,
            fouls: 1,
            approximateMinutes: 20,
          },
          after: {
            points: 12,
            rebounds: 2,
            assists: 0,
            steals: 0,
            fouls: 1,
            approximateMinutes: 20,
          },
        },
      ]);
      await expect(
        readGamePlayerStatHistory({
          ...access(role),
          clubId,
          teamId,
          eventId,
          writer: target,
        }),
      ).resolves.toHaveLength(1);
      expect(target.readGamePlayerStatHistory).toHaveBeenCalledWith(eventId);
    },
  );

  it("allows Club Admin history access through the capability matrix", async () => {
    const target = writer();
    await expect(
      readGamePlayerStatHistory({
        principal: { userId: "55555555-5555-4555-8555-555555555555" },
        clubMemberships: [{ clubId, role: "CLUB_ADMIN", active: true }],
        teamMemberships: [],
        guardianLinks: [],
        registrations: [],
        teamActive: true,
        clubId,
        teamId,
        eventId,
        writer: target,
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    { role: "TEAM_MANAGER" as const, active: true },
    { role: "HEAD_COACH" as const, active: false },
  ])(
    "denies $role history access when active=$active",
    async ({ role, active }) => {
      const target = writer();
      const actor = {
        ...access(role),
        teamMemberships: access(role).teamMemberships.map((membership) => ({
          ...membership,
          active,
        })),
      };
      await expect(
        readGamePlayerStatHistory({
          ...actor,
          clubId,
          teamId,
          eventId,
          writer: target,
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(target.readGamePlayerStatHistory).not.toHaveBeenCalled();
    },
  );

  it("rejects history returned for a different game", async () => {
    const target = writer();
    vi.mocked(target.readGamePlayerStatHistory).mockResolvedValueOnce([
      {
        eventId: "99999999-9999-4999-8999-999999999999",
        playerId,
        actorId: "55555555-5555-4555-8555-555555555555",
        occurredAt: "2026-10-07T10:00:00.000Z",
        before: {
          points: 1,
          rebounds: 0,
          assists: 0,
          steals: 0,
          fouls: 0,
          approximateMinutes: 1,
        },
        after: {
          points: 2,
          rebounds: 0,
          assists: 0,
          steals: 0,
          fouls: 0,
          approximateMinutes: 1,
        },
      },
    ]);
    await expect(
      readGamePlayerStatHistory({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        writer: target,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("denies a Guardian history request even when linked to a player", async () => {
    const target = writer();
    await expect(
      readGamePlayerStatHistory({
        ...access("TEAM_MANAGER"),
        teamMemberships: [],
        guardianLinks: [
          {
            clubId,
            playerId,
            active: true,
            playerActive: true,
          },
        ],
        clubId,
        teamId,
        eventId,
        writer: target,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(target.readGamePlayerStatHistory).not.toHaveBeenCalled();
  });

  it("denies a current coach requesting history under a different team scope", async () => {
    const target = writer();
    await expect(
      readGamePlayerStatHistory({
        ...access("HEAD_COACH"),
        clubId,
        teamId: "99999999-9999-4999-8999-999999999999",
        eventId,
        writer: target,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(target.readGamePlayerStatHistory).not.toHaveBeenCalled();
  });

  it("allows active assistants to save a bounded paired score", async () => {
    const target = writer();
    await expect(
      saveManualGameResult({
        ...access("ASSISTANT_COACH"),
        clubId,
        teamId,
        eventId,
        teamScore: 250,
        opponentScore: 0,
        writer: target,
      }),
    ).resolves.toBeUndefined();
    expect(target.saveManualGameResult).toHaveBeenCalledWith({
      eventId,
      teamScore: 250,
      opponentScore: 0,
    });
  });

  it.each([
    { teamScore: 1.5, opponentScore: 1 },
    { teamScore: -1, opponentScore: 1 },
    { teamScore: 251, opponentScore: 1 },
  ])("rejects invalid score values %#", async (values) => {
    await expect(
      saveManualGameResult({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        ...values,
        writer: writer(),
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it("does not grant Team Managers the M4 score command", async () => {
    const target = writer();
    await expect(
      saveManualGameResult({
        ...access("TEAM_MANAGER"),
        clubId,
        teamId,
        eventId,
        teamScore: 10,
        opponentScore: 9,
        writer: target,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(target.saveManualGameResult).not.toHaveBeenCalled();
  });

  it("keeps imported official results read-only", async () => {
    const target = writer();
    vi.mocked(target.readGameCoachingStats).mockResolvedValueOnce({
      eventId,
      clubId,
      teamId,
      source: "IMPORT",
      teamScore: 80,
      opponentScore: 75,
      resultStatus: "FINAL",
      scheduledMinutes: 40,
      players: [],
    });
    await expect(
      saveManualGameResult({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        teamScore: 81,
        opponentScore: 75,
        writer: target,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(target.saveManualGameResult).not.toHaveBeenCalled();
  });

  it("preserves Club Admin stats capability for an existing historical line", async () => {
    const target = writer();
    await expect(
      saveGamePlayerStat({
        principal: { userId: "55555555-5555-4555-8555-555555555555" },
        clubMemberships: [{ clubId, role: "CLUB_ADMIN", active: true }],
        teamMemberships: [],
        guardianLinks: [],
        registrations: [],
        teamActive: true,
        clubId,
        teamId,
        eventId,
        playerId,
        points: 11,
        rebounds: 3,
        assists: 1,
        steals: 0,
        fouls: 1,
        approximateMinutes: 30,
        writer: target,
      }),
    ).resolves.toBeUndefined();
    expect(target.saveGamePlayerStat).toHaveBeenCalledOnce();
  });

  it("rejects a game projection that belongs to another team", async () => {
    const target = writer();
    vi.mocked(target.readGameCoachingStats).mockResolvedValueOnce({
      eventId,
      clubId,
      teamId: "99999999-9999-4999-8999-999999999999",
      source: "MANUAL",
      teamScore: null,
      opponentScore: null,
      resultStatus: null,
      scheduledMinutes: 40,
      players: [],
    });
    await expect(
      saveManualGameResult({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        teamScore: 1,
        opponentScore: 0,
        writer: target,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(target.saveManualGameResult).not.toHaveBeenCalled();
  });

  it("enforces player-stat bounds and scheduled-minute limits", async () => {
    const target = writer();
    await expect(
      saveGamePlayerStat({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        playerId,
        points: 100,
        rebounds: 0,
        assists: 1,
        steals: 2,
        fouls: 20,
        approximateMinutes: 40,
        writer: target,
      }),
    ).resolves.toBeUndefined();
    await expect(
      saveGamePlayerStat({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        playerId,
        points: 101,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
        approximateMinutes: 40,
        writer: target,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      saveGamePlayerStat({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        playerId,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
        approximateMinutes: 41,
        writer: target,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it("allows minutes above 120 when the scheduled game duration permits them", async () => {
    const target = writer();
    vi.mocked(target.readGameCoachingStats).mockResolvedValueOnce({
      eventId,
      clubId,
      teamId,
      source: "MANUAL",
      teamScore: null,
      opponentScore: null,
      resultStatus: null,
      scheduledMinutes: 180,
      players: [],
    });
    await expect(
      saveGamePlayerStat({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        playerId,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
        approximateMinutes: 121,
        writer: target,
      }),
    ).resolves.toBeUndefined();
    expect(target.saveGamePlayerStat).toHaveBeenCalledWith(
      expect.objectContaining({ approximateMinutes: 121 }),
    );
  });

  it("uses 120 minutes when scheduled duration is unavailable", async () => {
    const target = writer();
    vi.mocked(target.readGameCoachingStats).mockResolvedValueOnce({
      eventId,
      clubId,
      teamId,
      source: "IMPORT",
      teamScore: null,
      opponentScore: null,
      resultStatus: null,
      scheduledMinutes: null,
      players: [],
    });
    await expect(
      saveGamePlayerStat({
        ...access("ASSISTANT_COACH"),
        clubId,
        teamId,
        eventId,
        playerId,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
        approximateMinutes: 120,
        writer: target,
      }),
    ).resolves.toBeUndefined();
    await expect(
      saveGamePlayerStat({
        ...access("ASSISTANT_COACH"),
        clubId,
        teamId,
        eventId,
        playerId,
        points: 0,
        rebounds: 0,
        assists: 0,
        steals: 0,
        fouls: 0,
        approximateMinutes: 121,
        writer: target,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
});
