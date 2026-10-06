import { describe, expect, it } from "vitest";

import { trainingMessages } from "../application/training-messages.js";
import { createSupabaseTrainingGateway } from "./supabase-training-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";
const seriesId = "99999999-9999-4999-8999-999999999999";

function client(data: unknown, error: { message: string } | null = null) {
  return {
    rpc() {
      return Promise.resolve({ data, error });
    },
  };
}

describe("training gateway", () => {
  it("writes sessions, series edits, and check-in", async () => {
    const gateway = createSupabaseTrainingGateway(client(eventId));
    await expect(
      gateway.createTrainingSession({
        clubId,
        teamId,
        startsAt: "2026-10-14T07:30:00.000Z",
        endsAt: null,
        courtLabel: null,
        leadCoachUserId: null,
      }),
    ).resolves.toEqual({ eventId });
    await expect(
      gateway.createTrainingSeries({
        clubId,
        teamId,
        weekday: 1,
        localTime: "18:30",
        timezone: "Australia/Melbourne",
        startsOn: "2026-10-12",
        endsOn: null,
        courtLabel: null,
        leadCoachUserId: null,
      }),
    ).resolves.toEqual({ seriesId: eventId });
    await expect(
      gateway.editTrainingOccurrence({
        eventId,
        startsAt: "2026-10-14T06:00:00.000Z",
        endsAt: null,
        courtLabel: null,
        leadCoachUserId: null,
      }),
    ).resolves.toEqual({ eventId });
    const listed = createSupabaseTrainingGateway(client([seriesId]));
    await expect(
      listed.editTrainingFollowing({
        eventId,
        weekday: 1,
        localTime: "20:00",
        timezone: "Australia/Melbourne",
        endsOn: null,
      }),
    ).resolves.toEqual({ seriesId });
    await expect(
      listed.editTrainingSeries({
        seriesId,
        weekday: 1,
        localTime: "19:00",
        timezone: "Australia/Melbourne",
        endsOn: "2026-10-19",
      }),
    ).resolves.toEqual({ seriesId });
    await expect(listed.checkInTraining(eventId)).resolves.toBeUndefined();
  });

  it("maps database failures", async () => {
    const codes = [
      ["28000: UNAUTHENTICATED", "UNAUTHENTICATED"],
      ["42501: FORBIDDEN", "FORBIDDEN"],
      ["P0002: NOT_FOUND", "NOT_FOUND"],
      ["23514: VALIDATION_FAILED", "VALIDATION_FAILED"],
      ["P0001: CONFLICT", "CONFLICT"],
    ] as const;
    for (const [message, code] of codes) {
      await expect(
        createSupabaseTrainingGateway(
          client(null, { message }),
        ).checkInTraining(eventId),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      createSupabaseTrainingGateway(
        client(null, { message: "P0001: CONFLICT extra" }),
      ).checkInTraining(eventId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: trainingMessages.readFailed,
    });
    await expect(
      createSupabaseTrainingGateway(client(null)).createTrainingSession({
        clubId,
        teamId,
        startsAt: "2026-10-14T07:30:00.000Z",
        endsAt: null,
        courtLabel: null,
        leadCoachUserId: null,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: trainingMessages.saveFailed,
    });
  });
});
