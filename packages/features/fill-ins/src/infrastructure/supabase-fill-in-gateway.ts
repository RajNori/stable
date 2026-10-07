import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  FillInCandidate,
  FillInRequest,
  FillInWriter,
} from "../application/fill-in-commands.js";
import { fillInMessages } from "../application/fill-in-messages.js";

type QueryError = Pick<PostgrestError, "message">;
type QueryResult = { data: unknown; error: QueryError | null };
type FillInClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|CONFLICT)$/;

const candidateSchema = z.strictObject({
  player_id: z.string().uuid(),
  display_name: z.string(),
});

const requestSchema = z.strictObject({
  id: z.string().uuid(),
  status: z.string(),
});

export type FillInGateway = FillInWriter;

export function createSupabaseFillInGateway(client: unknown): FillInGateway {
  const db = client as FillInClient;
  return {
    requestFillIn: (eventId) => request(db, eventId),
    respondFillIn: (requestId, playerId) => respond(db, requestId, playerId),
    confirmFillIn: (requestId, playerId) => confirm(db, requestId, playerId),
    listFillInCandidates: (teamId) => candidates(db, teamId),
    listEventFillIn: (eventId) => eventFillIn(db, eventId),
    listFillInResponses: (requestId) => responses(db, requestId),
    listGuardianFillInPlayers: (teamId) => guardianPlayers(db, teamId),
    enqueueFillInRequested: (requestId) =>
      enqueue(db, "enqueue_fill_in_requested", requestId),
    enqueueFillInConfirmed: (requestId) =>
      enqueue(db, "enqueue_fill_in_confirmed", requestId),
  };
}

async function request(
  db: FillInClient,
  eventId: string,
): Promise<{ requestId: string }> {
  return {
    requestId: uuid(
      await call(db, "request_fill_in", { p_event_id: eventId }),
      fillInMessages.saveFailed,
    ),
  };
}

async function respond(
  db: FillInClient,
  requestId: string,
  playerId: string,
): Promise<{ responseId: string }> {
  return {
    responseId: uuid(
      await call(db, "respond_fill_in", {
        p_request_id: requestId,
        p_player_id: playerId,
      }),
      fillInMessages.saveFailed,
    ),
  };
}

async function confirm(
  db: FillInClient,
  requestId: string,
  playerId: string,
): Promise<{ confirmationId: string }> {
  return {
    confirmationId: uuid(
      await call(db, "confirm_fill_in", {
        p_request_id: requestId,
        p_player_id: playerId,
      }),
      fillInMessages.saveFailed,
    ),
  };
}

async function candidates(
  db: FillInClient,
  teamId: string,
): Promise<FillInCandidate[]> {
  return people(
    await call(db, "list_fill_in_candidates", { p_team_id: teamId }),
  );
}

async function responses(
  db: FillInClient,
  requestId: string,
): Promise<FillInCandidate[]> {
  return people(
    await call(db, "list_fill_in_responses", { p_request_id: requestId }),
  );
}

async function guardianPlayers(
  db: FillInClient,
  teamId: string,
): Promise<FillInCandidate[]> {
  return people(
    await call(db, "list_guardian_fill_in_players", { p_team_id: teamId }),
  );
}

async function eventFillIn(
  db: FillInClient,
  eventId: string,
): Promise<FillInRequest | null> {
  const data = await call(db, "list_event_fill_in", { p_event_id: eventId });
  const rows = z.array(requestSchema).safeParse(data ?? []);
  if (!rows.success) {
    throw new ApplicationError("INTERNAL", fillInMessages.readFailed);
  }
  const row = rows.data[0];
  if (row === undefined) {
    return null;
  }
  return { id: row.id, status: row.status };
}

async function enqueue(
  db: FillInClient,
  name: "enqueue_fill_in_requested" | "enqueue_fill_in_confirmed",
  requestId: string,
): Promise<void> {
  await call(db, name, { p_request_id: requestId });
}

function people(data: unknown): FillInCandidate[] {
  const rows = z.array(candidateSchema).safeParse(data ?? []);
  if (!rows.success) {
    throw new ApplicationError("INTERNAL", fillInMessages.readFailed);
  }
  return rows.data.map((row) => ({
    playerId: row.player_id,
    displayName: row.display_name,
  }));
}

function uuid(value: unknown, message: string): string {
  const parsed = z.string().uuid().safeParse(value);
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", message);
  }
  return parsed.data;
}

async function call(
  db: FillInClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    const code = OPERATION_CODE.exec(result.error.message)?.[1];
    if (code === "UNAUTHENTICATED") {
      throw new ApplicationError(
        "UNAUTHENTICATED",
        fillInMessages.unauthenticated,
      );
    }
    if (code === "FORBIDDEN") {
      throw new ApplicationError("FORBIDDEN", fillInMessages.forbidden);
    }
    if (code === "NOT_FOUND") {
      throw new ApplicationError("NOT_FOUND", fillInMessages.notFound);
    }
    if (code === "VALIDATION_FAILED") {
      throw new ApplicationError(
        "VALIDATION_FAILED",
        fillInMessages.validationFailed,
      );
    }
    if (code === "CONFLICT") {
      throw new ApplicationError("CONFLICT", fillInMessages.conflict);
    }
    throw new ApplicationError("INTERNAL", fillInMessages.readFailed);
  }
  return result.data;
}
