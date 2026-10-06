import { describe, expect, it } from "vitest";

import type { ScheduleQuery } from "../application/schedule-commands.js";
import { scheduleMessages } from "../application/schedule-messages.js";
import { createSupabaseScheduleGateway } from "./supabase-schedule-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "33333333-3333-4333-8333-333333333333";
const eventId = "55555555-5555-4555-8555-555555555555";

const query: ScheduleQuery = {
  clubId,
  teamId,
  rangeStart: "2026-10-01T00:00:00.000Z",
  rangeEnd: "2026-10-31T23:59:59.999Z",
  eventType: null,
};

function row() {
  return {
    event_id: eventId,
    club_id: clubId,
    team_id: teamId,
    event_type: "TRAINING",
    starts_at: "2026-10-11T23:00:00+00:00",
    ends_at: null,
    court_label: null,
    event_status: "SCHEDULED",
    opponent_name: null,
    round_label: null,
  };
}

function client(data: unknown, error: { message: string } | null = null) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      return Promise.resolve({ data, error });
    },
  };
}

describe("schedule gateway", () => {
  it("reads one agenda and normalizes training rows", async () => {
    const db = client([row()]);
    const agenda =
      await createSupabaseScheduleGateway(db).listTeamSchedule(query);
    expect(db.calls[0]?.name).toBe("list_team_schedule");
    expect(db.calls[0]?.args["p_event_type"]).toBeNull();
    expect(agenda[0]).toMatchObject({
      eventType: "TRAINING",
      opponentName: null,
      startsAt: "2026-10-11T23:00:00.000Z",
    });
  });

  it("maps authorization failures and hides driver text", async () => {
    await expect(
      createSupabaseScheduleGateway(
        client(null, { message: "28000: UNAUTHENTICATED" }),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      createSupabaseScheduleGateway(
        client(null, { message: "42501: FORBIDDEN" }),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: scheduleMessages.forbidden,
    });
    await expect(
      createSupabaseScheduleGateway(
        client(null, { message: "P0002: NOT_FOUND" }),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createSupabaseScheduleGateway(
        client(null, { message: "23514: VALIDATION_FAILED" }),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createSupabaseScheduleGateway(client([])).listTeamSchedule(query),
    ).resolves.toEqual([]);
    await expect(
      createSupabaseScheduleGateway(
        client([{ starts_at: 1 }]),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseScheduleGateway(
        client([{ ...row(), starts_at: "not-a-time" }]),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseScheduleGateway(
        client(null, { message: "P0002: NOT_FOUND extra" }),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: scheduleMessages.readFailed,
    });
    await expect(
      createSupabaseScheduleGateway(
        client({ event_id: eventId }),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseScheduleGateway(
        client([{ ...row(), event_status: "ARCHIVED" }]),
      ).listTeamSchedule(query),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
