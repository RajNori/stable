import { z } from "zod";
import {
  ApplicationError,
  TEAM_STAFF_ROLES,
  type MembershipFact,
  type Principal,
  type TeamStaffRole,
} from "@stable/contracts";

export const membershipMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "Team changes require an active club admin.",
  notFound: "Team record was not found.",
  validationFailed: "Team details failed validation.",
  saveFailed: "Team changes could not be saved.",
  readFailed: "Team staff could not be read.",
} as const;

const idSchema = z.string().uuid();
const roleSchema = z.enum(TEAM_STAFF_ROLES);

export const teamStaffAssignmentSchema = z.strictObject({
  id: idSchema,
  clubId: idSchema,
  teamId: idSchema,
  userId: idSchema,
  role: roleSchema,
  active: z.boolean(),
});

export type TeamStaffAssignment = z.infer<typeof teamStaffAssignmentSchema>;

export const playerTeamRegistrationSchema = z.strictObject({
  id: idSchema,
  clubId: idSchema,
  teamId: idSchema,
  playerId: idSchema,
  active: z.boolean(),
});

export type PlayerTeamRegistration = z.infer<
  typeof playerTeamRegistrationSchema
>;

export type AssignTeamRoleCommand = {
  clubId: string;
  teamId: string;
  userId: string;
  role: TeamStaffRole;
};

export type TeamRoleCommand = AssignTeamRoleCommand;

export type RegisterPlayerCommand = {
  clubId: string;
  playerId: string;
  teamId: string;
};

export type UnregisterPlayerCommand = {
  clubId: string;
  playerId: string;
};

export type MembershipWriter = {
  assignTeamRole(command: AssignTeamRoleCommand): Promise<TeamStaffAssignment>;
  revokeTeamRole(command: TeamRoleCommand): Promise<TeamStaffAssignment>;
  reactivateTeamRole(command: TeamRoleCommand): Promise<TeamStaffAssignment>;
  registerPlayer(
    command: RegisterPlayerCommand,
  ): Promise<PlayerTeamRegistration>;
  unregisterPlayer(
    command: UnregisterPlayerCommand,
  ): Promise<PlayerTeamRegistration>;
};

type AuthorizedCommand = {
  principal: Principal | null;
  memberships: readonly MembershipFact[];
};

function assertClubAdmin(input: AuthorizedCommand, clubId: string): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      membershipMessages.unauthenticated,
    );
  }

  const allowed = input.memberships.some(
    (membership) =>
      membership.active &&
      membership.clubId === clubId &&
      membership.role === "CLUB_ADMIN",
  );
  if (!allowed) {
    throw new ApplicationError("FORBIDDEN", membershipMessages.forbidden);
  }
}

function parseRoleCommand(
  command: AssignTeamRoleCommand,
): AssignTeamRoleCommand {
  const parsed = z
    .strictObject({
      clubId: idSchema,
      teamId: idSchema,
      userId: idSchema,
      role: roleSchema,
    })
    .safeParse({
      clubId: command.clubId,
      teamId: command.teamId,
      userId: command.userId,
      role: command.role,
    });
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      membershipMessages.validationFailed,
    );
  }
  return parsed.data;
}

export async function assignTeamRole(
  input: AuthorizedCommand &
    AssignTeamRoleCommand & { writer: MembershipWriter },
): Promise<TeamStaffAssignment> {
  const command = parseRoleCommand(input);
  assertClubAdmin(input, command.clubId);
  return input.writer.assignTeamRole(command);
}

export async function revokeTeamRole(
  input: AuthorizedCommand & TeamRoleCommand & { writer: MembershipWriter },
): Promise<TeamStaffAssignment> {
  const command = parseRoleCommand(input);
  assertClubAdmin(input, command.clubId);
  return input.writer.revokeTeamRole(command);
}

export async function reactivateTeamRole(
  input: AuthorizedCommand & TeamRoleCommand & { writer: MembershipWriter },
): Promise<TeamStaffAssignment> {
  const command = parseRoleCommand(input);
  assertClubAdmin(input, command.clubId);
  return input.writer.reactivateTeamRole(command);
}

export async function registerPlayerOnTeam(
  input: AuthorizedCommand &
    RegisterPlayerCommand & { writer: MembershipWriter },
): Promise<PlayerTeamRegistration> {
  const parsed = z
    .strictObject({
      clubId: idSchema,
      playerId: idSchema,
      teamId: idSchema,
    })
    .safeParse({
      clubId: input.clubId,
      playerId: input.playerId,
      teamId: input.teamId,
    });
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      membershipMessages.validationFailed,
    );
  }
  assertClubAdmin(input, parsed.data.clubId);
  return input.writer.registerPlayer(parsed.data);
}

export async function unregisterPlayerFromTeam(
  input: AuthorizedCommand &
    UnregisterPlayerCommand & { writer: MembershipWriter },
): Promise<PlayerTeamRegistration> {
  const parsed = z
    .strictObject({
      clubId: idSchema,
      playerId: idSchema,
    })
    .safeParse({
      clubId: input.clubId,
      playerId: input.playerId,
    });
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      membershipMessages.validationFailed,
    );
  }
  assertClubAdmin(input, parsed.data.clubId);
  return input.writer.unregisterPlayer(parsed.data);
}
