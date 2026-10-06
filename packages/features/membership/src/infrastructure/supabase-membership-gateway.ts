import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";

import {
  membershipMessages,
  playerTeamRegistrationSchema,
  teamStaffAssignmentSchema,
} from "../application/membership-commands.js";
import type {
  AssignTeamRoleCommand,
  MembershipWriter,
  PlayerTeamRegistration,
  RegisterPlayerCommand,
  TeamRoleCommand,
  TeamStaffAssignment,
  UnregisterPlayerCommand,
} from "../application/membership-commands.js";

type QueryError = Pick<PostgrestError, "message">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type FilterQuery = {
  eq(column: string, value: string | boolean): FilterQuery;
} & PromiseLike<QueryResult>;

type MembershipClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
  from(table: string): {
    select(columns: string): FilterQuery;
  };
};

export type MembershipGateway = MembershipWriter & {
  listTeamStaff(teamId: string): Promise<TeamStaffAssignment[]>;
  listRegistrations(clubId: string): Promise<PlayerTeamRegistration[]>;
};

const STAFF_COLUMNS = "id, club_id, team_id, user_id, role, active";
const REGISTRATION_COLUMNS = "id, club_id, team_id, player_id, active";
const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED)$/;

export function createSupabaseMembershipGateway(
  client: unknown,
): MembershipGateway {
  const db = client as MembershipClient;
  return {
    assignTeamRole: (command) =>
      callStaff(db, "assign_team_role", {
        p_team_id: command.teamId,
        p_user_id: command.userId,
        p_role: command.role,
      }),
    revokeTeamRole: (command) =>
      callStaff(db, "revoke_team_role", {
        p_team_id: command.teamId,
        p_user_id: command.userId,
        p_role: command.role,
      }),
    reactivateTeamRole: (command) =>
      callStaff(db, "reactivate_team_role", {
        p_team_id: command.teamId,
        p_user_id: command.userId,
        p_role: command.role,
      }),
    registerPlayer: (command) =>
      callRegistration(db, "register_player_on_team", {
        p_player_id: command.playerId,
        p_team_id: command.teamId,
      }),
    unregisterPlayer: (command) =>
      callRegistration(db, "unregister_player_from_team", {
        p_player_id: command.playerId,
      }),
    listTeamStaff: (teamId) => listStaff(db, teamId),
    listRegistrations: (clubId) => listRegistrations(db, clubId),
  };
}

async function callStaff(
  db: MembershipClient,
  name: string,
  args: Record<string, unknown>,
): Promise<TeamStaffAssignment> {
  return parseStaff(await callOperation(db, name, args));
}

async function callRegistration(
  db: MembershipClient,
  name: string,
  args: Record<string, unknown>,
): Promise<PlayerTeamRegistration> {
  return parseRegistration(await callOperation(db, name, args));
}

async function callOperation(
  db: MembershipClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  return result.data;
}

async function listStaff(
  db: MembershipClient,
  teamId: string,
): Promise<TeamStaffAssignment[]> {
  const result = await db
    .from("team_memberships")
    .select(STAFF_COLUMNS)
    .eq("team_id", teamId);
  return readRows(result, parseStaff);
}

async function listRegistrations(
  db: MembershipClient,
  clubId: string,
): Promise<PlayerTeamRegistration[]> {
  const result = await db
    .from("player_team_registrations")
    .select(REGISTRATION_COLUMNS)
    .eq("club_id", clubId);
  return readRows(result, parseRegistration);
}

function readRows<T>(result: QueryResult, parse: (row: unknown) => T): T[] {
  if (result.error !== null || !Array.isArray(result.data)) {
    throw new ApplicationError("INTERNAL", membershipMessages.readFailed);
  }
  return result.data.map((row) => parse(row));
}

function throwOperationFailure(error: QueryError): never {
  const match = OPERATION_CODE.exec(error.message);
  const code = match?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      membershipMessages.unauthenticated,
    );
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", membershipMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      membershipMessages.validationFailed,
    );
  }
  throw new ApplicationError("INTERNAL", membershipMessages.saveFailed);
}

function parseStaff(row: unknown): TeamStaffAssignment {
  if (!isRecord(row)) {
    throw new ApplicationError("INTERNAL", membershipMessages.saveFailed);
  }
  const parsed = teamStaffAssignmentSchema.safeParse({
    id: row.id,
    clubId: row.club_id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    active: row.active,
  });
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", membershipMessages.saveFailed);
  }
  return parsed.data;
}

function parseRegistration(row: unknown): PlayerTeamRegistration {
  if (!isRecord(row)) {
    throw new ApplicationError("INTERNAL", membershipMessages.saveFailed);
  }
  const parsed = playerTeamRegistrationSchema.safeParse({
    id: row.id,
    clubId: row.club_id,
    teamId: row.team_id,
    playerId: row.player_id,
    active: row.active,
  });
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", membershipMessages.saveFailed);
  }
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type {
  AssignTeamRoleCommand,
  RegisterPlayerCommand,
  TeamRoleCommand,
  UnregisterPlayerCommand,
};
