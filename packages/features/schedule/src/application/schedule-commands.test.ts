import type { Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  compareScheduleEntries,
  listTeamSchedule,
  type ScheduleAccess,
  type ScheduleEntry,
  type ScheduleReader,
} from "./schedule-commands.js";
import { agendaRange } from "./schedule-messages.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const otherTeamId = "44444444-4444-4444-8444-444444444444";
const gameId = "55555555-5555-4555-8555-555555555555";
const trainingId = "66666666-6666-4666-8666-666666666666";
const principal: Principal = {
  userId: "77777777-7777-4777-8777-777777777777",
};
const rangeStart = "2026-10-01T00:00:00.000Z";
const rangeEnd = "2026-10-31T23:59:59.999Z";

function access(active = true): ScheduleAccess {
  return {
    principal,
    clubMemberships: [{ clubId, role: "CLUB_ADMIN", active }],
    teamMemberships: [],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function entry(
  eventId: string,
  eventType: ScheduleEntry["eventType"],
  startsAt: string,
): ScheduleEntry {
  return {
    eventId,
    clubId,
    teamId,
    eventType,
    startsAt,
    endsAt: null,
    courtLabel: null,
    eventStatus: "SCHEDULED",
    opponentName: eventType === "GAME" ? "Visitors" : null,
    roundLabel: eventType === "GAME" ? "Round 1" : null,
  };
}

function reader(rows: ScheduleEntry[]): ScheduleReader & { calls: number } {
  return {
    calls: 0,
    listTeamSchedule() {
      this.calls += 1;
      return Promise.resolve(rows);
    },
  };
}

describe("team schedule", () => {
  it("orders games and training on one agenda", async () => {
    const source = reader([
      entry(trainingId, "TRAINING", "2026-10-12T08:00:00.000Z"),
      entry(gameId, "GAME", "2026-10-10T07:30:00.000Z"),
      entry(
        "12121212-1212-4212-8212-121212121212",
        "TRAINING",
        "2026-10-10T07:30:00.000Z",
      ),
    ]);
    const agenda = await listTeamSchedule({
      ...access(),
      clubId,
      teamId,
      rangeStart,
      rangeEnd,
      eventType: null,
      reader: source,
    });

    expect(agenda.map((item) => item.eventId)).toEqual([
      "12121212-1212-4212-8212-121212121212",
      gameId,
      trainingId,
    ]);
    expect(agenda.some((item) => item.eventType === "TRAINING")).toBe(true);
  });

  it("filters by event type and drops rows outside the inclusive range", async () => {
    const source = reader([
      entry(gameId, "GAME", rangeStart),
      entry(trainingId, "TRAINING", rangeEnd),
      entry(
        "13131313-1313-4313-8313-131313131313",
        "GAME",
        "2026-11-01T00:00:00.000Z",
      ),
    ]);
    const training = await listTeamSchedule({
      ...access(),
      clubId,
      teamId,
      rangeStart,
      rangeEnd,
      eventType: "TRAINING",
      reader: source,
    });
    expect(training.map((item) => item.eventId)).toEqual([trainingId]);

    const empty = reader([]);
    await expect(
      listTeamSchedule({
        ...access(),
        clubId,
        teamId,
        rangeStart,
        rangeEnd: rangeStart,
        eventType: null,
        reader: empty,
      }),
    ).resolves.toEqual([]);
  });

  it("denies the wrong team and an inverted range before reading", async () => {
    const source = reader([]);
    await expect(
      listTeamSchedule({
        ...access(),
        clubMemberships: [],
        clubId,
        teamId,
        rangeStart,
        rangeEnd,
        eventType: null,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      listTeamSchedule({
        ...access(false),
        clubId,
        teamId,
        rangeStart,
        rangeEnd,
        eventType: null,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      listTeamSchedule({
        ...access(),
        principal: null,
        clubId,
        teamId,
        rangeStart,
        rangeEnd,
        eventType: null,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      listTeamSchedule({
        ...access(),
        clubId,
        teamId,
        rangeStart: rangeEnd,
        rangeEnd: rangeStart,
        eventType: null,
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(source.calls).toBe(0);
  });

  it("hides a row that belongs to another team", async () => {
    const foreign = entry(gameId, "GAME", rangeStart);
    foreign.teamId = otherTeamId;
    await expect(
      listTeamSchedule({
        ...access(),
        clubId,
        teamId,
        rangeStart,
        rangeEnd,
        eventType: null,
        reader: reader([foreign]),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("builds a 21 day inclusive window", () => {
    expect(agendaRange(new Date("2026-10-07T15:00:00.000Z"))).toEqual({
      rangeStart: "2026-10-07T00:00:00.000Z",
      rangeEnd: "2026-10-28T23:59:59.999Z",
    });
  });

  it("orders a later start after an earlier one and equal ids as ties", () => {
    const earlier = entry(gameId, "GAME", "2026-10-10T07:30:00.000Z");
    const later = entry(trainingId, "TRAINING", "2026-10-12T08:00:00.000Z");
    expect(compareScheduleEntries(later, earlier)).toBe(1);
    expect(compareScheduleEntries(earlier, later)).toBe(-1);
    expect(compareScheduleEntries(earlier, { ...earlier })).toBe(0);
    const sameTime = entry(trainingId, "TRAINING", earlier.startsAt);
    expect(compareScheduleEntries(sameTime, earlier)).toBe(1);
    expect(compareScheduleEntries(earlier, sameTime)).toBe(-1);
  });
});
