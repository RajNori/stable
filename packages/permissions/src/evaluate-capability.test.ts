import { CLUB_READ_CAPABILITY } from "@stable/contracts";
import type {
  EvaluateCapability,
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  TeamMembershipFact,
  TeamStaffRole,
} from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { evaluateCapability } from "./index.js";

const clubId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherClubId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const teamA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const teamB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const player1 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const player2 = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const CLUB_ADMIN_CAPABILITIES = [
  "club.manage",
  "teams.create",
  "teams.manage",
  "people.read",
  "people.manage",
  "staff.assign",
  "audit.read",
] as const;

type DecisionInput = Parameters<EvaluateCapability>[0];

function admin(active = true, membershipClubId = clubId): MembershipFact {
  return { clubId: membershipClubId, role: "CLUB_ADMIN", active };
}

function staff(
  role: TeamStaffRole,
  teamId = teamA,
  active = true,
  teamActive = true,
  membershipClubId = clubId,
): TeamMembershipFact {
  return {
    clubId: membershipClubId,
    teamId,
    role,
    active,
    teamActive,
  };
}

function link(
  playerId = player1,
  active = true,
  playerActive = true,
  linkClubId = clubId,
): GuardianLinkFact {
  return { clubId: linkClubId, playerId, active, playerActive };
}

function registration(
  playerId = player1,
  teamId = teamA,
  active = true,
  teamActive = true,
  registrationClubId = clubId,
): PlayerTeamRegistrationFact {
  return {
    clubId: registrationClubId,
    teamId,
    playerId,
    active,
    teamActive,
  };
}

function decide(
  capability: string,
  resource: DecisionInput["resource"],
  facts: Partial<
    Pick<
      DecisionInput,
      "clubMemberships" | "teamMemberships" | "guardianLinks" | "registrations"
    >
  > = {},
): "allow" | "deny" {
  return evaluateCapability({
    clubMemberships: facts.clubMemberships ?? [],
    teamMemberships: facts.teamMemberships ?? [],
    guardianLinks: facts.guardianLinks ?? [],
    registrations: facts.registrations ?? [],
    resource,
    capability,
  });
}

describe("evaluateCapability", () => {
  it("active CLUB_ADMIN allows club.read", () => {
    expect(
      decide(CLUB_READ_CAPABILITY, { clubId }, { clubMemberships: [admin()] }),
    ).toBe("allow");
  });

  it("inactive membership denies club.read", () => {
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        { clubMemberships: [admin(false)] },
      ),
    ).toBe("deny");
  });

  it("missing membership denies club.read", () => {
    expect(decide(CLUB_READ_CAPABILITY, { clubId })).toBe("deny");
  });

  it("unknown capability denies", () => {
    expect(
      decide("playhq.sync", { clubId }, { clubMemberships: [admin()] }),
    ).toBe("deny");
  });

  it("extra role field does not grant access", () => {
    const misleadingRole = {
      clubMemberships: [admin()],
      teamMemberships: [],
      guardianLinks: [],
      registrations: [],
      capability: CLUB_READ_CAPABILITY,
      resource: { clubId },
      role: "GUARDIAN",
    };
    const roleWithoutMembership = {
      clubMemberships: [],
      teamMemberships: [],
      guardianLinks: [],
      registrations: [],
      capability: CLUB_READ_CAPABILITY,
      resource: { clubId },
      role: "CLUB_ADMIN",
    };

    expect(evaluateCapability(misleadingRole)).toBe("allow");
    expect(evaluateCapability(roleWithoutMembership)).toBe("deny");
  });

  it("membership for a different clubId denies club.read", () => {
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        { clubMemberships: [admin(true, otherClubId)] },
      ),
    ).toBe("deny");
  });

  it("does not treat an authenticated principal as club.read", () => {
    const principal = {
      userId: "11111111-1111-4111-8111-111111111111",
    };

    expect(principal).not.toHaveProperty("role");
    expect(principal).not.toHaveProperty("capabilities");
    expect(decide(CLUB_READ_CAPABILITY, { clubId })).toBe("deny");
  });

  it("non-admin club membership role denies club.read", () => {
    const membership = admin();
    Reflect.set(membership, "role", "HEAD_COACH");

    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        { clubMemberships: [membership] },
      ),
    ).toBe("deny");
  });

  it("grants club administration only to an active admin of that club", () => {
    for (const capability of CLUB_ADMIN_CAPABILITIES) {
      expect(
        decide(capability, { clubId }, { clubMemberships: [admin()] }),
      ).toBe("allow");
      expect(
        decide(capability, { clubId }, { clubMemberships: [admin(false)] }),
      ).toBe("deny");
      expect(
        decide(
          capability,
          { clubId },
          { clubMemberships: [admin(true, otherClubId)] },
        ),
      ).toBe("deny");
      expect(
        decide(
          capability,
          { clubId },
          { teamMemberships: [staff("HEAD_COACH")] },
        ),
      ).toBe("deny");
    }
  });

  it("allows scoped club.read for staff and guardians without club administration", () => {
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        { teamMemberships: [staff("HEAD_COACH")] },
      ),
    ).toBe("allow");
    expect(
      decide(
        "club.manage",
        { clubId },
        { teamMemberships: [staff("HEAD_COACH")] },
      ),
    ).toBe("deny");
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        {
          guardianLinks: [link()],
          registrations: [registration()],
        },
      ),
    ).toBe("allow");
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        { guardianLinks: [link()], registrations: [] },
      ),
    ).toBe("deny");
  });

  it("denies team capabilities when the team id is missing or the team is inactive", () => {
    expect(
      decide("team.read", { clubId }, { clubMemberships: [admin()] }),
    ).toBe("deny");
    expect(
      decide(
        "team.read",
        { clubId, teamId: teamA, teamActive: false },
        { clubMemberships: [admin()] },
      ),
    ).toBe("deny");
  });

  it("scopes head coach and assistant coach to their own active team", () => {
    for (const role of ["HEAD_COACH", "ASSISTANT_COACH"] as const) {
      const facts = { teamMemberships: [staff(role)] };
      const ownTeam = { clubId, teamId: teamA, teamActive: true };
      const otherTeam = { clubId, teamId: teamB, teamActive: true };

      expect(decide("team.read", ownTeam, facts)).toBe("allow");
      expect(decide("roster.read_masked", ownTeam, facts)).toBe("allow");
      expect(decide("roster.read_full", ownTeam, facts)).toBe("allow");
      expect(decide("coach_checkin", ownTeam, facts)).toBe("allow");
      expect(decide("roster.manage", ownTeam, facts)).toBe("deny");
      expect(decide("club.manage", { clubId }, facts)).toBe("deny");
      expect(decide("team.read", otherTeam, facts)).toBe("deny");
      expect(decide("coach_checkin", otherTeam, facts)).toBe("deny");
    }

    expect(
      decide(
        "team.read",
        { clubId, teamId: teamA, teamActive: true },
        { teamMemberships: [staff("HEAD_COACH", teamA, false)] },
      ),
    ).toBe("deny");
    expect(
      decide(
        "team.read",
        { clubId, teamId: teamA, teamActive: true },
        { teamMemberships: [staff("HEAD_COACH", teamA, true, false)] },
      ),
    ).toBe("deny");
  });

  it("gives a team manager roster management and not coach check-in", () => {
    const facts = { teamMemberships: [staff("TEAM_MANAGER")] };
    const ownTeam = { clubId, teamId: teamA, teamActive: true };

    expect(decide("team.read", ownTeam, facts)).toBe("allow");
    expect(decide("roster.read_masked", ownTeam, facts)).toBe("allow");
    expect(decide("roster.read_full", ownTeam, facts)).toBe("allow");
    expect(decide("roster.manage", ownTeam, facts)).toBe("allow");
    expect(decide("coach_checkin", ownTeam, facts)).toBe("deny");
    expect(
      decide(
        "roster.manage",
        { clubId, teamId: teamB, teamActive: true },
        facts,
      ),
    ).toBe("deny");
  });

  it("lets a club admin read and manage every active team in that club only", () => {
    const facts = { clubMemberships: [admin()] };
    const team = { clubId, teamId: teamB, teamActive: true };

    expect(decide("team.read", team, facts)).toBe("allow");
    expect(decide("roster.read_masked", team, facts)).toBe("allow");
    expect(decide("roster.read_full", team, facts)).toBe("allow");
    expect(decide("roster.manage", team, facts)).toBe("allow");
    expect(decide("coach_checkin", team, facts)).toBe("deny");
    expect(
      decide(
        "team.read",
        { clubId: otherClubId, teamId: teamB, teamActive: true },
        facts,
      ),
    ).toBe("deny");
  });

  it("derives guardian team access from an active registration", () => {
    const derived = {
      guardianLinks: [link()],
      registrations: [registration()],
    };
    const ownTeam = { clubId, teamId: teamA, teamActive: true };
    const playerResource = { ...ownTeam, playerId: player1 };

    expect(decide("team.read", ownTeam, derived)).toBe("allow");
    expect(decide("roster.read_masked", ownTeam, derived)).toBe("allow");
    expect(decide("roster.read_full", ownTeam, derived)).toBe("deny");
    expect(decide("roster.manage", ownTeam, derived)).toBe("deny");
    expect(
      decide("attendance.manage_managed_player", playerResource, derived),
    ).toBe("allow");
    expect(
      decide(
        "attendance.manage_managed_player",
        { ...ownTeam, playerId: player2 },
        derived,
      ),
    ).toBe("deny");
    expect(
      decide("team.read", { clubId, teamId: teamB, teamActive: true }, derived),
    ).toBe("deny");
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        {
          guardianLinks: [link(player1, false)],
          registrations: [registration()],
        },
      ),
    ).toBe("deny");
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        {
          guardianLinks: [link(player1, true, false)],
          registrations: [registration()],
        },
      ),
    ).toBe("deny");
    expect(
      decide(
        CLUB_READ_CAPABILITY,
        { clubId },
        {
          guardianLinks: [link()],
          registrations: [registration(player1, teamA, false)],
        },
      ),
    ).toBe("deny");
  });

  it("unions multi-role grants and drops only the revoked role", () => {
    const coachAndManager = {
      teamMemberships: [staff("ASSISTANT_COACH"), staff("TEAM_MANAGER")],
    };
    const ownTeam = { clubId, teamId: teamA, teamActive: true };

    expect(decide("coach_checkin", ownTeam, coachAndManager)).toBe("allow");
    expect(decide("roster.manage", ownTeam, coachAndManager)).toBe("allow");

    expect(
      decide("roster.manage", ownTeam, {
        teamMemberships: [
          staff("ASSISTANT_COACH"),
          staff("TEAM_MANAGER", teamA, false),
        ],
      }),
    ).toBe("deny");
    expect(
      decide("coach_checkin", ownTeam, {
        teamMemberships: [
          staff("ASSISTANT_COACH"),
          staff("TEAM_MANAGER", teamA, false),
        ],
      }),
    ).toBe("allow");

    const splitTeams = {
      teamMemberships: [
        staff("HEAD_COACH", teamA),
        staff("TEAM_MANAGER", teamB),
      ],
      guardianLinks: [link(player2)],
      registrations: [registration(player2, teamB)],
    };

    expect(decide("coach_checkin", ownTeam, splitTeams)).toBe("allow");
    expect(decide("roster.manage", ownTeam, splitTeams)).toBe("deny");
    expect(
      decide(
        "roster.manage",
        { clubId, teamId: teamB, teamActive: true },
        splitTeams,
      ),
    ).toBe("allow");
    expect(
      decide(
        "coach_checkin",
        { clubId, teamId: teamB, teamActive: true },
        splitTeams,
      ),
    ).toBe("deny");
    expect(
      decide(
        "attendance.manage_managed_player",
        { clubId, teamId: teamB, teamActive: true, playerId: player2 },
        splitTeams,
      ),
    ).toBe("allow");

    const adminAndGuardian = {
      clubMemberships: [admin()],
      guardianLinks: [link()],
      registrations: [registration()],
    };
    expect(decide("club.manage", { clubId }, adminAndGuardian)).toBe("allow");
    expect(
      decide(
        "attendance.manage_managed_player",
        { clubId, teamId: teamA, teamActive: true, playerId: player1 },
        adminAndGuardian,
      ),
    ).toBe("allow");
    expect(
      decide(
        "attendance.manage_managed_player",
        { clubId, teamId: teamA, teamActive: true, playerId: player1 },
        { clubMemberships: [admin()] },
      ),
    ).toBe("deny");
  });

  it("denies attendance management without a player or for another club", () => {
    const derived = {
      guardianLinks: [link()],
      registrations: [registration()],
    };

    expect(
      decide(
        "attendance.manage_managed_player",
        { clubId, teamId: teamA, teamActive: true },
        derived,
      ),
    ).toBe("deny");
    expect(
      decide(
        "attendance.manage_managed_player",
        {
          clubId: otherClubId,
          teamId: teamA,
          teamActive: true,
          playerId: player1,
        },
        derived,
      ),
    ).toBe("deny");
  });

  it("grants fixture, attendance, and training access only on an active team", () => {
    const ownTeam = { clubId, teamId: teamA, teamActive: true };
    const inactiveTeam = { clubId, teamId: teamA, teamActive: false };
    const otherTeam = { clubId, teamId: teamB, teamActive: true };
    const guardian = {
      guardianLinks: [link()],
      registrations: [registration()],
    };

    expect(
      decide("fixture.read", { clubId }, { clubMemberships: [admin()] }),
    ).toBe("deny");
    expect(
      decide("fixture.read", inactiveTeam, { clubMemberships: [admin()] }),
    ).toBe("deny");
    expect(
      decide("fixture.read", ownTeam, { clubMemberships: [admin()] }),
    ).toBe("allow");
    expect(
      decide("fixture.read", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("allow");
    expect(
      decide("fixture.read", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("allow");
    expect(
      decide("fixture.read", ownTeam, {
        teamMemberships: [staff("TEAM_MANAGER")],
      }),
    ).toBe("allow");
    expect(decide("fixture.read", ownTeam, guardian)).toBe("allow");
    expect(decide("fixture.read", ownTeam)).toBe("deny");
    expect(
      decide("fixture.read", otherTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("deny");
    expect(
      decide("fixture.read", ownTeam, {
        teamMemberships: [staff("HEAD_COACH", teamA, false)],
      }),
    ).toBe("deny");

    expect(
      decide("fixture.manage_manual", ownTeam, { clubMemberships: [admin()] }),
    ).toBe("allow");
    expect(
      decide("fixture.manage_manual", ownTeam, {
        clubMemberships: [admin(false)],
      }),
    ).toBe("deny");
    expect(
      decide("fixture.manage_manual", ownTeam, {
        teamMemberships: [staff("TEAM_MANAGER")],
      }),
    ).toBe("allow");
    expect(
      decide("fixture.manage_manual", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("deny");
    expect(
      decide("fixture.manage_manual", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("deny");
    expect(decide("fixture.manage_manual", ownTeam, guardian)).toBe("deny");
    expect(
      decide("fixture.manage_manual", ownTeam, {
        clubMemberships: [admin(true, otherClubId)],
      }),
    ).toBe("deny");

    expect(
      decide("fixture.overlay_manage", ownTeam, { clubMemberships: [admin()] }),
    ).toBe("allow");
    expect(
      decide("fixture.overlay_manage", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("allow");
    expect(
      decide("fixture.overlay_manage", ownTeam, {
        teamMemberships: [staff("TEAM_MANAGER")],
      }),
    ).toBe("allow");
    expect(
      decide("fixture.overlay_manage", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("deny");
    expect(decide("fixture.overlay_manage", ownTeam, guardian)).toBe("deny");

    expect(
      decide("attendance.read_team", ownTeam, { clubMemberships: [admin()] }),
    ).toBe("allow");
    expect(
      decide("attendance.read_team", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("allow");
    expect(decide("attendance.read_team", ownTeam, guardian)).toBe("deny");

    expect(
      decide("training.manage", ownTeam, { clubMemberships: [admin()] }),
    ).toBe("allow");
    expect(
      decide("training.manage", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("allow");
    expect(
      decide("training.manage", ownTeam, {
        teamMemberships: [staff("TEAM_MANAGER")],
      }),
    ).toBe("allow");
    expect(
      decide("training.manage", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("deny");
    expect(decide("training.manage", ownTeam, guardian)).toBe("deny");

    expect(
      decide("announcement.publish", ownTeam, { clubMemberships: [admin()] }),
    ).toBe("allow");
    expect(
      decide("announcement.publish", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("allow");
    expect(
      decide("announcement.publish", ownTeam, {
        teamMemberships: [staff("TEAM_MANAGER")],
      }),
    ).toBe("allow");
    expect(
      decide("announcement.publish", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("deny");
    expect(decide("announcement.publish", ownTeam, guardian)).toBe("deny");
    expect(decide("announcement.read", ownTeam, guardian)).toBe("allow");
    expect(
      decide("announcement.read", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("allow");
    expect(decide("announcement.read", otherTeam, guardian)).toBe("deny");
    expect(decide("announcement.ack", ownTeam, guardian)).toBe("allow");
    expect(decide("announcement.ack", ownTeam)).toBe("deny");

    expect(decide("duty.manage", ownTeam, { clubMemberships: [admin()] })).toBe(
      "allow",
    );
    expect(
      decide("duty.manage", ownTeam, {
        teamMemberships: [staff("TEAM_MANAGER")],
      }),
    ).toBe("allow");
    expect(
      decide("duty.manage", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("deny");
    expect(decide("duty.respond", ownTeam, guardian)).toBe("allow");
    expect(decide("duty.respond", ownTeam)).toBe("deny");

    expect(
      decide("fillin.manage", ownTeam, {
        teamMemberships: [staff("HEAD_COACH")],
      }),
    ).toBe("allow");
    expect(
      decide("fillin.manage", ownTeam, {
        teamMemberships: [staff("ASSISTANT_COACH")],
      }),
    ).toBe("deny");
    expect(decide("fillin.manage", ownTeam, guardian)).toBe("deny");
  });

  it("applies the frozen Milestone 4 coaching capability matrix", () => {
    const ownTeam = { clubId, teamId: teamA, teamActive: true };
    const otherTeam = { clubId, teamId: teamB, teamActive: true };
    const inactiveTeam = { clubId, teamId: teamA, teamActive: false };
    const coachingCapabilities = [
      "coaching_stats.read",
      "coaching_stats.write",
      "post_game_review.read",
      "post_game_review.write",
      "recognition.read",
      "recognition.write",
      "private_player_note.read",
      "private_player_note.write",
      "practice_plan.manage",
    ];

    for (const capability of coachingCapabilities) {
      expect(
        decide(capability, ownTeam, { clubMemberships: [admin()] }),
        `${capability} denies a Club Admin without coaching membership`,
      ).toBe("deny");
      expect(
        decide(capability, ownTeam, {
          clubMemberships: [admin()],
          teamMemberships: [staff("ASSISTANT_COACH")],
        }),
        `${capability} allows a dual-role Club Admin through active coaching membership`,
      ).toBe("allow");
      expect(
        decide(capability, ownTeam, {
          guardianLinks: [link()],
          registrations: [registration()],
          teamMemberships: [staff("HEAD_COACH")],
        }),
        `${capability} allows a Guardian only through active coach membership`,
      ).toBe("allow");
      expect(
        decide(capability, ownTeam, {
          clubMemberships: [admin()],
          teamMemberships: [staff("HEAD_COACH", teamA, false)],
        }),
        `${capability} denies a dual-role Club Admin after coach membership revocation`,
      ).toBe("deny");
      expect(
        decide(capability, ownTeam, { clubMemberships: [admin(false)] }),
      ).toBe("deny");
      expect(
        decide(capability, ownTeam, {
          clubMemberships: [admin(true, otherClubId)],
        }),
      ).toBe("deny");
      expect(
        decide(capability, ownTeam),
        `${capability} denies outsider/anonymous`,
      ).toBe("deny");
    }

    for (const capability of coachingCapabilities) {
      for (const role of ["HEAD_COACH", "ASSISTANT_COACH"] as const) {
        const facts = { teamMemberships: [staff(role)] };
        expect(decide(capability, ownTeam, facts)).toBe("allow");
        expect(decide(capability, otherTeam, facts)).toBe("deny");
        expect(
          decide(capability, ownTeam, {
            teamMemberships: [staff(role, teamA, false)],
          }),
        ).toBe("deny");
        expect(
          decide(capability, ownTeam, {
            teamMemberships: [staff(role, teamA, true, false)],
          }),
        ).toBe("deny");
        expect(
          decide(capability, inactiveTeam, {
            teamMemberships: [staff(role)],
          }),
        ).toBe("deny");
      }

      expect(
        decide(capability, ownTeam, {
          teamMemberships: [staff("TEAM_MANAGER")],
        }),
      ).toBe("deny");
      expect(
        decide(capability, ownTeam, {
          guardianLinks: [link()],
          registrations: [registration()],
        }),
      ).toBe("deny");
    }
  });
});
