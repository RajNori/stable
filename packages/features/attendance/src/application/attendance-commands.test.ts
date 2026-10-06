import type { Principal, TeamMembershipFact } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  listTeamAttendance,
  recordAttendance,
  type AttendanceAccess,
  type AttendanceWriter,
} from "./attendance-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";
const playerId = "88888888-8888-4888-8888-888888888888";
const siblingId = "88888888-8888-4888-8888-888888888889";
const principal: Principal = {
  userId: "77777777-7777-4777-8777-777777777777",
};

function staff(role: TeamMembershipFact["role"]): AttendanceAccess {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [{ clubId, teamId, role, active: true, teamActive: true }],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function guardian(players: string[]): AttendanceAccess {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [],
    guardianLinks: players.map((id) => ({
      clubId,
      playerId: id,
      active: true,
      playerActive: true,
    })),
    registrations: players.map((id) => ({
      clubId,
      teamId,
      playerId: id,
      active: true,
      teamActive: true,
    })),
    teamActive: true,
  };
}

function writer(): AttendanceWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    recordAttendance: () => {
      calls.push("record");
      return Promise.resolve({
        responseId: "99999999-9999-4999-8999-999999999999",
      });
    },
    listTeamAttendance: () => {
      calls.push("list");
      return Promise.resolve([
        {
          playerId,
          status: "UNAVAILABLE",
          absenceCategory: "SICK",
          privateNote: "Fever",
        },
      ]);
    },
  };
}

describe("attendance", () => {
  it("lets a guardian record and update a managed player", async () => {
    const source = writer();
    const saved = await recordAttendance({
      ...guardian([playerId, siblingId]),
      clubId,
      teamId,
      eventId,
      playerId,
      status: "ATTENDING",
      absenceCategory: null,
      privateNote: "  ",
      writer: source,
    });
    expect(saved.responseId).toBe("99999999-9999-4999-8999-999999999999");
    await recordAttendance({
      ...guardian([playerId, siblingId]),
      clubId,
      teamId,
      eventId,
      playerId: siblingId,
      status: "UNAVAILABLE",
      absenceCategory: "FAMILY",
      privateNote: "Away",
      writer: source,
    });
    expect(source.calls).toEqual(["record", "record"]);
  });

  it("gives staff the note and denies a guardian the team list", async () => {
    const source = writer();
    const rows = await listTeamAttendance({
      ...staff("HEAD_COACH"),
      clubId,
      teamId,
      eventId,
      writer: source,
    });
    expect(rows[0]?.privateNote).toBe("Fever");
    expect(rows[0]?.absenceCategory).toBe("SICK");
    await expect(
      listTeamAttendance({
        ...guardian([playerId]),
        clubId,
        teamId,
        eventId,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(source.calls).toEqual(["list"]);
  });

  it("rejects an unrelated player, a category on an attending response, and a signed-out caller", async () => {
    const source = writer();
    await expect(
      recordAttendance({
        ...guardian([playerId]),
        clubId,
        teamId,
        eventId,
        playerId: siblingId,
        status: "UNAVAILABLE",
        absenceCategory: "SICK",
        privateNote: null,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      recordAttendance({
        ...guardian([playerId]),
        clubId,
        teamId,
        eventId,
        playerId,
        status: "ATTENDING",
        absenceCategory: "SICK",
        privateNote: null,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      recordAttendance({
        ...guardian([playerId]),
        clubId,
        teamId,
        eventId,
        playerId,
        status: "UNAVAILABLE",
        absenceCategory: null,
        privateNote: "Bad\nNote",
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      listTeamAttendance({
        ...staff("TEAM_MANAGER"),
        principal: null,
        clubId,
        teamId,
        eventId,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      listTeamAttendance({
        ...staff("TEAM_MANAGER"),
        clubId,
        teamId,
        eventId: "not-an-id",
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(source.calls).toEqual([]);
  });
});
