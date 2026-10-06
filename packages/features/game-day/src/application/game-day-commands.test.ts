import type { Principal, TeamMembershipFact } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  assignGameDuty,
  readGameDay,
  type GameDayAccess,
  type GameDayProjection,
  type GameDayReader,
} from "./game-day-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";
const userId = "77777777-7777-4777-8777-777777777777";
const playerId = "88888888-8888-4888-8888-888888888888";
const principal: Principal = { userId };

function staff(role: TeamMembershipFact["role"]): GameDayAccess {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [{ clubId, teamId, role, active: true, teamActive: true }],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function guardian(): GameDayAccess {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [],
    guardianLinks: [{ clubId, playerId, active: true, playerActive: true }],
    registrations: [
      { clubId, teamId, playerId, active: true, teamActive: true },
    ],
    teamActive: true,
  };
}

function projection(counts: number | null): GameDayProjection {
  return {
    eventId,
    clubId,
    teamId,
    opponentName: "Visitors",
    roundLabel: "Round 1",
    officialStartAt: "2026-10-10T07:30:00.000Z",
    arrivalAt: "2026-10-10T07:00:00.000Z",
    venueText: "Home",
    courtLabel: "Court 1",
    uniformNote: "White",
    coachFocus: "Press",
    ownRsvp: "UNANSWERED",
    ownDutyLabel: "Scorebook",
    ownDutyStatus: "ASSIGNED",
    attendingCount: counts,
    unavailableCount: counts,
    unsureCount: counts,
    unansweredCount: counts,
  };
}

function reader(row: GameDayProjection): GameDayReader & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    readGameDay: () => {
      calls.push("read");
      return Promise.resolve(row);
    },
    assignGameDuty: () => {
      calls.push("assign");
      return Promise.resolve({
        dutyId: "99999999-9999-4999-8999-999999999999",
      });
    },
  };
}

describe("game day", () => {
  it("shows a guardian their own duty and RSVP without staff counts", async () => {
    const source = reader(projection(4));
    const view = await readGameDay({
      ...guardian(),
      clubId,
      teamId,
      eventId,
      reader: source,
    });
    expect(view.ownRsvp).toBe("UNANSWERED");
    expect(view.ownDutyLabel).toBe("Scorebook");
    expect(view.opponentName).toBe("Visitors");
    expect(view.attendingCount).toBeNull();
    expect(view.unansweredCount).toBeNull();
    expect(view).not.toHaveProperty("privateNote");
  });

  it("keeps staff counts for a coach", async () => {
    const view = await readGameDay({
      ...staff("HEAD_COACH"),
      clubId,
      teamId,
      eventId,
      reader: reader(projection(4)),
    });
    expect(view.attendingCount).toBe(4);
    expect(view.unansweredCount).toBe(4);
  });

  it("lets a manager assign a duty and denies a head coach", async () => {
    const source = reader(projection(0));
    await expect(
      assignGameDuty({
        ...staff("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        dutyType: "SCORER",
        label: "Scorebook",
        assignedUserId: userId,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await assignGameDuty({
      ...staff("TEAM_MANAGER"),
      clubId,
      teamId,
      eventId,
      dutyType: "SCORER",
      label: " Scorebook ",
      assignedUserId: userId,
      reader: source,
    });
    expect(source.calls).toEqual(["assign"]);
  });

  it("rejects a blank duty and a signed-out read before the reader", async () => {
    const source = reader(projection(0));
    await expect(
      assignGameDuty({
        ...staff("TEAM_MANAGER"),
        clubId,
        teamId,
        eventId,
        dutyType: "SCORER",
        label: " ",
        assignedUserId: userId,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      readGameDay({
        ...guardian(),
        principal: null,
        clubId,
        teamId,
        eventId,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      readGameDay({
        ...guardian(),
        clubId,
        teamId,
        eventId: "not-an-id",
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(source.calls).toEqual([]);
  });

  it("hides a projection for another team", async () => {
    const row = projection(0);
    row.teamId = "44444444-4444-4444-8444-444444444444";
    await expect(
      readGameDay({
        ...staff("TEAM_MANAGER"),
        clubId,
        teamId,
        eventId,
        reader: reader(row),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
