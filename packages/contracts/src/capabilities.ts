export const CLUB_MEMBERSHIP_ROLES = ["CLUB_ADMIN"] as const;

export type ClubMembershipRole = (typeof CLUB_MEMBERSHIP_ROLES)[number];

export const CLUB_READ_CAPABILITY = "club.read" as const;

export const KNOWN_CAPABILITIES = [CLUB_READ_CAPABILITY] as const;

export type Capability = (typeof KNOWN_CAPABILITIES)[number];

export type MembershipFact = {
  clubId: string;
  role: ClubMembershipRole;
  active: boolean;
};

export type CapabilityDecision = "allow" | "deny";

export type EvaluateCapability = (input: {
  memberships: readonly MembershipFact[];
  capability: string;
  clubId: string;
}) => CapabilityDecision;
