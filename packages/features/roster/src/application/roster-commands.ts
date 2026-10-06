import { z } from "zod";
import { ApplicationError } from "@stable/contracts";
import type {
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";

export const rosterMessages = {
  unauthenticated: "Authentication is required.",
  forbidden: "This roster is not available.",
  notFound: "Team roster was not found.",
  validationFailed: "Roster details failed validation.",
  saveFailed: "Roster changes could not be saved.",
  readFailed: "Team roster could not be read.",
} as const;

const idSchema = z.string().uuid();

export const rosterEntrySchema = z.strictObject({
  playerId: idSchema,
  teamId: idSchema,
  name: z.string().trim().min(1).max(162),
});

export type RosterEntry = z.infer<typeof rosterEntrySchema>;

export type RosterVisibility = "masked" | "full";

export type TeamRoster = {
  teamId: string;
  visibility: RosterVisibility;
  canManage: boolean;
  entries: readonly RosterEntry[];
};

export type RosterReader = {
  listMasked(teamId: string): Promise<readonly RosterEntry[]>;
  listFull(teamId: string): Promise<readonly RosterEntry[]>;
};

export type RosterWriter = {
  registerPlayer(playerId: string, teamId: string): Promise<void>;
  unregisterPlayer(playerId: string): Promise<void>;
};

export type RosterFacts = {
  principal: Principal | null;
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  clubId: string;
  teamId: string;
  teamActive: boolean;
};

function assertSignedIn(facts: RosterFacts): void {
  if (facts.principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      rosterMessages.unauthenticated,
    );
  }
}

function assertTeam(facts: RosterFacts): void {
  const parsed = z
    .strictObject({ clubId: idSchema, teamId: idSchema })
    .safeParse({ clubId: facts.clubId, teamId: facts.teamId });
  if (!parsed.success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      rosterMessages.validationFailed,
    );
  }
}

function allowed(facts: RosterFacts, capability: string): boolean {
  return (
    evaluateCapability({
      clubMemberships: facts.clubMemberships,
      teamMemberships: facts.teamMemberships,
      guardianLinks: facts.guardianLinks,
      registrations: facts.registrations,
      resource: {
        clubId: facts.clubId,
        teamId: facts.teamId,
        teamActive: facts.teamActive,
      },
      capability,
    }) === "allow"
  );
}

function entriesForTeam(
  teamId: string,
  entries: readonly RosterEntry[],
): RosterEntry[] {
  return entries.map((entry) => {
    const parsed = rosterEntrySchema.safeParse(entry);
    if (!parsed.success || parsed.data.teamId !== teamId) {
      throw new ApplicationError("INTERNAL", rosterMessages.readFailed);
    }
    return parsed.data;
  });
}

export async function listTeamRoster(
  input: RosterFacts & { reader: RosterReader },
): Promise<TeamRoster> {
  assertSignedIn(input);
  assertTeam(input);
  const full = allowed(input, "roster.read_full");
  const masked = allowed(input, "roster.read_masked");
  if (!full && !masked) {
    throw new ApplicationError("FORBIDDEN", rosterMessages.forbidden);
  }

  const loaded = full
    ? await input.reader.listFull(input.teamId)
    : await input.reader.listMasked(input.teamId);

  return {
    teamId: input.teamId,
    visibility: full ? "full" : "masked",
    canManage: allowed(input, "roster.manage"),
    entries: entriesForTeam(input.teamId, loaded),
  };
}

export async function registerRosterPlayer(
  input: RosterFacts & { playerId: string; writer: RosterWriter },
): Promise<void> {
  assertSignedIn(input);
  assertTeam(input);
  if (!idSchema.safeParse(input.playerId).success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      rosterMessages.validationFailed,
    );
  }
  if (!allowed(input, "roster.manage")) {
    throw new ApplicationError("FORBIDDEN", rosterMessages.forbidden);
  }
  await input.writer.registerPlayer(input.playerId, input.teamId);
}

export async function unregisterRosterPlayer(
  input: RosterFacts & { playerId: string; writer: RosterWriter },
): Promise<void> {
  assertSignedIn(input);
  assertTeam(input);
  if (!idSchema.safeParse(input.playerId).success) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      rosterMessages.validationFailed,
    );
  }
  if (!allowed(input, "roster.manage")) {
    throw new ApplicationError("FORBIDDEN", rosterMessages.forbidden);
  }
  await input.writer.unregisterPlayer(input.playerId);
}
