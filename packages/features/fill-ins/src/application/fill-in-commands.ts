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

import { fillInMessages } from "./fill-in-messages.js";

const idSchema = z.string().uuid();

export type FillInCandidate = {
  playerId: string;
  displayName: string;
};

export type FillInRequest = {
  id: string;
  status: string;
};

export type FillInAccess = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  teamActive: boolean;
};

export type FillInWriter = {
  requestFillIn(eventId: string): Promise<{ requestId: string }>;
  respondFillIn(
    requestId: string,
    playerId: string,
  ): Promise<{ responseId: string }>;
  confirmFillIn(
    requestId: string,
    playerId: string,
  ): Promise<{ confirmationId: string }>;
  listFillInCandidates(teamId: string): Promise<FillInCandidate[]>;
  listEventFillIn(eventId: string): Promise<FillInRequest | null>;
  listFillInResponses(requestId: string): Promise<FillInCandidate[]>;
  listGuardianFillInPlayers(teamId: string): Promise<FillInCandidate[]>;
  enqueueFillInRequested(requestId: string): Promise<void>;
  enqueueFillInConfirmed(requestId: string): Promise<void>;
};

function validationFailed(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    fillInMessages.validationFailed,
  );
}

function assertPrincipal(input: FillInAccess): void {
  if (input.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      fillInMessages.unauthenticated,
    );
  }
}

function assertManage(
  input: FillInAccess,
  clubId: string,
  teamId: string,
): void {
  assertPrincipal(input);
  if (
    evaluateCapability({
      clubMemberships: input.clubMemberships,
      teamMemberships: input.teamMemberships,
      guardianLinks: input.guardianLinks,
      registrations: input.registrations,
      resource: { clubId, teamId, teamActive: input.teamActive },
      capability: "fillin.manage",
    }) !== "allow"
  ) {
    throw new ApplicationError("FORBIDDEN", fillInMessages.forbidden);
  }
}

function assertGuardian(input: FillInAccess, playerId: string): void {
  assertPrincipal(input);
  const linked = input.guardianLinks.some(
    (link) => link.playerId === playerId && link.active && link.playerActive,
  );
  if (!linked) {
    throw new ApplicationError("FORBIDDEN", fillInMessages.forbidden);
  }
}

export async function requestFillIn(
  input: FillInAccess & {
    clubId: string;
    teamId: string;
    eventId: string;
    writer: FillInWriter;
  },
): Promise<{ requestId: string }> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const eventId = idSchema.safeParse(input.eventId);
  if (!clubId.success || !teamId.success || !eventId.success) {
    validationFailed();
  }
  assertManage(input, clubId.data, teamId.data);
  const requested = await input.writer.requestFillIn(eventId.data);
  try {
    await input.writer.enqueueFillInRequested(requested.requestId);
  } catch {
    return requested;
  }
  return requested;
}

export async function respondFillIn(
  input: FillInAccess & {
    requestId: string;
    playerId: string;
    writer: FillInWriter;
  },
): Promise<{ responseId: string }> {
  const requestId = idSchema.safeParse(input.requestId);
  const playerId = idSchema.safeParse(input.playerId);
  if (!requestId.success || !playerId.success) {
    validationFailed();
  }
  assertGuardian(input, playerId.data);
  return input.writer.respondFillIn(requestId.data, playerId.data);
}

export async function confirmFillIn(
  input: FillInAccess & {
    clubId: string;
    teamId: string;
    requestId: string;
    playerId: string;
    writer: FillInWriter;
  },
): Promise<{ confirmationId: string }> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  const requestId = idSchema.safeParse(input.requestId);
  const playerId = idSchema.safeParse(input.playerId);
  if (
    !clubId.success ||
    !teamId.success ||
    !requestId.success ||
    !playerId.success
  ) {
    validationFailed();
  }
  assertManage(input, clubId.data, teamId.data);
  const confirmed = await input.writer.confirmFillIn(
    requestId.data,
    playerId.data,
  );
  try {
    await input.writer.enqueueFillInConfirmed(requestId.data);
  } catch {
    return confirmed;
  }
  return confirmed;
}

export async function listFillInCandidates(
  input: FillInAccess & {
    clubId: string;
    teamId: string;
    writer: FillInWriter;
  },
): Promise<FillInCandidate[]> {
  const clubId = idSchema.safeParse(input.clubId);
  const teamId = idSchema.safeParse(input.teamId);
  if (!clubId.success || !teamId.success) {
    validationFailed();
  }
  assertManage(input, clubId.data, teamId.data);
  return input.writer.listFillInCandidates(teamId.data);
}

export async function listGuardianFillInPlayers(
  input: FillInAccess & { teamId: string; writer: FillInWriter },
): Promise<FillInCandidate[]> {
  const teamId = idSchema.safeParse(input.teamId);
  if (!teamId.success) {
    validationFailed();
  }
  assertPrincipal(input);
  return input.writer.listGuardianFillInPlayers(teamId.data);
}
