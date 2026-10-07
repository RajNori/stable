import { ApplicationError } from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";
import { z } from "zod";

import type { GameDayAccess } from "./game-day-commands.js";
import { gameDayMessages } from "./game-day-messages.js";

const idSchema = z.string().uuid();

export type DutySwapRecord = {
  id: string;
  label: string;
  requesterUserId: string;
  targetUserId: string | null;
};

export type DutySwapWriter = {
  requestDutySwap(
    eventId: string,
    targetUserId: string | null,
  ): Promise<{
    requestId: string;
  }>;
  acceptDutySwap(requestId: string): Promise<{ requestId: string }>;
  cancelDutySwap(requestId: string): Promise<void>;
  enqueueDutySwapAccepted(requestId: string): Promise<void>;
  listOpenDutySwaps(eventId: string): Promise<DutySwapRecord[]>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    gameDayMessages.validationFailed,
  );
}

function assertResponder(
  input: GameDayAccess,
  clubId: string,
  teamId: string,
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
      capability: "duty.respond",
    }) !== "allow"
  ) {
    throw new ApplicationError("FORBIDDEN", gameDayMessages.forbidden);
  }
}

export async function requestDutySwap(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    targetUserId: string | null;
    writer: DutySwapWriter;
  },
): Promise<{ requestId: string }> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const eventId = idSchema.safeParse(input.eventId);
  const target =
    input.targetUserId === null
      ? { success: true as const, data: null }
      : idSchema.safeParse(input.targetUserId);
  if (
    !clubId.success ||
    !teamId.success ||
    !eventId.success ||
    !target.success
  ) {
    validationFailed();
  }
  assertResponder(input, clubId.data, teamId.data);
  return input.writer.requestDutySwap(eventId.data, target.data);
}

export async function acceptDutySwap(
  input: GameDayAccess & {
    clubId: string;
    teamId: string;
    requestId: string;
    writer: DutySwapWriter;
  },
): Promise<{ requestId: string }> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const requestId = idSchema.safeParse(input.requestId);
  if (!clubId.success || !teamId.success || !requestId.success) {
    validationFailed();
  }
  assertResponder(input, clubId.data, teamId.data);
  const accepted = await input.writer.acceptDutySwap(requestId.data);
  try {
    await input.writer.enqueueDutySwapAccepted(accepted.requestId);
  } catch {
    return accepted;
  }
  return accepted;
}
