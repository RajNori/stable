import { describe, expect, it } from "vitest";

import {
  auditEventSchema,
  clubStructureSnapshotSchema,
  competitionSchema,
  seasonSchema,
  teamSchema,
  venueSchema,
} from "./index.js";

const clubId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const seasonId = "88888888-8888-4888-8888-888888888888";
const competitionId = "99999999-9999-4999-8999-999999999999";
const venueId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const teamId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const actorUserId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const auditId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

describe("club structure contract", () => {
  it("accepts a season, competition, venue, and team in one club", () => {
    expect(
      seasonSchema.parse({
        id: seasonId,
        clubId,
        name: " 2026 Winter ",
        active: true,
      }).name,
    ).toBe("2026 Winter");
    expect(
      competitionSchema.parse({
        id: competitionId,
        clubId,
        seasonId,
        name: "Championship",
        active: true,
      }).seasonId,
    ).toBe(seasonId);
    expect(
      venueSchema.parse({
        id: venueId,
        clubId,
        name: "Home Court",
        active: true,
      }).clubId,
    ).toBe(clubId);
    expect(
      teamSchema.parse({
        id: teamId,
        clubId,
        seasonId,
        competitionId: null,
        venueId: null,
        name: "U14 Boys",
        active: true,
      }).competitionId,
    ).toBeNull();
  });

  it("rejects an empty name, a global role, and a child name on an audit event", () => {
    expect(
      seasonSchema.safeParse({
        id: seasonId,
        clubId,
        name: "   ",
        active: true,
      }).success,
    ).toBe(false);
    expect(
      auditEventSchema.safeParse({
        id: auditId,
        clubId,
        actorUserId,
        action: "season.created",
        targetId: seasonId,
        role: "CLUB_ADMIN",
      }).success,
    ).toBe(false);
    expect(
      auditEventSchema.safeParse({
        id: auditId,
        clubId,
        actorUserId,
        action: "team.created",
        targetId: teamId,
        playerName: "A Player",
      }).success,
    ).toBe(false);
    expect(
      auditEventSchema.safeParse({
        id: auditId,
        clubId,
        actorUserId,
        action: "not.an.action",
        targetId: seasonId,
      }).success,
    ).toBe(false);
  });

  it("accepts an audit event that records only actor, club, action, and target", () => {
    const event = auditEventSchema.parse({
      id: auditId,
      clubId,
      actorUserId,
      action: "team.updated",
      targetId: teamId,
    });

    expect(event).toEqual({
      id: auditId,
      clubId,
      actorUserId,
      action: "team.updated",
      targetId: teamId,
    });
  });

  it("accepts a snapshot of the four structure lists", () => {
    const snapshot = clubStructureSnapshotSchema.parse({
      seasons: [{ id: seasonId, clubId, name: "2026 Winter", active: true }],
      competitions: [],
      teams: [
        {
          id: teamId,
          clubId,
          seasonId,
          competitionId,
          venueId,
          name: "U14 Boys",
          active: true,
        },
      ],
      venues: [{ id: venueId, clubId, name: "Home Court", active: false }],
    });

    expect(snapshot.teams[0]?.name).toBe("U14 Boys");
    expect(snapshot.competitions).toEqual([]);
  });
});
