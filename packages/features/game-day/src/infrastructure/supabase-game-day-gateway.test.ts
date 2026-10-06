import { describe, expect, it } from "vitest";

import { gameDayMessages } from "../application/game-day-messages.js";
import { createSupabaseGameDayGateway } from "./supabase-game-day-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";
const userId = "77777777-7777-4777-8777-777777777777";
const dutyId = "99999999-9999-4999-8999-999999999999";

function row() {
  return {
    event_id: eventId,
    club_id: clubId,
    team_id: teamId,
    opponent_name: "Visitors",
    round_label: "Round 1",
    official_start_at: "2026-10-10T07:30:00+00:00",
    arrival_at: null,
    venue_text: "Home",
    court_label: "Court 1",
    uniform_note: "White",
    coach_focus: "Press",
    own_rsvp: "UNANSWERED",
    own_duty_label: null,
    own_duty_status: null,
    attending_count: null,
    unavailable_count: null,
    unsure_count: null,
    unanswered_count: null,
  };
}

function client(data: unknown, error: { message: string } | null = null) {
  const calls: string[] = [];
  return {
    calls,
    rpc(name: string) {
      calls.push(name);
      return Promise.resolve({ data, error });
    },
  };
}

describe("game day gateway", () => {
  it("reads a projection and assigns a duty", async () => {
    const read = client([row()]);
    const view = await createSupabaseGameDayGateway(read).readGameDay(eventId);
    expect(view.officialStartAt).toBe("2026-10-10T07:30:00.000Z");
    expect(view.ownRsvp).toBe("UNANSWERED");
    expect(view.attendingCount).toBeNull();
    const assigned = client([dutyId]);
    await expect(
      createSupabaseGameDayGateway(assigned).assignGameDuty({
        eventId,
        dutyType: "SCORER",
        label: "Scorebook",
        assignedUserId: userId,
      }),
    ).resolves.toEqual({ dutyId });
    const assignedObject = client(dutyId);
    await expect(
      createSupabaseGameDayGateway(assignedObject).assignGameDuty({
        eventId,
        dutyType: "CLOCK",
        label: "Clock",
        assignedUserId: userId,
      }),
    ).resolves.toEqual({ dutyId });
    const single = client(row());
    const direct =
      await createSupabaseGameDayGateway(single).readGameDay(eventId);
    expect(direct.opponentName).toBe("Visitors");
  });

  it("maps database failures without driver text", async () => {
    const codes = [
      ["28000: UNAUTHENTICATED", "UNAUTHENTICATED"],
      ["42501: FORBIDDEN", "FORBIDDEN"],
      ["P0002: NOT_FOUND", "NOT_FOUND"],
      ["23514: VALIDATION_FAILED", "VALIDATION_FAILED"],
    ] as const;
    for (const [message, code] of codes) {
      await expect(
        createSupabaseGameDayGateway(client(null, { message })).readGameDay(
          eventId,
        ),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      createSupabaseGameDayGateway(
        client(null, { message: "P0001: NOT_FOUND secret" }),
      ).readGameDay(eventId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: gameDayMessages.readFailed,
    });
    await expect(
      createSupabaseGameDayGateway(client([])).readGameDay(eventId),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createSupabaseGameDayGateway(
        client([{ opponent_name: "Visitors" }]),
      ).readGameDay(eventId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseGameDayGateway(
        client([{ ...row(), official_start_at: "not-a-time" }]),
      ).readGameDay(eventId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseGameDayGateway(client(null)).assignGameDuty({
        eventId,
        dutyType: "SCORER",
        label: "Scorebook",
        assignedUserId: userId,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: gameDayMessages.saveFailed,
    });
  });
});
