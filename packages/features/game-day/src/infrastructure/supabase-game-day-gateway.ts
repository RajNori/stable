import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type { DutyAllocationWriter } from "../application/duty-commands.js";
import type {
  DutySwapRecord,
  DutySwapWriter,
} from "../application/duty-swap-commands.js";
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
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

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

const allocationInputSchema = z.strictObject({
  duties: z.array(
    z.strictObject({
      dutyId: z.string().uuid(),
      dutyType: z.enum(["SCORER", "CLOCK", "CANTEEN", "OTHER"]),
      label: z.string(),
    }),
  ),
  candidates: z.array(
    z.strictObject({
      userId: z.string().uuid(),
      priorCount: z.number().int().min(0),
    }),
  ),
});

const swapRowSchema = z.strictObject({
  id: z.string().uuid(),
  label: z.string(),
  requester_user_id: z.string().uuid(),
  target_user_id: z.string().uuid().nullable(),
});

export type GameDayGateway = GameDayReader &
  DutyAllocationWriter &
  DutySwapWriter;

export function createSupabaseGameDayGateway(client: unknown): GameDayGateway {
  const db = client as GameDayClient;
  return {
    readGameDay: (eventId) => readGameDay(db, eventId),
    assignGameDuty: (command) => assignGameDuty(db, command),
    createOpenDuty: (input) => createOpenDuty(db, input),
    listDutyAllocationInputs: (eventId) => listDutyInputs(db, eventId),
    commitDutyAllocation: (eventId, fingerprint) =>
      commitDutyAllocation(db, eventId, fingerprint),
    acknowledgeOwnDuty: (eventId) => acknowledgeOwnDuty(db, eventId),
    requestDutySwap: (eventId, targetUserId) =>
      requestDutySwap(db, eventId, targetUserId),
    acceptDutySwap: (requestId) => acceptDutySwap(db, requestId),
    cancelDutySwap: (requestId) => cancelDutySwap(db, requestId),
    enqueueDutySwapAccepted: (requestId) =>
      enqueueDutySwapAccepted(db, requestId),
    listOpenDutySwaps: (eventId) => listOpenDutySwaps(db, eventId),
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

async function createOpenDuty(
  db: GameDayClient,
  input: {
    eventId: string;
    dutyType: "SCORER" | "CLOCK" | "CANTEEN" | "OTHER";
    label: string;
  },
): Promise<{ dutyId: string }> {
  const data = await call(db, "create_open_game_duty", {
    p_event_id: input.eventId,
    p_duty_type: input.dutyType,
    p_label: input.label,
  });
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.saveFailed);
  }
  return { dutyId: parsed.data };
}

async function listDutyInputs(
  db: GameDayClient,
  eventId: string,
): Promise<z.infer<typeof allocationInputSchema>> {
  const data = await call(db, "list_duty_allocation_inputs", {
    p_event_id: eventId,
  });
  const parsed = allocationInputSchema.safeParse(data);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.readFailed);
  }
  return parsed.data;
}

async function commitDutyAllocation(
  db: GameDayClient,
  eventId: string,
  fingerprint: string,
): Promise<void> {
  await call(db, "commit_duty_allocation", {
    p_event_id: eventId,
    p_fingerprint: fingerprint,
  });
}

async function acknowledgeOwnDuty(
  db: GameDayClient,
  eventId: string,
): Promise<number> {
  const data = await call(db, "acknowledge_own_game_duty", {
    p_event_id: eventId,
  });
  const parsed = z.number().int().nonnegative().safeParse(data);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.saveFailed);
  }
  return parsed.data;
}

async function requestDutySwap(
  db: GameDayClient,
  eventId: string,
  targetUserId: string | null,
): Promise<{ requestId: string }> {
  const data = await call(db, "request_duty_swap", {
    p_event_id: eventId,
    p_target_user_id: targetUserId,
  });
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.saveFailed);
  }
  return { requestId: parsed.data };
}

async function acceptDutySwap(
  db: GameDayClient,
  requestId: string,
): Promise<{ requestId: string }> {
  const data = await call(db, "accept_duty_swap", { p_request_id: requestId });
  const value = Array.isArray(data) ? data[0] : data;
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.saveFailed);
  }
  return { requestId: parsed.data };
}

async function cancelDutySwap(
  db: GameDayClient,
  requestId: string,
): Promise<void> {
  await call(db, "cancel_duty_swap", { p_request_id: requestId });
}

async function enqueueDutySwapAccepted(
  db: GameDayClient,
  requestId: string,
): Promise<void> {
  await call(db, "enqueue_duty_swap_accepted", { p_request_id: requestId });
}

async function listOpenDutySwaps(
  db: GameDayClient,
  eventId: string,
): Promise<DutySwapRecord[]> {
  const data = await call(db, "list_open_duty_swaps", { p_event_id: eventId });
  const parsed = z.array(swapRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.readFailed);
  }
  return parsed.data.map((row) => ({
    id: row.id,
    label: row.label,
    requesterUserId: row.requester_user_id,
    targetUserId: row.target_user_id,
  }));
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
    if (code === "CONFLICT") {
      throw new ApplicationError("CONFLICT", gameDayMessages.conflict);
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
