import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";

import {
  rosterEntrySchema,
  rosterMessages,
} from "../application/roster-commands.js";
import type {
  RosterEntry,
  RosterReader,
  RosterWriter,
} from "../application/roster-commands.js";

type QueryError = Pick<PostgrestError, "message">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type RosterClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

export type RosterGateway = RosterReader & RosterWriter;

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;

export function createSupabaseRosterGateway(client: unknown): RosterGateway {
  const db = client as RosterClient;
  return {
    listMasked: (teamId) => listRoster(db, "list_team_roster_masked", teamId),
    listFull: (teamId) => listRoster(db, "list_team_roster_full", teamId),
    registerPlayer: (playerId, teamId) =>
      callMutation(db, "register_player_on_team", {
        p_player_id: playerId,
        p_team_id: teamId,
      }),
    unregisterPlayer: (playerId) =>
      callMutation(db, "unregister_player_from_team", {
        p_player_id: playerId,
      }),
  };
}

async function listRoster(
  db: RosterClient,
  name: "list_team_roster_masked" | "list_team_roster_full",
  teamId: string,
): Promise<RosterEntry[]> {
  const data = await callOperation(db, name, { p_team_id: teamId });
  if (!Array.isArray(data)) {
    throw new ApplicationError("INTERNAL", rosterMessages.readFailed);
  }
  return data.map((row) => parseEntry(row, name));
}

async function callMutation(
  db: RosterClient,
  name: string,
  args: Record<string, unknown>,
): Promise<void> {
  await callOperation(db, name, args);
}

async function callOperation(
  db: RosterClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  return result.data;
}

function throwOperationFailure(error: QueryError): never {
  const match = OPERATION_CODE.exec(error.message);
  const code = match?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      rosterMessages.unauthenticated,
    );
  }
  if (code === "FORBIDDEN") {
    throw new ApplicationError("FORBIDDEN", rosterMessages.forbidden);
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", rosterMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      rosterMessages.validationFailed,
    );
  }
  throw new ApplicationError("INTERNAL", rosterMessages.readFailed);
}

function parseEntry(row: unknown, source: string): RosterEntry {
  if (!isRecord(row)) {
    throw new ApplicationError("INTERNAL", rosterMessages.readFailed);
  }
  const name =
    source === "list_team_roster_masked"
      ? row.display_name
      : row.registered_name;
  const parsed = rosterEntrySchema.safeParse({
    playerId: row.player_id,
    teamId: row.team_id,
    name,
  });
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", rosterMessages.readFailed);
  }
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
