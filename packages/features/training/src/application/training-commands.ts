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

import { trainingMessages } from "./training-messages.js";

const idSchema = z.string().uuid();
const instantSchema = z.string().refine((value) => {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
});
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const clockSchema = z.string().regex(/^\d{2}:\d{2}$/);

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 31 || code === 127)) {
      return true;
    }
  }
  return false;
}

const courtSchema = z
  .string()
  .trim()
  .max(80)
  .nullable()
  .transform((value) => {
    if (value === null || value.length === 0) {
      return null;
    }
    return value;
  })
  .refine((value) => value === null || !hasControlCharacter(value));

export const trainingSessionSchema = z.strictObject({
  clubId: idSchema,
  teamId: idSchema,
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
  courtLabel: courtSchema,
  leadCoachUserId: idSchema.nullable(),
});

export const trainingSeriesSchema = z.strictObject({
  clubId: idSchema,
  teamId: idSchema,
  weekday: z.number().int().min(1).max(7),
  localTime: clockSchema,
  timezone: z.string().trim().min(1).max(64),
  startsOn: daySchema,
  endsOn: daySchema.nullable(),
  courtLabel: courtSchema,
  leadCoachUserId: idSchema.nullable(),
});

export const trainingOccurrenceSchema = z.strictObject({
  eventId: idSchema,
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
  courtLabel: courtSchema,
  leadCoachUserId: idSchema.nullable(),
});

export const trainingFollowingSchema = z.strictObject({
  eventId: idSchema,
  weekday: z.number().int().min(1).max(7),
  localTime: clockSchema,
  timezone: z.string().trim().min(1).max(64),
  endsOn: daySchema.nullable(),
});

export const trainingSeriesEditSchema = z.strictObject({
  seriesId: idSchema,
  weekday: z.number().int().min(1).max(7),
  localTime: clockSchema,
  timezone: z.string().trim().min(1).max(64),
  endsOn: daySchema.nullable(),
});

export type TrainingSession = z.infer<typeof trainingSessionSchema>;
export type TrainingSeries = z.infer<typeof trainingSeriesSchema>;
export type TrainingOccurrenceEdit = z.infer<typeof trainingOccurrenceSchema>;
export type TrainingFollowingEdit = z.infer<typeof trainingFollowingSchema>;
export type TrainingSeriesEdit = z.infer<typeof trainingSeriesEditSchema>;

export type TrainingAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type TrainingWriter = {
  createTrainingSession(command: TrainingSession): Promise<{ eventId: string }>;
  createTrainingSeries(command: TrainingSeries): Promise<{ seriesId: string }>;
  editTrainingOccurrence(
    command: TrainingOccurrenceEdit,
  ): Promise<{ eventId: string }>;
  editTrainingFollowing(
    command: TrainingFollowingEdit,
  ): Promise<{ seriesId: string }>;
  editTrainingSeries(
    command: TrainingSeriesEdit,
  ): Promise<{ seriesId: string }>;
  checkInTraining(eventId: string): Promise<void>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    trainingMessages.validationFailed,
  );
}

function assertAllowed(
  input: TrainingAccess,
  clubId: string,
  teamId: string,
  capability: string,
): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      trainingMessages.unauthenticated,
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
    throw new ApplicationError("FORBIDDEN", trainingMessages.forbidden);
  }
}

function parseIds(
  clubId: string,
  teamId: string,
): { clubId: string; teamId: string } {
  const club = idSchema.safeParse(clubId);
  const team = idSchema.safeParse(teamId);
  if (!club.success || !team.success) {
    validationFailed();
  }
  return { clubId: club.data, teamId: team.data };
}

export async function createTrainingSession(
  input: TrainingAccess &
    TrainingSession & {
      clubId: string;
      teamId: string;
      writer: TrainingWriter;
    },
): Promise<{ eventId: string }> {
  const command = trainingSessionSchema.safeParse({
    clubId: input.clubId,
    teamId: input.teamId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    courtLabel: input.courtLabel,
    leadCoachUserId: input.leadCoachUserId,
  });
  if (
    !command.success ||
    (command.data.endsAt !== null &&
      command.data.endsAt <= command.data.startsAt)
  ) {
    validationFailed();
  }
  assertAllowed(
    input,
    command.data.clubId,
    command.data.teamId,
    "training.manage",
  );
  return input.writer.createTrainingSession(command.data);
}

export async function createTrainingSeries(
  input: TrainingAccess &
    TrainingSeries & { clubId: string; teamId: string; writer: TrainingWriter },
): Promise<{ seriesId: string }> {
  const command = trainingSeriesSchema.safeParse({
    clubId: input.clubId,
    teamId: input.teamId,
    weekday: input.weekday,
    localTime: input.localTime,
    timezone: input.timezone,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    courtLabel: input.courtLabel,
    leadCoachUserId: input.leadCoachUserId,
  });
  if (
    !command.success ||
    (command.data.endsOn !== null &&
      command.data.endsOn < command.data.startsOn)
  ) {
    validationFailed();
  }
  assertAllowed(
    input,
    command.data.clubId,
    command.data.teamId,
    "training.manage",
  );
  return input.writer.createTrainingSeries(command.data);
}

export async function editTrainingOccurrence(
  input: TrainingAccess &
    TrainingOccurrenceEdit & {
      clubId: string;
      teamId: string;
      writer: TrainingWriter;
    },
): Promise<{ eventId: string }> {
  const command = trainingOccurrenceSchema.safeParse({
    eventId: input.eventId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    courtLabel: input.courtLabel,
    leadCoachUserId: input.leadCoachUserId,
  });
  const ids = parseIds(input.clubId, input.teamId);
  if (!command.success) {
    validationFailed();
  }
  assertAllowed(input, ids.clubId, ids.teamId, "training.manage");
  return input.writer.editTrainingOccurrence(command.data);
}

export async function editTrainingFollowing(
  input: TrainingAccess &
    TrainingFollowingEdit & {
      clubId: string;
      teamId: string;
      writer: TrainingWriter;
    },
): Promise<{ seriesId: string }> {
  const command = trainingFollowingSchema.safeParse({
    eventId: input.eventId,
    weekday: input.weekday,
    localTime: input.localTime,
    timezone: input.timezone,
    endsOn: input.endsOn,
  });
  const ids = parseIds(input.clubId, input.teamId);
  if (!command.success) {
    validationFailed();
  }
  assertAllowed(input, ids.clubId, ids.teamId, "training.manage");
  return input.writer.editTrainingFollowing(command.data);
}

export async function editTrainingSeries(
  input: TrainingAccess &
    TrainingSeriesEdit & {
      clubId: string;
      teamId: string;
      writer: TrainingWriter;
    },
): Promise<{ seriesId: string }> {
  const command = trainingSeriesEditSchema.safeParse({
    seriesId: input.seriesId,
    weekday: input.weekday,
    localTime: input.localTime,
    timezone: input.timezone,
    endsOn: input.endsOn,
  });
  const ids = parseIds(input.clubId, input.teamId);
  if (!command.success) {
    validationFailed();
  }
  assertAllowed(input, ids.clubId, ids.teamId, "training.manage");
  return input.writer.editTrainingSeries(command.data);
}

export async function checkInTraining(
  input: TrainingAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: TrainingWriter;
  },
): Promise<void> {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      trainingMessages.unauthenticated,
    );
  }
  const eventId = idSchema.safeParse(input.eventId);
  const ids = parseIds(input.clubId, input.teamId);
  if (!eventId.success) {
    validationFailed();
  }
  assertAllowed(input, ids.clubId, ids.teamId, "coach_checkin");
  await input.writer.checkInTraining(eventId.data);
}
