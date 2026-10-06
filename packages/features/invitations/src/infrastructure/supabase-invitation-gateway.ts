import { ApplicationError } from "@stable/contracts";
import type { PostgrestError } from "@supabase/supabase-js";

import {
  acceptedInvitationSchema,
  createdInvitationSchema,
  invitationMessages,
  invitationRecordSchema,
} from "../application/invitation-commands.js";
import type {
  AcceptedInvitation,
  CreateInvitationCommand,
  CreatedInvitation,
  InvitationRecord,
  InvitationWriter,
} from "../application/invitation-commands.js";

type QueryError = Pick<PostgrestError, "message">;

type QueryResult = {
  data: unknown;
  error: QueryError | null;
};

type InvitationClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<QueryResult>;
};

const OPERATION_CODE =
  /^(?:[0-9A-Z]{5}:\s*)?(UNAUTHENTICATED|FORBIDDEN|NOT_FOUND|VALIDATION_FAILED|ALREADY_CONSUMED|IDENTITY_MISMATCH|EXPIRED|REVOKED)$/;

export type InvitationGateway = InvitationWriter;

export function createSupabaseInvitationGateway(
  client: unknown,
): InvitationGateway {
  const db = client as InvitationClient;
  return {
    createInvitation: (command) => createInvitation(db, command),
    revokeInvitation: (invitationId) => revokeInvitation(db, invitationId),
    acceptInvitation: (token) => acceptInvitation(db, token),
    listInvitations: (clubId) => listInvitations(db, clubId),
  };
}

async function createInvitation(
  db: InvitationClient,
  command: CreateInvitationCommand,
): Promise<CreatedInvitation> {
  const row = firstRow(
    await callOperation(db, "create_invitation", {
      p_club_id: command.clubId,
      p_invite_type: command.inviteType,
      p_team_id: command.teamId,
      p_player_id: command.playerId,
      p_intended_email: command.intendedEmail,
      p_intended_phone: command.intendedPhone,
    }),
  );
  return parseCreated(row);
}

async function revokeInvitation(
  db: InvitationClient,
  invitationId: string,
): Promise<void> {
  await callOperation(db, "revoke_invitation", {
    p_invitation_id: invitationId,
  });
}

async function acceptInvitation(
  db: InvitationClient,
  token: string,
): Promise<AcceptedInvitation> {
  const row = firstRow(
    await callOperation(db, "accept_invitation", { p_token: token }),
  );
  return parseAccepted(row);
}

async function listInvitations(
  db: InvitationClient,
  clubId: string,
): Promise<InvitationRecord[]> {
  const data = await callOperation(db, "list_club_invitations", {
    p_club_id: clubId,
  });
  if (!Array.isArray(data)) {
    throw new ApplicationError("INTERNAL", invitationMessages.readFailed);
  }
  return data.map((row) => parseRecord(row));
}

async function callOperation(
  db: InvitationClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const result = await db.rpc(name, args);
  if (result.error !== null) {
    throwOperationFailure(result.error);
  }
  return result.data;
}

function firstRow(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data;
}

function throwOperationFailure(error: QueryError): never {
  const match = OPERATION_CODE.exec(error.message);
  const code = match?.[1];
  if (code === "UNAUTHENTICATED") {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      invitationMessages.unauthenticated,
    );
  }
  if (code === "FORBIDDEN") {
    throw new ApplicationError("FORBIDDEN", invitationMessages.forbidden);
  }
  if (code === "NOT_FOUND") {
    throw new ApplicationError("NOT_FOUND", invitationMessages.notFound);
  }
  if (code === "VALIDATION_FAILED") {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      invitationMessages.validationFailed,
    );
  }
  if (code === "ALREADY_CONSUMED") {
    throw new ApplicationError("CONFLICT", invitationMessages.alreadyConsumed);
  }
  if (code === "IDENTITY_MISMATCH") {
    throw new ApplicationError(
      "FORBIDDEN",
      invitationMessages.identityMismatch,
    );
  }
  if (code === "EXPIRED") {
    throw new ApplicationError("VALIDATION_FAILED", invitationMessages.expired);
  }
  if (code === "REVOKED") {
    throw new ApplicationError("VALIDATION_FAILED", invitationMessages.revoked);
  }
  throw new ApplicationError("INTERNAL", invitationMessages.saveFailed);
}

function parseCreated(row: unknown): CreatedInvitation {
  if (!isRecord(row)) {
    throw new ApplicationError("INTERNAL", invitationMessages.saveFailed);
  }
  const parsed = createdInvitationSchema.safeParse({
    id: row.id,
    token: row.token,
    expiresAt: row.expires_at,
  });
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", invitationMessages.saveFailed);
  }
  return parsed.data;
}

function parseAccepted(row: unknown): AcceptedInvitation {
  if (!isRecord(row)) {
    throw new ApplicationError("INTERNAL", invitationMessages.saveFailed);
  }
  const parsed = acceptedInvitationSchema.safeParse({
    invitationId: row.invitation_id,
    inviteType: row.invite_type,
    clubId: row.club_id,
    teamId: row.team_id,
    playerId: row.player_id,
  });
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", invitationMessages.saveFailed);
  }
  return parsed.data;
}

function parseRecord(row: unknown): InvitationRecord {
  if (!isRecord(row)) {
    throw new ApplicationError("INTERNAL", invitationMessages.readFailed);
  }
  const parsed = invitationRecordSchema.safeParse({
    id: row.id,
    clubId: row.club_id,
    teamId: row.team_id,
    playerId: row.player_id,
    inviteType: row.invite_type,
    intendedEmail: row.intended_email,
    intendedPhone: row.intended_phone,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    status: row.status,
  });
  if (!parsed.success) {
    throw new ApplicationError("INTERNAL", invitationMessages.readFailed);
  }
  return parsed.data;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
