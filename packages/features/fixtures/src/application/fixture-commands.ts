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

import { fixtureMessages } from "./fixture-messages.js";

export const FIXTURE_SOURCES = ["MANUAL", "IMPORT"] as const;
export const FIXTURE_STATUSES = [
  "SCHEDULED",
  "POSTPONED",
  "CANCELLED",
  "COMPLETED",
] as const;
export const HOME_AWAY = ["HOME", "AWAY", "NEUTRAL"] as const;

const idSchema = z.string().uuid();
const instantSchema = z.string().refine((value) => {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
});

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code <= 31 || code === 127)) {
      return true;
    }
  }
  return false;
}

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => {
      if (value === null || value.length === 0) {
        return null;
      }
      return value;
    })
    .refine((value) => value === null || !hasControlCharacter(value));
}

function requiredText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasControlCharacter(value));
}

const scoreSchema = z.number().int().min(0).max(999).nullable();

const officialFixtureObject = z.strictObject({
  clubId: idSchema,
  teamId: idSchema,
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
  venueId: idSchema.nullable(),
  courtLabel: optionalText(80),
  competitionId: idSchema.nullable(),
  roundLabel: optionalText(40),
  opponentName: requiredText(120),
  officialStartAt: instantSchema,
  officialVenueText: optionalText(200),
  officialCourtLabel: optionalText(80),
  homeAway: z.enum(HOME_AWAY).nullable(),
});

function rejectInvertedEnd(
  value: { startsAt: string; endsAt: string | null },
  context: z.RefinementCtx,
): void {
  if (
    value.endsAt !== null &&
    Date.parse(value.endsAt) <= Date.parse(value.startsAt)
  ) {
    context.addIssue({
      code: "custom",
      message: "ends",
      path: ["endsAt"],
    });
  }
}

export const officialFixtureSchema =
  officialFixtureObject.superRefine(rejectInvertedEnd);

export const importedFixtureSchema = officialFixtureObject
  .extend({
    externalId: requiredText(120),
  })
  .superRefine(rejectInvertedEnd);

export const officialFixtureUpdateSchema = officialFixtureObject
  .extend({
    eventId: idSchema,
    fixtureStatus: z.enum(FIXTURE_STATUSES),
    teamScore: scoreSchema,
    opponentScore: scoreSchema,
    resultStatus: z.literal("FINAL").nullable(),
  })
  .superRefine(rejectInvertedEnd);

export const fixtureOverlaySchema = z.strictObject({
  eventId: idSchema,
  arrivalAt: instantSchema.nullable(),
  uniformNote: optionalText(500),
  coachFocus: optionalText(500),
  teamNote: optionalText(500),
});

export type OfficialFixture = z.infer<typeof officialFixtureSchema>;
export type ImportedFixture = z.infer<typeof importedFixtureSchema>;
export type OfficialFixtureUpdate = z.infer<typeof officialFixtureUpdateSchema>;
export type FixtureOverlay = z.infer<typeof fixtureOverlaySchema>;

export const fixtureRecordSchema = z.strictObject({
  eventId: idSchema,
  clubId: idSchema,
  teamId: idSchema,
  startsAt: instantSchema,
  endsAt: instantSchema.nullable(),
  venueId: idSchema.nullable(),
  courtLabel: z.string().nullable(),
  eventStatus: z.enum(["SCHEDULED", "CANCELLED", "COMPLETED"]),
  competitionId: idSchema.nullable(),
  roundLabel: z.string().nullable(),
  opponentName: z.string(),
  source: z.enum(FIXTURE_SOURCES),
  externalId: z.string().nullable(),
  officialStartAt: instantSchema,
  officialVenueText: z.string().nullable(),
  officialCourtLabel: z.string().nullable(),
  fixtureStatus: z.enum(FIXTURE_STATUSES),
  homeAway: z.enum(HOME_AWAY).nullable(),
  teamScore: scoreSchema,
  opponentScore: scoreSchema,
  resultStatus: z.literal("FINAL").nullable(),
  lastExternalSyncAt: instantSchema.nullable(),
  arrivalAt: instantSchema.nullable(),
  uniformNote: z.string().nullable(),
  coachFocus: z.string().nullable(),
  teamNote: z.string().nullable(),
});

export type FixtureRecord = z.infer<typeof fixtureRecordSchema>;

export type FixtureAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type FixtureWriter = {
  createManualFixture(command: OfficialFixture): Promise<{ eventId: string }>;
  importFixture(command: ImportedFixture): Promise<{ eventId: string }>;
  updateOfficialFixture(command: OfficialFixtureUpdate): Promise<void>;
  updateFixtureOverlay(command: FixtureOverlay): Promise<void>;
  readFixture(eventId: string): Promise<FixtureRecord>;
  listTeamFixtures(teamId: string): Promise<FixtureRecord[]>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    fixtureMessages.validationFailed,
  );
}

function parseCommand<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    validationFailed();
  }
  return parsed.data;
}

function assertAllowed(
  input: FixtureAccess,
  clubId: string,
  teamId: string,
  capability: string,
): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      fixtureMessages.unauthenticated,
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
    throw new ApplicationError("FORBIDDEN", fixtureMessages.forbidden);
  }
}

function officialFields(input: OfficialFixture): OfficialFixture {
  return {
    clubId: input.clubId,
    teamId: input.teamId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    venueId: input.venueId,
    courtLabel: input.courtLabel,
    competitionId: input.competitionId,
    roundLabel: input.roundLabel,
    opponentName: input.opponentName,
    officialStartAt: input.officialStartAt,
    officialVenueText: input.officialVenueText,
    officialCourtLabel: input.officialCourtLabel,
    homeAway: input.homeAway,
  };
}

export async function createManualFixture(
  input: FixtureAccess & OfficialFixture & { writer: FixtureWriter },
): Promise<{ eventId: string }> {
  const command = parseCommand(officialFixtureSchema, officialFields(input));
  assertAllowed(input, command.clubId, command.teamId, "fixture.manage_manual");
  return input.writer.createManualFixture(command);
}

export async function importFixture(
  input: FixtureAccess & ImportedFixture & { writer: FixtureWriter },
): Promise<{ eventId: string }> {
  const command = parseCommand(importedFixtureSchema, {
    ...officialFields(input),
    externalId: input.externalId,
  });
  assertAllowed(input, command.clubId, command.teamId, "fixture.manage_manual");
  return input.writer.importFixture(command);
}

export async function updateOfficialFixture(
  input: FixtureAccess & OfficialFixtureUpdate & { writer: FixtureWriter },
): Promise<void> {
  const command = parseCommand(officialFixtureUpdateSchema, {
    ...officialFields(input),
    eventId: input.eventId,
    fixtureStatus: input.fixtureStatus,
    teamScore: input.teamScore,
    opponentScore: input.opponentScore,
    resultStatus: input.resultStatus,
  });
  assertAllowed(input, command.clubId, command.teamId, "fixture.manage_manual");
  await input.writer.updateOfficialFixture(command);
}

export async function updateFixtureOverlay(
  input: FixtureAccess &
    FixtureOverlay & {
      clubId: string;
      teamId: string;
      writer: FixtureWriter;
    },
): Promise<void> {
  const command = parseCommand(fixtureOverlaySchema, {
    eventId: input.eventId,
    arrivalAt: input.arrivalAt,
    uniformNote: input.uniformNote,
    coachFocus: input.coachFocus,
    teamNote: input.teamNote,
  });
  const clubId = parseCommand(idSchema, input.clubId);
  const teamId = parseCommand(idSchema, input.teamId);
  assertAllowed(input, clubId, teamId, "fixture.overlay_manage");
  await input.writer.updateFixtureOverlay(command);
}

export async function readFixture(
  input: FixtureAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: FixtureWriter;
  },
): Promise<FixtureRecord> {
  const eventId = parseCommand(idSchema, input.eventId);
  assertAllowed(input, input.clubId, input.teamId, "fixture.read");
  const fixture = await input.writer.readFixture(eventId);
  if (fixture.clubId !== input.clubId || fixture.teamId !== input.teamId) {
    throw new ApplicationError("NOT_FOUND", fixtureMessages.notFound);
  }
  return fixture;
}

export async function listTeamFixtures(
  input: FixtureAccess & {
    clubId: string;
    teamId: string;
    writer: FixtureWriter;
  },
): Promise<FixtureRecord[]> {
  const teamId = parseCommand(idSchema, input.teamId);
  const clubId = parseCommand(idSchema, input.clubId);
  assertAllowed(input, clubId, teamId, "fixture.read");
  const fixtures = await input.writer.listTeamFixtures(teamId);
  if (
    fixtures.some(
      (fixture) => fixture.clubId !== clubId || fixture.teamId !== teamId,
    )
  ) {
    throw new ApplicationError("NOT_FOUND", fixtureMessages.notFound);
  }
  return fixtures;
}
