import { z } from "zod";
import {
  ApplicationError,
  type MembershipFact,
  type Principal,
} from "@stable/contracts";

export const INVITATION_TYPES = [
  "GUARDIAN",
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
] as const;

export const INVITATION_STATUSES = [
  "pending",
  "expired",
  "consumed",
  "revoked",
] as const;

export const invitationMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "Invitations require an active club admin.",
  notFound: "Invitation was not found.",
  validationFailed: "Invitation details failed validation.",
  saveFailed: "Invitation could not be saved.",
  readFailed: "Invitations could not be read.",
  expired: "This invitation has expired.",
  revoked: "This invitation is no longer available.",
  alreadyConsumed: "This invitation has already been used.",
  identityMismatch: "This invitation does not match the signed-in account.",
  accepted: "Invitation accepted.",
} as const;

const idSchema = z.string().uuid();
const typeSchema = z.enum(INVITATION_TYPES);
const statusSchema = z.enum(INVITATION_STATUSES);
const tokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const createdInvitationSchema = z.strictObject({
  id: idSchema,
  token: tokenSchema,
  expiresAt: z.string().min(1),
});

export type CreatedInvitation = z.infer<typeof createdInvitationSchema>;

export const invitationRecordSchema = z.strictObject({
  id: idSchema,
  clubId: idSchema,
  teamId: idSchema.nullable(),
  playerId: idSchema.nullable(),
  inviteType: typeSchema,
  intendedEmail: z.string().nullable(),
  intendedPhone: z.string().nullable(),
  expiresAt: z.string().min(1),
  consumedAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  createdAt: z.string().min(1),
  status: statusSchema,
});

export type InvitationRecord = z.infer<typeof invitationRecordSchema>;

export const acceptedInvitationSchema = z.strictObject({
  invitationId: idSchema,
  inviteType: typeSchema,
  clubId: idSchema,
  teamId: idSchema.nullable(),
  playerId: idSchema.nullable(),
});

export type AcceptedInvitation = z.infer<typeof acceptedInvitationSchema>;

export type CreateInvitationCommand = {
  clubId: string;
  inviteType: (typeof INVITATION_TYPES)[number];
  teamId: string | null;
  playerId: string | null;
  intendedEmail: string | null;
  intendedPhone: string | null;
};

export type InvitationWriter = {
  createInvitation(
    command: CreateInvitationCommand,
  ): Promise<CreatedInvitation>;
  revokeInvitation(invitationId: string): Promise<void>;
  acceptInvitation(token: string): Promise<AcceptedInvitation>;
  listInvitations(clubId: string): Promise<InvitationRecord[]>;
};

type AuthorizedCommand = {
  principal: Principal | null;
  memberships: readonly MembershipFact[];
};

function assertSignedIn(principal: Principal | null): void {
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      invitationMessages.unauthenticated,
    );
  }
}

function assertClubAdmin(input: AuthorizedCommand, clubId: string): void {
  assertSignedIn(input.principal);
  const parsedClubId = idSchema.safeParse(clubId);
  if (!parsedClubId.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      invitationMessages.validationFailed,
    );
  }
  const allowed = input.memberships.some(
    (membership) =>
      membership.active &&
      membership.clubId === parsedClubId.data &&
      membership.role === "CLUB_ADMIN",
  );
  if (!allowed) {
    throw new ApplicationError("FORBIDDEN", invitationMessages.forbidden);
  }
}

export async function createInvitation(
  input: AuthorizedCommand &
    CreateInvitationCommand & { writer: InvitationWriter },
): Promise<CreatedInvitation> {
  const parsed = z
    .strictObject({
      clubId: idSchema,
      inviteType: typeSchema,
      teamId: idSchema.nullable(),
      playerId: idSchema.nullable(),
      intendedEmail: z.string().email().nullable(),
      intendedPhone: z
        .string()
        .regex(/^\+?[0-9]{8,20}$/)
        .nullable(),
    })
    .safeParse({
      clubId: input.clubId,
      inviteType: input.inviteType,
      teamId: input.teamId,
      playerId: input.playerId,
      intendedEmail: input.intendedEmail,
      intendedPhone: input.intendedPhone,
    });
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      invitationMessages.validationFailed,
    );
  }
  const emailSet = parsed.data.intendedEmail !== null;
  const phoneSet = parsed.data.intendedPhone !== null;
  const guardian = parsed.data.inviteType === "GUARDIAN";
  const shapeValid = guardian
    ? parsed.data.playerId !== null && parsed.data.teamId === null
    : parsed.data.teamId !== null && parsed.data.playerId === null;
  if (emailSet === phoneSet || !shapeValid) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      invitationMessages.validationFailed,
    );
  }
  assertClubAdmin(input, parsed.data.clubId);
  return input.writer.createInvitation(parsed.data);
}

export async function revokeInvitation(
  input: AuthorizedCommand & {
    clubId: string;
    invitationId: string;
    writer: InvitationWriter;
  },
): Promise<void> {
  const parsed = z
    .strictObject({
      clubId: idSchema,
      invitationId: idSchema,
    })
    .safeParse({
      clubId: input.clubId,
      invitationId: input.invitationId,
    });
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      invitationMessages.validationFailed,
    );
  }
  assertClubAdmin(input, parsed.data.clubId);
  await input.writer.revokeInvitation(parsed.data.invitationId);
}

export async function acceptInvitation(input: {
  principal: Principal | null;
  token: string;
  writer: InvitationWriter;
}): Promise<AcceptedInvitation> {
  assertSignedIn(input.principal);
  const parsed = tokenSchema.safeParse(input.token);
  if (!parsed.success) {
    throw new ApplicationError("NOT_FOUND", invitationMessages.notFound);
  }
  return input.writer.acceptInvitation(parsed.data);
}

export async function listInvitations(
  input: AuthorizedCommand & { clubId: string; writer: InvitationWriter },
): Promise<InvitationRecord[]> {
  const parsed = idSchema.safeParse(input.clubId);
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      invitationMessages.validationFailed,
    );
  }
  assertClubAdmin(input, parsed.data);
  return input.writer.listInvitations(parsed.data);
}
