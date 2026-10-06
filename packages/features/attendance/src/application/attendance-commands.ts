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

import {
  ABSENCE_CATEGORIES,
  ATTENDANCE_STATUSES,
  attendanceMessages,
} from "./attendance-messages.js";

const idSchema = z.string().uuid();

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 31 || code === 127)) {
      return true;
    }
  }
  return false;
}

const noteSchema = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .transform((value) => {
    if (value === null || value.length === 0) {
      return null;
    }
    return value;
  })
  .refine((value) => value === null || !hasControlCharacter(value));

export const recordAttendanceSchema = z
  .strictObject({
    eventId: idSchema,
    playerId: idSchema,
    status: z.enum(ATTENDANCE_STATUSES),
    absenceCategory: z.enum(ABSENCE_CATEGORIES).nullable(),
    privateNote: noteSchema,
  })
  .superRefine((value, context) => {
    if (value.absenceCategory !== null && value.status !== "UNAVAILABLE") {
      context.addIssue({
        code: "custom",
        path: ["absenceCategory"],
        message: attendanceMessages.validationFailed,
      });
    }
  });

export type RecordAttendance = z.infer<typeof recordAttendanceSchema>;

export const teamAttendanceSchema = z.strictObject({
  playerId: idSchema,
  status: z.enum(ATTENDANCE_STATUSES),
  absenceCategory: z.enum(ABSENCE_CATEGORIES).nullable(),
  privateNote: z.string().nullable(),
});

export type TeamAttendance = z.infer<typeof teamAttendanceSchema>;

export type AttendanceAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type AttendanceWriter = {
  recordAttendance(command: RecordAttendance): Promise<{ responseId: string }>;
  listTeamAttendance(eventId: string): Promise<readonly TeamAttendance[]>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    attendanceMessages.validationFailed,
  );
}

function assertAllowed(
  input: AttendanceAccess,
  clubId: string,
  teamId: string,
  capability: string,
  playerId?: string,
): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      attendanceMessages.unauthenticated,
    );
  }
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: {
        clubId,
        teamId,
        teamActive: input.teamActive,
        ...(playerId === undefined ? {} : { playerId }),
      },
      capability,
    }) !== "allow"
  ) {
    throw new ApplicationError("FORBIDDEN", attendanceMessages.forbidden);
  }
}

export async function recordAttendance(
  input: AttendanceAccess &
    RecordAttendance & {
      clubId: string;
      teamId: string;
      writer: AttendanceWriter;
    },
): Promise<{ responseId: string }> {
  const command = recordAttendanceSchema.safeParse({
    eventId: input.eventId,
    playerId: input.playerId,
    status: input.status,
    absenceCategory: input.absenceCategory,
    privateNote: input.privateNote,
  });
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!command.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(
    input,
    clubId.data,
    teamId.data,
    "attendance.manage_managed_player",
    command.data.playerId,
  );
  return input.writer.recordAttendance(command.data);
}

export async function listTeamAttendance(
  input: AttendanceAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: AttendanceWriter;
  },
): Promise<readonly TeamAttendance[]> {
  const eventId = idSchema.safeParse(input.eventId);
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!eventId.success || !clubId.success || !teamId.success) {
    validationFailed();
  }
  assertAllowed(input, clubId.data, teamId.data, "attendance.read_team");
  return input.writer.listTeamAttendance(eventId.data);
}
