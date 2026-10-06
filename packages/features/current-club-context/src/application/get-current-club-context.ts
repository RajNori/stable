import {
  ApplicationError,
  CLUB_CONTEXT_CAPABILITIES,
  currentClubContextSchema,
  type ClubContextReadResult,
  type ClubMembershipRecord,
  type ClubSummary,
  type CurrentClubContext,
  type GetCurrentClubContext,
  type GuardianLinkRecord,
  type RegistrationRecord,
  type TeamContext,
  type TeamMembershipRecord,
  type TeamRecord,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";

const UNAUTHENTICATED_MESSAGE = "Authentication is required.";
const READER_FAILURE_MESSAGE = "Club context could not be read.";
const VALIDATION_FAILED_MESSAGE = "Club context failed validation.";

function selectClubId(clubIds: readonly string[]): string | null {
  let selected: string | null = null;

  for (const clubId of clubIds) {
    if (selected === null || clubId < selected) {
      selected = clubId;
    }
  }

  return selected;
}

function eligibleClubIds(readResult: ClubContextReadResult): string[] {
  const clubIds: string[] = [];

  for (const membership of readResult.memberships) {
    if (membership.active) {
      clubIds.push(membership.clubId);
    }
  }

  for (const membership of readResult.teamMemberships) {
    if (membership.active && membership.teamActive) {
      clubIds.push(membership.clubId);
    }
  }

  for (const link of readResult.guardianLinks) {
    if (!link.active || !link.playerActive) {
      continue;
    }

    const registered = readResult.registrations.some(
      (registration) =>
        registration.active &&
        registration.teamActive &&
        registration.clubId === link.clubId &&
        registration.playerId === link.playerId,
    );
    if (registered) {
      clubIds.push(link.clubId);
    }
  }

  return clubIds;
}

function clubSummaryFor(
  clubId: string,
  memberships: readonly ClubMembershipRecord[],
  clubs: readonly ClubSummary[],
): ClubSummary | null {
  for (const membership of memberships) {
    if (membership.clubId === clubId) {
      return membership.club;
    }
  }

  for (const club of clubs) {
    if (club.id === clubId) {
      return club;
    }
  }

  return null;
}

function teamName(teamId: string, teams: readonly TeamRecord[]): string | null {
  for (const team of teams) {
    if (team.id === teamId && team.active) {
      return team.name;
    }
  }

  return null;
}

function availableTeams(
  clubId: string,
  teamMemberships: readonly TeamMembershipRecord[],
  guardianLinks: readonly GuardianLinkRecord[],
  registrations: readonly RegistrationRecord[],
  teams: readonly TeamRecord[],
): TeamContext[] {
  const names = new Map<string, string>();

  for (const membership of teamMemberships) {
    if (
      !membership.active ||
      !membership.teamActive ||
      membership.clubId !== clubId
    ) {
      continue;
    }

    const name = teamName(membership.teamId, teams);
    if (name !== null) {
      names.set(membership.teamId, name);
    }
  }

  for (const link of guardianLinks) {
    if (!link.active || !link.playerActive || link.clubId !== clubId) {
      continue;
    }

    for (const registration of registrations) {
      if (
        !registration.active ||
        !registration.teamActive ||
        registration.clubId !== clubId ||
        registration.playerId !== link.playerId
      ) {
        continue;
      }

      const name = teamName(registration.teamId, teams);
      if (name !== null) {
        names.set(registration.teamId, name);
      }
    }
  }

  return [...names.entries()]
    .sort(([left], [right]) => (left < right ? -1 : 1))
    .map(([id, name]) => ({ id, name }));
}

function managedPlayerIds(
  clubId: string,
  guardianLinks: readonly GuardianLinkRecord[],
  registrations: readonly RegistrationRecord[],
): string[] {
  const playerIds = new Set<string>();

  for (const link of guardianLinks) {
    if (!link.active || !link.playerActive || link.clubId !== clubId) {
      continue;
    }

    const registered = registrations.some(
      (registration) =>
        registration.active &&
        registration.teamActive &&
        registration.clubId === clubId &&
        registration.playerId === link.playerId,
    );
    if (registered) {
      playerIds.add(link.playerId);
    }
  }

  return [...playerIds].sort();
}

function clubCapabilities(
  readResult: ClubContextReadResult,
  clubId: string,
): CurrentClubContext["capabilities"] {
  const capabilities: CurrentClubContext["capabilities"] = [];
  const facts = {
    clubMemberships: readResult.memberships.map((membership) => ({
      clubId: membership.clubId,
      role: membership.role,
      active: membership.active,
    })),
    teamMemberships: readResult.teamMemberships,
    guardianLinks: readResult.guardianLinks,
    registrations: readResult.registrations,
    resource: { clubId },
  };

  for (const capability of CLUB_CONTEXT_CAPABILITIES) {
    if (evaluateCapability({ ...facts, capability }) === "allow") {
      capabilities.push(capability);
    }
  }

  return capabilities;
}

export const getCurrentClubContext: GetCurrentClubContext = async (input) => {
  if (input.principal === null) {
    throw new ApplicationError("UNAUTHENTICATED", UNAUTHENTICATED_MESSAGE);
  }

  const principal = input.principal;

  let readResult: ClubContextReadResult;
  try {
    readResult = await input.reader.read(principal.userId);
  } catch {
    throw new ApplicationError("INTERNAL", READER_FAILURE_MESSAGE);
  }

  const selectedClubId = selectClubId(eligibleClubIds(readResult));
  const club =
    selectedClubId === null
      ? null
      : clubSummaryFor(
          selectedClubId,
          readResult.memberships,
          readResult.clubs,
        );
  if (selectedClubId !== null && club === null) {
    throw new ApplicationError("VALIDATION_FAILED", VALIDATION_FAILED_MESSAGE);
  }

  const teams =
    selectedClubId === null
      ? []
      : availableTeams(
          selectedClubId,
          readResult.teamMemberships,
          readResult.guardianLinks,
          readResult.registrations,
          readResult.teams,
        );
  const activeTeam = teams.length === 1 ? (teams[0] ?? null) : null;

  const parsed = currentClubContextSchema.safeParse({
    userId: principal.userId,
    displayName: readResult.displayName,
    club,
    activeTeam,
    availableTeams: teams,
    capabilities:
      selectedClubId === null
        ? []
        : clubCapabilities(readResult, selectedClubId),
    managedPlayerIds:
      selectedClubId === null
        ? []
        : managedPlayerIds(
            selectedClubId,
            readResult.guardianLinks,
            readResult.registrations,
          ),
  });

  if (!parsed.success) {
    throw new ApplicationError("VALIDATION_FAILED", VALIDATION_FAILED_MESSAGE);
  }

  return parsed.data;
};
