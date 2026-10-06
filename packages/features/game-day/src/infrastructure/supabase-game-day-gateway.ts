import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import {
  gameDayProjectionSchema,
  type AssignDuty,
  type GameDayProjection,
  type GameDayReader,
} from "../application/game-day-commands.js";
import { gameDayMessages } from "../application/game-day-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type GameDayClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;

const rowSchema = z
  .strictObject({
    event_id: z.string().uuid(),
    club_id: z.string().uuid(),
    team_id: z.string().uuid(),
    opponent_name: z.string(),
    round_label: z.string().nullable(),
    official_start_at: z.string(),
    arrival_at: z.string().nullable(),
    venue_text: z.string().nullable(),
    court_label: z.string().nullable(),
    uniform_note: z.string().nullable(),
    coach_focus: z.string().nullable(),
    own_rsvp: z.string(),
    own_duty_label: z.string().nullable(),
    own_duty_status: z.string().nullable(),
    attending_count: z.number().nullable(),
    unavailable_count: z.number().nullable(),
    unsure_count: z.number().nullable(),
    unanswered_count: z.number().nullable(),
  })
  .transform((row) => ({
    eventId: row.event_id,
    clubId: row.club_id,
    teamId: row.team_id,
    opponentName: row.opponent_name,
    roundLabel: row.round_label,
    officialStartAt: asInstant(row.official_start_at),
    arrivalAt: asInstant(row.arrival_at),
    venueText: row.venue_text,
    courtLabel: row.court_label,
    uniformNote: row.uniform_note,
    coachFocus: row.coach_focus,
    ownRsvp: row.own_rsvp,
    ownDutyLabel: row.own_duty_label,
    ownDutyStatus: row.own_duty_status,
    attendingCount: row.attending_count,
    unavailableCount: row.unavailable_count,
    unsureCount: row.unsure_count,
    unansweredCount: row.unanswered_count,
  }));

export type GameDayGateway = GameDayReader;

export function createSupabaseGameDayGateway(client: unknown): GameDayGateway {
  const db = client as GameDayClient;
  return {
    readGameDay: (eventId) => readGameDay(db, eventId),
    assignGameDuty: (command) => assignGameDuty(db, command),
  };
}

async function readGameDay(
  db: GameDayClient,
  eventId: string,
): Promise<GameDayProjection> {
  const data = await call(db, "read_game_day", { p_event_id: eventId });
  const row = Array.isArray(data) ? data[0] : data;
  if (row === undefined || row === null) {
    throw new ApplicationError("NOT_FOUND", gameDayMessages.notFound);
  }
  const mapped = rowSchema.safeParse(row);
  if (!mapped.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.readFailed);
  }
  const parsed = gameDayProjectionSchema.safeParse(mapped.data);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.readFailed);
  }
  return parsed.data;
}

async function assignGameDuty(
  db: GameDayClient,
  command: AssignDuty,
): Promise<{ dutyId: string }> {
  const data = await call(db, "assign_game_duty", {
    p_event_id: command.eventId,
    p_duty_type: command.dutyType,
    p_label: command.label,
    p_assigned_user_id: command.assignedUserId,
  });
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.saveFailed);
  }
  return { dutyId: parsed.data };
}

async function call(
  db: GameDayClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = OPERATION_CODE.exec(result.error.message)?.[1];
    if (code === "UNAUTHENTICATED") {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        gameDayMessages.unauthenticated,
      );
    }
    if (code === "FORBIDDEN") {
      throw new ApplicationError("FORBIDDEN", gameDayMessages.forbidden);
    }
    if (code === "NOT_FOUND") {
      throw new ApplicationError("NOT_FOUND", gameDayMessages.notFound);
    }
    if (code === "VALIDATION_FAILED") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        gameDayMessages.validationFailed,
      );
    }
    throw new ApplicationError("INTERNAL", gameDayMessages.readFailed);
  }
  return result.data;
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
