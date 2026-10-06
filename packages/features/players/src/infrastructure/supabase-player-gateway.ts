import {
  ApplicationError,
  CLUB_MEMBERSHIP_ROLES,
  clubAdultSchema,
  guardianLinkSchema,
  playerImportResultSchema,
  playerSchema,
  type ClubAdult,
  type GuardianLink,
  type MembershipFact,
  type Player,
  type PlayerImportResult,
  type Principal,
} from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";

import {
  PlayerImportValidationError,
  playerMessages,
} from "../application/player-commands.js";
import type {
  PlayerDirectory,
  PlayerWriter,
} from "../application/player-commands.js";

type QueryError = Pick<PostgrestError, "message" | "hint">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type FilterQuery = {
  eq(column: string, value: string): FilterQuery;
  order(column: string, options?: { ascending: boolean }): FilterQuery;
  maybeSingle(): Promise<QueryResult>;
} & PromiseLike<QueryResult>;

type PlayerClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
  from(table: string): {
    select(columns: string): FilterQuery;
  };
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: QueryError | null;
    }>;
  };
};

export type PlayerGateway = {
  directory: PlayerDirectory;
  writer: PlayerWriter;
  listPlayers(clubId: string): Promise<Player[]>;
  listGuardians(playerId: string): Promise<GuardianLink[]>;
  listClubAdults(clubId: string): Promise<ClubAdult[]>;
  readSession(): Promise<{
    principal: Principal | null;
    memberships: MembershipFact[];
  }>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;
const ROW_HINT = /^(?:[1-9]|[1-4]\d|50)(?:,(?:[1-9]|[1-4]\d|50))*$/u;

const PLAYER_COLUMNS = "id, club_id, first_name, last_name, active";
const GUARDIAN_COLUMNS = "id, player_id, user_id, active";
const MEMBERSHIP_COLUMNS = "club_id, role, active";

/**
 * Player reads and audited writes through the caller's session.
 * The client is the user-scoped server client. This adapter never reads a
 * secret key and never forwards database driver text.
 */
export function createSupabasePlayerGateway(client: unknown): PlayerGateway {
  const db = client as PlayerClient;
  return {
    directory: {
      findPlayer(playerId) {
        return loadOptional(
          db,
          "players",
          playerId,
          PLAYER_COLUMNS,
          parsePlayer,
        );
      },
    },
    writer: createWriter(db),
    listPlayers: (clubId) => listPlayers(db, clubId),
    listGuardians: (playerId) => listGuardians(db, playerId),
    listClubAdults: (clubId) => listClubAdults(db, clubId),
    readSession: () => readSession(db),
  };
}

function createWriter(db: PlayerClient): PlayerWriter {
  return {
    async createPlayer(command) {
      const created = await callOperation(db, "create_player", {
        p_club_id: command.clubId,
        p_first_name: command.firstName,
        p_last_name: command.lastName,
      });
      return parsePlayer(created);
    },
    async importPlayers(command) {
      const result = await db.rpc("import_players", {
        p_club_id: command.clubId,
        p_rows: command.rows.map((row) => ({
          first_name: row.firstName,
          last_name: row.lastName,
          source_player_id: row.sourcePlayerId,
        })),
      });
      if (result.error !== null) {
        throwImportFailure(result.error);
      }
      if (!Array.isArray(result.data)) {
        readFailure(playerMessages.saveFailed);
      }
      return result.data.map((row) => parseImportResult(row));
    },
    async updatePlayerIdentity(command) {
      const updated = await callOperation(db, "update_player_identity", {
        p_player_id: command.playerId,
        p_first_name: command.firstName,
        p_last_name: command.lastName,
      });
      return parsePlayer(updated);
    },
    async deactivatePlayer(command) {
      const updated = await callOperation(db, "deactivate_player", {
        p_player_id: command.playerId,
      });
      return parsePlayer(updated);
    },
    async reactivatePlayer(command) {
      const updated = await callOperation(db, "reactivate_player", {
        p_player_id: command.playerId,
      });
      return parsePlayer(updated);
    },
    async linkGuardian(command) {
      const linked = await callOperation(db, "link_player_guardian", {
        p_player_id: command.playerId,
        p_guardian_user_id: command.guardianUserId,
      });
      return parseGuardian(linked);
    },
    async unlinkGuardian(command) {
      const unlinked = await callOperation(db, "unlink_player_guardian", {
        p_player_id: command.playerId,
        p_guardian_user_id: command.guardianUserId,
      });
      return parseGuardian(unlinked);
    },
  };
}

async function listPlayers(
  db: PlayerClient,
  clubId: string,
): Promise<Player[]> {
  const result = await db
    .from("players")
    .select(PLAYER_COLUMNS)
    .eq("club_id", clubId)
    .order("last_name")
    .order("first_name")
    .order("id");
  return readRows(result, parsePlayer);
}

async function listGuardians(
  db: PlayerClient,
  playerId: string,
): Promise<GuardianLink[]> {
  const result = await db
    .from("guardian_relationships")
    .select(GUARDIAN_COLUMNS)
    .eq("player_id", playerId)
    .order("id");
  return readRows(result, parseGuardian);
}

async function listClubAdults(
  db: PlayerClient,
  clubId: string,
): Promise<ClubAdult[]> {
  const result = await db.rpc("list_club_adults", { p_club_id: clubId });
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  if (!Array.isArray(result.data)) {
    readFailure(playerMessages.readFailed);
  }
  return result.data.map((row) => parseAdult(row));
}

async function readSession(db: PlayerClient): Promise<{
  principal: Principal | null;
  memberships: MembershipFact[];
}> {
  const userResult = await db.auth.getUser();
  if (userResult.error !== null) {
    readFailure(playerMessages.readFailed);
  }
  if (userResult.data.user === null) {
    return { principal: null, memberships: [] };
  }

  const userId = userResult.data.user.id;
  const result = await db
    .from("club_memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", userId);
  if (result.error !== null || !Array.isArray(result.data)) {
    readFailure(playerMessages.readFailed);
  }

  return {
    principal: { userId },
    memberships: result.data.map((row) => parseMembership(row)),
  };
}

async function callOperation(
  db: PlayerClient,
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  const row = firstRecord(result.data);
  if (row === null) {
    readFailure(playerMessages.saveFailed);
  }
  return row;
}

function readRows<T>(result: QueryResult, parse: (row: unknown) => T): T[] {
  if (result.error !== null || !Array.isArray(result.data)) {
    readFailure(playerMessages.readFailed);
  }
  return result.data.map((row) => parse(row));
}

async function loadOptional<T>(
  db: PlayerClient,
  table: string,
  id: string,
  columns: string,
  parse: (row: unknown) => T,
): Promise<T | null> {
  const result = await db
    .from(table)
    .select(columns)
    .eq("id", id)
    .maybeSingle();
  if (result.error !== null) {
    readFailure(playerMessages.readFailed);
  }
  if (result.data === null) {
    return null;
  }
  return parse(result.data);
}

function throwImportFailure(error: QueryError): never {
  const match = OPERATION_CODE.exec(error.message.trim());
  if (match?.[1] === "VALIDATION_FAILED") {
    throw new PlayerImportValidationError(rowNumbersFromHint(error.hint));
  }
  throwOperationFailure(error);
}

function rowNumbersFromHint(hint: string | null | undefined): number[] {
  if (hint === undefined || hint === null || !ROW_HINT.test(hint)) {
    return [];
  }
  return hint.split(",").map((part) => Number(part));
}

function throwOperationFailure(error: QueryError): never {
  const match = OPERATION_CODE.exec(error.message.trim());
  const code = match?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      playerMessages.unauthenticated,
    );
  }
  if (code === "FORBIDDEN") {
    throw new ApplicationError("FORBIDDEN", playerMessages.forbidden);
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", playerMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      playerMessages.validationFailed,
    );
  }
  throw new ApplicationError("INTERNAL", playerMessages.saveFailed);
}

function parsePlayer(row: unknown): Player {
  if (!isRecord(row)) {
    readFailure(playerMessages.saveFailed);
  }
  return parseRow(playerSchema, {
    id: row.id,
    clubId: row.club_id,
    firstName: row.first_name,
    lastName: row.last_name,
    active: row.active,
  });
}

function parseGuardian(row: unknown): GuardianLink {
  if (!isRecord(row)) {
    readFailure(playerMessages.saveFailed);
  }
  return parseRow(guardianLinkSchema, {
    id: row.id,
    playerId: row.player_id,
    guardianUserId: row.user_id,
    active: row.active,
  });
}

function parseAdult(row: unknown): ClubAdult {
  if (!isRecord(row)) {
    readFailure(playerMessages.readFailed);
  }
  return parseRow(clubAdultSchema, {
    userId: row.user_id,
    displayName: row.display_name,
  });
}

function parseImportResult(row: unknown): PlayerImportResult {
  if (!isRecord(row)) {
    readFailure(playerMessages.saveFailed);
  }
  return parseRow(playerImportResultSchema, {
    sourcePlayerId: row.source_player_id,
    playerId: row.player_id,
    status: row.status,
  });
}

function parseRow<T>(
  schema: {
    safeParse(value: unknown): { success: true; data: T } | { success: false };
  },
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    readFailure(playerMessages.saveFailed);
  }
  return parsed.data;
}

function parseMembership(row: unknown): MembershipFact {
  if (!isRecord(row)) {
    readFailure(playerMessages.readFailed);
  }
  const clubId = row.club_id;
  const role = row.role;
  const active = row.active;
  if (
    typeof clubId !== "string" ||
    typeof role !== "string" ||
    typeof active !== "boolean" ||
    !isClubRole(role)
  ) {
    readFailure(playerMessages.readFailed);
  }
  return { clubId, role, active };
}

function isClubRole(role: string): role is MembershipFact["role"] {
  return CLUB_MEMBERSHIP_ROLES.some((known) => known === role);
}

function firstRecord(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) {
    const first: unknown = data[0];
    return isRecord(first) ? first : null;
  }
  return isRecord(data) ? data : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readFailure(message: string): never {
  throw new ApplicationError("INTERNAL", message);
}
