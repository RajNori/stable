export const CLUB_MEMBERSHIP_ROLES = ["CLUB_ADMIN"] as const;

export type ClubMembershipRole = (typeof CLUB_MEMBERSHIP_ROLES)[number];

export const TEAM_STAFF_ROLES = [
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
] as const;

export type TeamStaffRole = (typeof TEAM_STAFF_ROLES)[number];

export const CLUB_READ_CAPABILITY = "club.read" as const;

export const CLUB_CONTEXT_CAPABILITIES = [
  CLUB_READ_CAPABILITY,
  "club.manage",
  "teams.create",
  "teams.manage",
  "people.read",
  "people.manage",
  "staff.assign",
  "audit.read",
] as const;

export const TEAM_CAPABILITIES = [
  "team.read",
  "roster.read_masked",
  "roster.read_full",
  "roster.manage",
  "coach_checkin",
  "fixture.read",
  "fixture.manage_manual",
  "fixture.overlay_manage",
  "attendance.read_team",
  "training.manage",
  "announcement.publish",
  "announcement.read",
  "announcement.ack",
  "duty.manage",
  "duty.respond",
  "fillin.manage",
] as const;

export const PLAYER_CAPABILITIES = [
  "attendance.manage_managed_player",
] as const;

export const KNOWN_CAPABILITIES = [
  ...CLUB_CONTEXT_CAPABILITIES,
  ...TEAM_CAPABILITIES,
  ...PLAYER_CAPABILITIES,
] as const;

export type Capability = (typeof KNOWN_CAPABILITIES)[number];

export type ClubContextCapability = (typeof CLUB_CONTEXT_CAPABILITIES)[number];

export type MembershipFact = {
  clubId: string;
  role: ClubMembershipRole;
  active: boolean;
};

export type TeamMembershipFact = {
  clubId: string;
  teamId: string;
  role: TeamStaffRole;
  active: boolean;
  teamActive: boolean;
};

export type GuardianLinkFact = {
  clubId: string;
  playerId: string;
  active: boolean;
  playerActive: boolean;
};

export type PlayerTeamRegistrationFact = {
  clubId: string;
  teamId: string;
  playerId: string;
  active: boolean;
  teamActive: boolean;
};

export type CapabilityResource = {
  clubId: string;
  teamId?: string;
  teamActive?: boolean;
  playerId?: string;
};

export type CapabilityDecision = "allow" | "deny";

export type EvaluateCapability = (input: {
  clubMemberships: readonly MembershipFact[];
  teamMemberships: readonly TeamMembershipFact[];
  guardianLinks: readonly GuardianLinkFact[];
  registrations: readonly PlayerTeamRegistrationFact[];
  resource: CapabilityResource;
  capability: string;
}) => CapabilityDecision;
