import { ApplicationError } from "@stable/contracts";
import type {
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

import { DUTY_TYPES, OWN_RSVP, gameDayMessages } from "./game-day-messages.js";

const idSchema = z.string().uuid();
const instantSchema = z.string().refine((value) => {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
});
const countSchema = z.number().int().min(0).nullable();

export const gameDayProjectionSchema = z.strictObject({
  eventId: idSchema,
  clubId: idSchema,
  teamId: idSchema,
  opponentName: z.string(),
  roundLabel: z.string().nullable(),
  officialStartAt: instantSchema,
  arrivalAt: instantSchema.nullable(),
  venueText: z.string().nullable(),
  courtLabel: z.string().nullable(),
  uniformNote: z.string().nullable(),
  coachFocus: z.string().nullable(),
  ownRsvp: z.literal(OWN_RSVP),
  ownDutyLabel: z.string().nullable(),
  ownDutyStatus: z.literal("ASSIGNED").nullable(),
  attendingCount: countSchema,
  unavailableCount: countSchema,
  unsureCount: countSchema,
  unansweredCount: countSchema,
});

export type GameDayProjection = z.infer<typeof gameDayProjectionSchema>;

export const assignDutySchema = z.strictObject({
  eventId: idSchema,
  dutyType: z.enum(DUTY_TYPES),
  label: z.string().trim().min(1).max(80),
  assignedUserId: idSchema,
});

export type AssignDuty = z.infer<typeof assignDutySchema>;

export type GameDayAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type GameDayReader = {
  readGameDay(eventId: string): Promise<GameDayProjection>;
  assignGameDuty(command: AssignDuty): Promise<{ dutyId: string }>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    gameDayMessages.validationFailed,
  );
}

function assertAllowed(
  input: GameDayAccess,
  clubId: string,
  teamId: string,
  capability: string,
): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      gameDayMessages.unauthenticated,
    );
  }
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: { clubId, teamId, teamActive: input.teamActive },
      capability,
    }) !== "allow"
  ) {
    throw new ApplicationError("FORBIDDEN", gameDayMessages.forbidden);
  }
}

function canReadTeamAttendance(
  input: GameDayAccess,
  clubId: string,
  teamId: string,
): boolean {
  return (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: { clubId, teamId, teamActive: input.teamActive },
      capability: "attendance.read_team",
    }) === "allow"
  );
}

function withoutStaffCounts(projection: GameDayProjection): GameDayProjection {
  return {
    ...projection,
    attendingCount: null,
    unavailableCount: null,
    unsureCount: null,
    unansweredCount: null,
  };
}

export async function readGameDay(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    reader: GameDayReader;
  },
): Promise<GameDayProjection> {
  const eventId = idSchema.safeParse(input.eventId);
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!eventId.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "fixture.read");
  const projection = await input.reader.readGameDay(eventId.data);
  if (projection.clubId !== clubId.data || projection.teamId !== teamId.data) {
    throw new ApplicationError("NOT_FOUND", gameDayMessages.notFound);
  }
  if (!canReadTeamAttendance(input, clubId.data, teamId.data)) {
    return withoutStaffCounts(projection);
  }
  return projection;
}

export async function assignGameDuty(
  input: GameDayAccess &
    AssignDuty & { clubId: string; teamId: string; reader: GameDayReader },
): Promise<{ dutyId: string }> {
  const command = assignDutySchema.safeParse({
    eventId: input.eventId,
    dutyType: input.dutyType,
    label: input.label,
    assignedUserId: input.assignedUserId,
  });
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!command.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "fixture.manage_manual");
  return input.reader.assignGameDuty(command.data);
}
