import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import {
  scheduleEntrySchema,
  type ScheduleEntry,
  type ScheduleQuery,
  type ScheduleReader,
} from "../application/schedule-commands.js";
import { scheduleMessages } from "../application/schedule-messages.js";

type QueryError = Pick<PostgrestError, "message">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type ScheduleClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;

const rowSchema = z
  .strictObject({
    event_id: z.string().uuid(),
    club_id: z.string().uuid(),
    team_id: z.string().uuid(),
    event_type: z.string(),
    starts_at: z.string(),
    ends_at: z.string().nullable(),
    court_label: z.string().nullable(),
    event_status: z.string(),
    opponent_name: z.string().nullable(),
    round_label: z.string().nullable(),
  })
  .transform((row) => ({
    eventId: row.event_id,
    clubId: row.club_id,
    teamId: row.team_id,
    eventType: row.event_type,
    startsAt: asInstant(row.starts_at),
    endsAt: asInstant(row.ends_at),
    courtLabel: row.court_label,
    eventStatus: row.event_status,
    opponentName: row.opponent_name,
    roundLabel: row.round_label,
  }));

export type ScheduleGateway = ScheduleReader;

export function createSupabaseScheduleGateway(
  client: unknown,
): ScheduleGateway {
  const db = client as ScheduleClient;
  return {
    listTeamSchedule: (query) => listTeamSchedule(db, query),
  };
}

async function listTeamSchedule(
  db: ScheduleClient,
  query: ScheduleQuery,
): Promise<ScheduleEntry[]> {
  const result = await db.rpc("list_team_schedule", {
    p_team_id: query.teamId,
    p_range_start: query.rangeStart,
    p_range_end: query.rangeEnd,
    p_event_type: query.eventType,
  });
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  if (!Array.isArray(result.data)) {
    throw new ApplicationError("INTERNAL", scheduleMessages.readFailed);
  }
  return result.data.map((row) => {
    const mapped = rowSchema.safeParse(row);
    if (!mapped.success) {
      throw new ApplicationError("INTERNAL", scheduleMessages.readFailed);
    }
    const parsed = scheduleEntrySchema.safeParse(mapped.data);
    if (!parsed.success) {
      throw new ApplicationError("INTERNAL", scheduleMessages.readFailed);
    }
    return parsed.data;
  });
}

function asInstant(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString();
}

function throwOperationFailure(error: QueryError): never {
  const code = OPERATION_CODE.exec(error.message)?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      scheduleMessages.unauthenticated,
    );
  }
  if (code === "FORBIDDEN") {
    throw new ApplicationError("FORBIDDEN", scheduleMessages.forbidden);
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", scheduleMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      scheduleMessages.validationFailed,
    );
  }
  throw new ApplicationError("INTERNAL", scheduleMessages.readFailed);
}
