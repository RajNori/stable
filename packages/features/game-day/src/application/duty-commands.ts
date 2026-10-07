import { ApplicationError } from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

import {
  proposeDutyAllocation,
  type DutyCandidate,
  type DutyProposal,
  type OpenDuty,
} from "./duty-allocation.js";
import type { GameDayAccess } from "./game-day-commands.js";
import { DUTY_TYPES, gameDayMessages } from "./game-day-messages.js";

const idSchema = z.string().uuid();

const inputsSchema = z.strictObject({
  duties: z.array(
    z.strictObject({
      dutyId: idSchema,
      dutyType: z.enum(DUTY_TYPES),
      label: z.string(),
    }),
  ),
  candidates: z.array(
    z.strictObject({
      userId: idSchema,
      priorCount: z.number().int().min(0),
    }),
  ),
});

export type DutyAllocationWriter = {
  createOpenDuty(input: {
    eventId: string;
    dutyType: (typeof DUTY_TYPES)[number];
    label: string;
  }): Promise<{ dutyId: string }>;
  listDutyAllocationInputs(eventId: string): Promise<{
    duties: OpenDuty[];
    candidates: DutyCandidate[];
  }>;
  commitDutyAllocation(eventId: string, fingerprint: string): Promise<void>;
  acknowledgeOwnDuty(eventId: string): Promise<number>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    gameDayMessages.validationFailed,
  );
}

function assertCapability(
  input: GameDayAccess,
  clubId: string,
  teamId: string,
  capability: "duty.manage" | "duty.respond",
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

export async function createOpenGameDuty(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    dutyType: string;
    label: string;
    writer: DutyAllocationWriter;
  },
): Promise<{ dutyId: string }> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const eventId = idSchema.safeParse(input.eventId);
  const dutyType = z.enum(DUTY_TYPES).safeParse(input.dutyType);
  const label = z.string().trim().min(1).max(80).safeParse(input.label);
  if (
    !clubId.success ||
    !teamId.success ||
    !eventId.success ||
    !dutyType.success ||
    !label.success
  ) {
    validationFailed();
  }
  assertCapability(input, clubId.data, teamId.data, "duty.manage");
  return input.writer.createOpenDuty({
    eventId: eventId.data,
    dutyType: dutyType.data,
    label: label.data,
  });
}

export async function previewDutyAllocation(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: DutyAllocationWriter;
  },
): Promise<{ proposals: DutyProposal[]; fingerprint: string }> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const eventId = idSchema.safeParse(input.eventId);
  if (!clubId.success || !teamId.success || !eventId.success) {
    validationFailed();
  }
  assertCapability(input, clubId.data, teamId.data, "duty.manage");
  const loaded = inputsSchema.safeParse(
    await input.writer.listDutyAllocationInputs(eventId.data),
  );
  if (!loaded.success) {
    throw new ApplicationError("INTERNAL", gameDayMessages.readFailed);
  }
  return proposeDutyAllocation(loaded.data);
}

export async function commitDutyAllocation(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    fingerprint: string;
    writer: DutyAllocationWriter;
  },
): Promise<void> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const eventId = idSchema.safeParse(input.eventId);
  const fingerprint = z.string().trim().min(1).safeParse(input.fingerprint);
  if (
    !clubId.success ||
    !teamId.success ||
    !eventId.success ||
    !fingerprint.success
  ) {
    validationFailed();
  }
  assertCapability(input, clubId.data, teamId.data, "duty.manage");
  await input.writer.commitDutyAllocation(eventId.data, fingerprint.data);
}

export async function acknowledgeGameDuty(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: DutyAllocationWriter;
  },
): Promise<number> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const eventId = idSchema.safeParse(input.eventId);
  if (!clubId.success || !teamId.success || !eventId.success) {
    validationFailed();
  }
  assertCapability(input, clubId.data, teamId.data, "duty.respond");
  return input.writer.acknowledgeOwnDuty(eventId.data);
}
