import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import {
  teamAttendanceSchema,
  type AttendanceWriter,
  type RecordAttendance,
  type TeamAttendance,
} from "../application/attendance-commands.js";
import { attendanceMessages } from "../application/attendance-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type AttendanceClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;

const rowSchema = z
  .strictObject({
    player_id: z.string().uuid(),
    status: z.string(),
    absence_category: z.string().nullable(),
    private_note: z.string().nullable(),
  })
  .transform((row) => ({
    playerId: row.player_id,
    status: row.status,
    absenceCategory: row.absence_category,
    privateNote: row.private_note,
  }));

export type AttendanceGateway = AttendanceWriter;

export function createSupabaseAttendanceGateway(
  client: unknown,
): AttendanceGateway {
  const db = client as AttendanceClient;
  return {
    recordAttendance: (command) => recordAttendance(db, command),
    listTeamAttendance: (eventId) => listTeamAttendance(db, eventId),
  };
}

async function recordAttendance(
  db: AttendanceClient,
  command: RecordAttendance,
): Promise<{ responseId: string }> {
  const data = await call(db, "record_attendance", {
    p_event_id: command.eventId,
    p_player_id: command.playerId,
    p_status: command.status,
    p_absence_category: command.absenceCategory,
    p_private_note: command.privateNote,
  });
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", attendanceMessages.saveFailed);
  }
  return { responseId: parsed.data };
}

async function listTeamAttendance(
  db: AttendanceClient,
  eventId: string,
): Promise<readonly TeamAttendance[]> {
  const data = await call(db, "list_team_attendance", { p_event_id: eventId });
  if (!Array.isArray(data)) {
    throw new ApplicationError("INTERNAL", attendanceMessages.readFailed);
  }
  return data.map((row) => {
    const mapped = rowSchema.safeParse(row);
    if (!mapped.success) {
      throw new ApplicationError("INTERNAL", attendanceMessages.readFailed);
    }
    const parsed = teamAttendanceSchema.safeParse(mapped.data);
    if (!parsed.success) {
      throw new ApplicationError("INTERNAL", attendanceMessages.readFailed);
    }
    return parsed.data;
  });
}

async function call(
  db: AttendanceClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = OPERATION_CODE.exec(result.error.message)?.[1];
    if (code === "UNAUTHENTICATED") {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        attendanceMessages.unauthenticated,
      );
    }
    if (code === "FORBIDDEN") {
      throw new ApplicationError("FORBIDDEN", attendanceMessages.forbidden);
    }
    if (code === "NOT_FOUND") {
      throw new ApplicationError("NOT_FOUND", attendanceMessages.notFound);
    }
    if (code === "VALIDATION_FAILED") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        attendanceMessages.validationFailed,
      );
    }
    throw new ApplicationError("INTERNAL", attendanceMessages.readFailed);
  }
  return result.data;
}
