import type { ClubContextReadResult, Principal } from "@stable/contracts";
import type { FixtureAccess } from "@stable/fixtures";

export function fixtureAccessFrom(
  principal: Principal | null,
  facts: ClubContextReadResult,
  teamActive: boolean,
): FixtureAccess {
  return {
    principal,
    clubMemberships: facts.memberships.map((membership) => ({
      clubId: membership.clubId,
      role: membership.role,
      active: membership.active,
    })),
    teamMemberships: facts.teamMemberships,
    guardianLinks: facts.guardianLinks,
    registrations: facts.registrations,
    teamActive,
  };
}
