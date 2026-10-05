import {
  CLUB_READ_CAPABILITY,
  type ClubMembershipRole,
  type EvaluateCapability,
  type MembershipFact,
} from "@stable/contracts";

export type {
  Capability,
  CapabilityDecision,
  EvaluateCapability,
  MembershipFact,
} from "@stable/contracts";

const CLUB_ADMIN_ROLE = "CLUB_ADMIN" satisfies ClubMembershipRole;

function isActiveClubAdmin(
  membership: MembershipFact,
  clubId: string,
): boolean {
  const role: string = membership.role;

  return (
    membership.active &&
    membership.clubId === clubId &&
    role === CLUB_ADMIN_ROLE
  );
}

/**
 * Allows `club.read` only for an active CLUB_ADMIN membership of `clubId`.
 * Membership facts are the only input. A role field on the input object is not read.
 */
export const evaluateCapability: EvaluateCapability = (input) => {
  if (input.capability !== CLUB_READ_CAPABILITY) {
    return "deny";
  }

  const allowed = input.memberships.some((membership) =>
    isActiveClubAdmin(membership, input.clubId),
  );

  return allowed ? "allow" : "deny";
};
