import {
  ApplicationError,
  CLUB_READ_CAPABILITY,
  currentClubContextSchema,
  type ClubMembershipRecord,
  type CurrentClubContext,
  type GetCurrentClubContext,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";

const UNAUTHENTICATED_MESSAGE = "Authentication is required.";
const READER_FAILURE_MESSAGE = "Club context could not be read.";
const VALIDATION_FAILED_MESSAGE = "Club context failed validation.";

function selectActiveMembership(
  memberships: readonly ClubMembershipRecord[],
): ClubMembershipRecord | null {
  let selected: ClubMembershipRecord | null = null;

  for (const membership of memberships) {
    if (!membership.active) {
      continue;
    }

    if (selected === null || membership.clubId < selected.clubId) {
      selected = membership;
    }
  }

  return selected;
}

export const getCurrentClubContext: GetCurrentClubContext = async (input) => {
  if (input.principal === null) {
    throw new ApplicationError("UNAUTHENTICATED", UNAUTHENTICATED_MESSAGE);
  }

  const principal = input.principal;

  let readResult;
  try {
    readResult = await input.reader.read(principal.userId);
  } catch {
    throw new ApplicationError("INTERNAL", READER_FAILURE_MESSAGE);
  }

  const selected = selectActiveMembership(readResult.memberships);
  const capabilities: CurrentClubContext["capabilities"] = [];

  if (selected !== null) {
    const decision = evaluateCapability({
      memberships: readResult.memberships.map((membership) => ({
        clubId: membership.clubId,
        role: membership.role,
        active: membership.active,
      })),
      capability: CLUB_READ_CAPABILITY,
      clubId: selected.clubId,
    });

    if (decision === "allow") {
      capabilities.push(CLUB_READ_CAPABILITY);
    }
  }

  const parsed = currentClubContextSchema.safeParse({
    userId: principal.userId,
    displayName: readResult.displayName,
    club: selected === null ? null : selected.club,
    activeTeam: null,
    capabilities,
    managedPlayerIds: [],
  });

  if (!parsed.success) {
    throw new ApplicationError("VALIDATION_FAILED", VALIDATION_FAILED_MESSAGE);
  }

  return parsed.data;
};
