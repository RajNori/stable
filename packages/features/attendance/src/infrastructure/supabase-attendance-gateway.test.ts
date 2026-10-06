import { describe, expect, it } from "vitest";

import { attendanceMessages } from "../application/attendance-messages.js";
import { createSupabaseAttendanceGateway } from "./supabase-attendance-gateway.js";

const eventId = "55555555-5555-4555-8555-555555555555";
const playerId = "88888888-8888-4888-8888-888888888888";
const responseId = "99999999-9999-4999-8999-999999999999";

function row() {
  return {
    player_id: playerId,
    status: "UNAVAILABLE",
    absence_category: "SICK",
    private_note: "Fever",
  };
}

function client(data: unknown, error: { message: string } | null = null) {
  return {
    rpc() {
      return Promise.resolve({ data, error });
    },
  };
}

const command = {
  eventId,
  playerId,
  status: "UNAVAILABLE" as const,
  absenceCategory: "SICK" as const,
  privateNote: "Fever",
};

describe("attendance gateway", () => {
  it("records a response and lists staff rows", async () => {
    await expect(
      createSupabaseAttendanceGateway(client([responseId])).recordAttendance(
        command,
      ),
    ).resolves.toEqual({ responseId });
    await expect(
      createSupabaseAttendanceGateway(client(responseId)).recordAttendance(
        command,
      ),
    ).resolves.toEqual({ responseId });
    const rows = await createSupabaseAttendanceGateway(
      client([row()]),
    ).listTeamAttendance(eventId);
    expect(rows[0]?.privateNote).toBe("Fever");
    expect(rows[0]?.absenceCategory).toBe("SICK");
  });

  it("maps database failures and malformed rows", async () => {
    const codes = [
      ["28000: UNAUTHENTICATED", "UNAUTHENTICATED"],
      ["42501: FORBIDDEN", "FORBIDDEN"],
      ["P0002: NOT_FOUND", "NOT_FOUND"],
      ["23514: VALIDATION_FAILED", "VALIDATION_FAILED"],
    ] as const;
    for (const [message, code] of codes) {
      await expect(
        createSupabaseAttendanceGateway(
          client(null, { message }),
        ).listTeamAttendance(eventId),
      ).rejects.toMatchObject({ code });
    }
    await expect(
      createSupabaseAttendanceGateway(
        client(null, { message: "P0002: NOT_FOUND extra" }),
      ).recordAttendance(command),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: attendanceMessages.readFailed,
    });
    await expect(
      createSupabaseAttendanceGateway(client(null)).recordAttendance(command),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: attendanceMessages.saveFailed,
    });
    await expect(
      createSupabaseAttendanceGateway(client(null)).listTeamAttendance(eventId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseAttendanceGateway(
        client([{ player_id: playerId }]),
      ).listTeamAttendance(eventId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      createSupabaseAttendanceGateway(
        client([{ ...row(), status: "MAYBE" }]),
      ).listTeamAttendance(eventId),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });
});
