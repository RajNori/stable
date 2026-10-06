import type { Principal, TeamMembershipFact } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  checkInTraining,
  createTrainingSeries,
  createTrainingSession,
  editTrainingFollowing,
  editTrainingOccurrence,
  editTrainingSeries,
  type TrainingAccess,
  type TrainingWriter,
} from "./training-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";
const seriesId = "99999999-9999-4999-8999-999999999999";
const principal: Principal = {
  userId: "77777777-7777-4777-8777-777777777777",
};

function access(role: TeamMembershipFact["role"]): TrainingAccess {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [{ clubId, teamId, role, active: true, teamActive: true }],
    guardianLinks: [],
    registrations: [],
    teamActive: true,
  };
}

function writer(): TrainingWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    createTrainingSession: () => {
      calls.push("session");
      return Promise.resolve({ eventId });
    },
    createTrainingSeries: () => {
      calls.push("series");
      return Promise.resolve({ seriesId });
    },
    editTrainingOccurrence: () => {
      calls.push("one");
      return Promise.resolve({ eventId });
    },
    editTrainingFollowing: () => {
      calls.push("following");
      return Promise.resolve({ seriesId });
    },
    editTrainingSeries: () => {
      calls.push("edit-series");
      return Promise.resolve({ seriesId });
    },
    checkInTraining: () => {
      calls.push("check-in");
      return Promise.resolve();
    },
  };
}

const series = {
  weekday: 1,
  localTime: "18:30",
  timezone: "Australia/Melbourne",
  startsOn: "2026-10-12",
  endsOn: "2026-10-19",
  courtLabel: " Court 1 ",
  leadCoachUserId: null,
};

describe("training", () => {
  it("lets a head coach create, edit, and split a series", async () => {
    const source = writer();
    await createTrainingSession({
      ...access("HEAD_COACH"),
      ...series,
      clubId,
      teamId,
      startsAt: "2026-10-14T07:30:00.000Z",
      endsAt: null,
      writer: source,
    });
    await createTrainingSeries({
      ...access("HEAD_COACH"),
      ...series,
      clubId,
      teamId,
      writer: source,
    });
    await editTrainingOccurrence({
      ...access("TEAM_MANAGER"),
      clubId,
      teamId,
      eventId,
      startsAt: "2026-10-14T06:00:00.000Z",
      endsAt: null,
      courtLabel: null,
      leadCoachUserId: null,
      writer: source,
    });
    await editTrainingFollowing({
      ...access("HEAD_COACH"),
      clubId,
      teamId,
      eventId,
      weekday: 1,
      localTime: "20:00",
      timezone: "Australia/Melbourne",
      endsOn: null,
      writer: source,
    });
    await editTrainingSeries({
      ...access("HEAD_COACH"),
      clubId,
      teamId,
      seriesId,
      weekday: 1,
      localTime: "19:00",
      timezone: "Australia/Melbourne",
      endsOn: "2026-10-19",
      writer: source,
    });
    expect(source.calls).toEqual([
      "session",
      "series",
      "one",
      "following",
      "edit-series",
    ]);
  });

  it("lets an assistant check in and denies them training management", async () => {
    const source = writer();
    await checkInTraining({
      ...access("ASSISTANT_COACH"),
      clubId,
      teamId,
      eventId,
      writer: source,
    });
    await expect(
      createTrainingSeries({
        ...access("ASSISTANT_COACH"),
        ...series,
        clubId,
        teamId,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      checkInTraining({
        ...access("TEAM_MANAGER"),
        clubId,
        teamId,
        eventId,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(source.calls).toEqual(["check-in"]);
  });

  it("rejects an inverted window, a control character, and a signed-out caller", async () => {
    const source = writer();
    await expect(
      createTrainingSeries({
        ...access("HEAD_COACH"),
        ...series,
        startsOn: "2026-10-19",
        endsOn: "2026-10-12",
        clubId,
        teamId,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createTrainingSession({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        startsAt: "2026-10-14T07:30:00.000Z",
        endsAt: "2026-10-14T07:00:00.000Z",
        courtLabel: "Bad\nCourt",
        leadCoachUserId: null,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      checkInTraining({
        ...access("HEAD_COACH"),
        principal: null,
        clubId,
        teamId,
        eventId: "not-an-id",
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      editTrainingOccurrence({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId: "not-an-id",
        startsAt: "2026-10-14T06:00:00.000Z",
        endsAt: null,
        courtLabel: null,
        leadCoachUserId: null,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      editTrainingFollowing({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId,
        weekday: 0,
        localTime: "20:00",
        timezone: "Australia/Melbourne",
        endsOn: null,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      editTrainingSeries({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        seriesId,
        weekday: 1,
        localTime: "nope",
        timezone: "Australia/Melbourne",
        endsOn: null,
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      checkInTraining({
        ...access("HEAD_COACH"),
        clubId,
        teamId,
        eventId: "not-an-id",
        writer: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(source.calls).toEqual([]);
  });
});
