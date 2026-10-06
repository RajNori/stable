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

import { SCHEDULE_EVENT_TYPES, scheduleMessages } from "./schedule-messages.js";

const idSchema = z.string().uuid();
const instantSchema = z.string().refine((value) => {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
});

export const scheduleEntrySchema = z.strictObject({
  eventId: idSchema,
  clubId: idSchema,
  teamId: idSchema,
  eventType: z.enum(SCHEDULE_EVENT_TYPES),
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
  courtLabel: z.string().nullable(),
  eventStatus: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]),
  opponentName: z.string().nullable(),
  roundLabel: z.string().nullable(),
});

export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;

export const scheduleQuerySchema = z
  .strictObject({
    clubId: idSchema,
    teamId: idSchema,
    rangeStart: instantSchema,
    rangeEnd: instantSchema,
    eventType: z.enum(SCHEDULE_EVENT_TYPES).nullable(),
  })
  .superRefine((value, context) => {
    if (Date.parse(value.rangeEnd) < Date.parse(value.rangeStart)) {
      context.addIssue({
        code: "custom",
        message: "range",
        path: ["rangeEnd"],
      });
    }
  });

export type ScheduleQuery = z.infer<typeof scheduleQuerySchema>;

export type ScheduleAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type ScheduleReader = {
  listTeamSchedule(query: ScheduleQuery): Promise<ScheduleEntry[]>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    scheduleMessages.validationFailed,
  );
}

export function compareScheduleEntries(
  left: ScheduleEntry,
  right: ScheduleEntry,
): number {
  if (left.startsAt < right.startsAt) {
    return -1;
  }
  if (left.startsAt > right.startsAt) {
    return 1;
  }
  if (left.eventId < right.eventId) {
    return -1;
  }
  if (left.eventId > right.eventId) {
    return 1;
  }
  return 0;
}

export async function listTeamSchedule(
  input: ScheduleAccess & ScheduleQuery & { reader: ScheduleReader },
): Promise<ScheduleEntry[]> {
  const parsed = scheduleQuerySchema.safeParse({
    clubId: input.clubId,
    teamId: input.teamId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    eventType: input.eventType,
  });
  if (!parsed.success) {
    validationFailed();
  }
  const query = parsed.data;
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      scheduleMessages.unauthenticated,
    );
  }
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: {
        clubId: query.clubId,
        teamId: query.teamId,
        teamActive: input.teamActive,
      },
      capability: "fixture.read",
    }) !== "allow"
  ) {
    throw new ApplicationError("FORBIDDEN", scheduleMessages.forbidden);
  }

  const rows = await input.reader.listTeamSchedule(query);
  if (
    rows.some(
      (entry) => entry.clubId !== query.clubId || entry.teamId !== query.teamId,
    )
  ) {
    throw new ApplicationError("NOT_FOUND", scheduleMessages.notFound);
  }

  return rows
    .filter((entry) => {
      if (
        entry.startsAt < query.rangeStart ||
        entry.startsAt > query.rangeEnd
      ) {
        return false;
      }
      return query.eventType === null || entry.eventType === query.eventType;
    })
    .slice()
    .sort(compareScheduleEntries);
}
