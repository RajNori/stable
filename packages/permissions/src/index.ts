import {
  CLUB_READ_CAPABILITY,
  type ClubMembershipRole,
  type EvaluateCapability,
  type GuardianLinkFact,
  type MembershipFact,
  type PlayerTeamRegistrationFact,
  type TeamMembershipFact,
  type TeamStaffRole,
} from "@stable/contracts";

export type {
  Capability,
  CapabilityDecision,
  EvaluateCapability,
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  TeamMembershipFact,
} from "@stable/contracts";

const CLUB_ADMIN_ROLE = "CLUB_ADMIN" satisfies ClubMembershipRole;

const CLUB_ADMIN_CAPABILITIES = new Set<string>([
  "club.manage",
  "teams.create",
  "teams.manage",
  "people.read",
  "people.manage",
  "staff.assign",
  "audit.read",
]);

const COACH_ROLES = new Set<TeamStaffRole>(["HEAD_COACH", "ASSISTANT_COACH"]);
const HEAD_COACH_ROLES = new Set<TeamStaffRole>(["HEAD_COACH"]);
const TEAM_MANAGER_ROLES = new Set<TeamStaffRole>(["TEAM_MANAGER"]);

function isActiveClubAdmin(
  memberships: readonly MembershipFact[],
  clubId: string,
): boolean {
  return memberships.some((membership) => {
    const role: string = membership.role;
    return (
      membership.active &&
      membership.clubId === clubId &&
      role === CLUB_ADMIN_ROLE
    );
  });
}

function activeStaff(
  memberships: readonly TeamMembershipFact[],
  clubId: string,
  teamId: string | undefined,
  roles?: ReadonlySet<TeamStaffRole>,
): boolean {
  return memberships.some(
    (membership) =>
      membership.active &&
      membership.teamActive &&
      membership.clubId === clubId &&
      (teamId === undefined || membership.teamId === teamId) &&
      (roles === undefined || roles.has(membership.role)),
  );
}

function derivedRegistration(
  links: readonly GuardianLinkFact[],
  registrations: readonly PlayerTeamRegistrationFact[],
  clubId: string,
  teamId: string | undefined,
  playerId: string | undefined,
): boolean {
  return links.some(
    (link) =>
      link.active &&
      link.playerActive &&
      link.clubId === clubId &&
      (playerId === undefined || link.playerId === playerId) &&
      registrations.some(
        (registration) =>
          registration.active &&
          registration.teamActive &&
          registration.clubId === clubId &&
          registration.playerId === link.playerId &&
          (teamId === undefined || registration.teamId === teamId),
      ),
  );
}

function teamScoped(
  input: Parameters<EvaluateCapability>[0],
  clubId: string,
): "allow" | "deny" {
  const teamId = input.resource.teamId;
  if (teamId === undefined || input.resource.teamActive !== true) {
    return "deny";
  }

  const admin = isActiveClubAdmin(input.clubMemberships, clubId);
  const staff = activeStaff(input.teamMemberships, clubId, teamId);
  const coach = activeStaff(input.teamMemberships, clubId, teamId, COACH_ROLES);
  const manager = activeStaff(
    input.teamMemberships,
    clubId,
    teamId,
    new Set<TeamStaffRole>(["TEAM_MANAGER"]),
  );
  const guardian = derivedRegistration(
    input.guardianLinks,
    input.registrations,
    clubId,
    teamId,
    undefined,
  );

  if (
    input.capability === "team.read" ||
    input.capability === "roster.read_masked"
  ) {
    return admin || staff || guardian ? "allow" : "deny";
  }
  if (input.capability === "roster.read_full") {
    return admin || staff ? "allow" : "deny";
  }
  if (input.capability === "roster.manage") {
    return admin || manager ? "allow" : "deny";
  }
  return coach ? "allow" : "deny";
}

function playerScoped(
  input: Parameters<EvaluateCapability>[0],
  clubId: string,
): "allow" | "deny" {
  const teamId = input.resource.teamId;
  const playerId = input.resource.playerId;
  if (
    teamId === undefined ||
    playerId === undefined ||
    input.resource.teamActive !== true
  ) {
    return "deny";
  }

  return derivedRegistration(
    input.guardianLinks,
    input.registrations,
    clubId,
    teamId,
    playerId,
  )
    ? "allow"
    : "deny";
}

/**
 * Contextual capability decision. Facts are the only input. A role field on
 * the input object is not read. Grants are the union of active paths.
 */
export const evaluateCapability: EvaluateCapability = (input) => {
  const clubId = input.resource.clubId;

  if (input.capability === CLUB_READ_CAPABILITY) {
    const allowed =
      isActiveClubAdmin(input.clubMemberships, clubId) ||
      activeStaff(input.teamMemberships, clubId, undefined) ||
      derivedRegistration(
        input.guardianLinks,
        input.registrations,
        clubId,
        undefined,
        undefined,
      );
    return allowed ? "allow" : "deny";
  }

  if (CLUB_ADMIN_CAPABILITIES.has(input.capability)) {
    return isActiveClubAdmin(input.clubMemberships, clubId) ? "allow" : "deny";
  }

  if (
    input.capability === "team.read" ||
    input.capability === "roster.read_masked" ||
    input.capability === "roster.read_full" ||
    input.capability === "roster.manage" ||
    input.capability === "coach_checkin"
  ) {
    return teamScoped(input, clubId);
  }

  if (
    input.capability === "private_player_note.read" ||
    input.capability === "private_player_note.write"
  ) {
    return coachOnlyTeamScoped(input, clubId);
  }

  if (input.capability === "attendance.manage_managed_player") {
    return playerScoped(input, clubId);
  }

  if (
    input.capability === "fixture.read" ||
    input.capability === "fixture.manage_manual" ||
    input.capability === "fixture.overlay_manage" ||
    input.capability === "attendance.read_team" ||
    input.capability === "training.manage" ||
    input.capability === "announcement.publish" ||
    input.capability === "announcement.read" ||
    input.capability === "announcement.ack" ||
    input.capability === "duty.manage" ||
    input.capability === "duty.respond" ||
    input.capability === "fillin.manage" ||
    input.capability === "coaching_stats.read" ||
    input.capability === "coaching_stats.write" ||
    input.capability === "post_game_review.read" ||
    input.capability === "post_game_review.write" ||
    input.capability === "recognition.read" ||
    input.capability === "recognition.write" ||
    input.capability === "practice_plan.manage"
  ) {
    return teamEventScoped(input, clubId);
  }

  return "deny";
};

function teamEventScoped(
  input: Parameters<EvaluateCapability>[0],
  clubId: string,
): "allow" | "deny" {
  const teamId = input.resource.teamId;
  if (teamId === undefined || input.resource.teamActive !== true) {
    return "deny";
  }

  const admin = isActiveClubAdmin(input.clubMemberships, clubId);
  const staff = activeStaff(input.teamMemberships, clubId, teamId);
  const headCoach = activeStaff(
    input.teamMemberships,
    clubId,
    teamId,
    HEAD_COACH_ROLES,
  );
  const coach = activeStaff(input.teamMemberships, clubId, teamId, COACH_ROLES);
  const manager = activeStaff(
    input.teamMemberships,
    clubId,
    teamId,
    TEAM_MANAGER_ROLES,
  );
  const guardian = derivedRegistration(
    input.guardianLinks,
    input.registrations,
    clubId,
    teamId,
    undefined,
  );

  if (input.capability === "fixture.read") {
    return admin || staff || guardian ? "allow" : "deny";
  }
  if (input.capability === "fixture.manage_manual") {
    return admin || manager ? "allow" : "deny";
  }
  if (input.capability === "fixture.overlay_manage") {
    return admin || headCoach || manager ? "allow" : "deny";
  }
  if (input.capability === "attendance.read_team") {
    return admin || staff ? "allow" : "deny";
  }
  if (
    input.capability === "coaching_stats.read" ||
    input.capability === "coaching_stats.write" ||
    input.capability === "post_game_review.read" ||
    input.capability === "post_game_review.write" ||
    input.capability === "recognition.read" ||
    input.capability === "recognition.write" ||
    input.capability === "practice_plan.manage"
  ) {
    return coach ? "allow" : "deny";
  }
  if (
    input.capability === "announcement.read" ||
    input.capability === "announcement.ack" ||
    input.capability === "duty.respond"
  ) {
    return admin || staff || guardian ? "allow" : "deny";
  }
  if (input.capability === "announcement.publish") {
    return admin || headCoach || manager ? "allow" : "deny";
  }
  if (input.capability === "duty.manage") {
    return admin || manager ? "allow" : "deny";
  }
  if (input.capability === "fillin.manage") {
    return admin || headCoach || manager ? "allow" : "deny";
  }
  if (input.capability === "training.manage") {
    return admin || headCoach || manager ? "allow" : "deny";
  }
  return "deny";
}

function coachOnlyTeamScoped(
  input: Parameters<EvaluateCapability>[0],
  clubId: string,
): "allow" | "deny" {
  const teamId = input.resource.teamId;
  if (teamId === undefined || input.resource.teamActive !== true) {
    return "deny";
  }

  return activeStaff(input.teamMemberships, clubId, teamId, COACH_ROLES)
    ? "allow"
    : "deny";
}
