import { ApplicationError } from "@stable/contracts";
import type {
  GuardianLinkFact,
  MembershipFact,
  PlayerTeamRegistrationFact,
  Principal,
  TeamMembershipFact,
} from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  listTeamRoster,
  registerRosterPlayer,
  rosterMessages,
  unregisterRosterPlayer,
} from "./roster-commands.js";
import type {
  RosterEntry,
  RosterFacts,
  RosterReader,
  RosterWriter,
} from "./roster-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "99999999-9999-4999-8999-999999999999";
const otherTeamId = "88888888-8888-4888-8888-888888888888";
const playerId = "18181818-1818-4818-8818-181818181818";
const principal: Principal = {
  userId: "19191919-1919-4919-8919-191919191919",
};

const admin: MembershipFact = {
  clubId,
  role: "CLUB_ADMIN",
  active: true,
};

function staff(role: TeamMembershipFact["role"]): TeamMembershipFact {
  return {
    clubId,
    teamId,
    role,
    active: true,
    teamActive: true,
  };
}

const guardianLink: GuardianLinkFact = {
  clubId,
  playerId,
  active: true,
  playerActive: true,
};

const registration: PlayerTeamRegistrationFact = {
  clubId,
  teamId,
  playerId,
  active: true,
  teamActive: true,
};

function facts(overrides: Partial<RosterFacts> = {}): RosterFacts {
  return {
    principal,
    clubMemberships: [],
    teamMemberships: [],
    guardianLinks: [],
    registrations: [],
    clubId,
    teamId,
    teamActive: true,
    ...overrides,
  };
}

function reader(entries: readonly RosterEntry[]): RosterReader & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    listMasked: (requested) => {
      calls.push(`masked:${requested}`);
      return Promise.resolve(entries);
    },
    listFull: (requested) => {
      calls.push(`full:${requested}`);
      return Promise.resolve(entries);
    },
  };
}

function writer(): RosterWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    registerPlayer: (requestedPlayer, requestedTeam) => {
      calls.push(`register:${requestedPlayer}:${requestedTeam}`);
      return Promise.resolve();
    },
    unregisterPlayer: (requestedPlayer) => {
      calls.push(`unregister:${requestedPlayer}`);
      return Promise.resolve();
    },
  };
}

describe("team roster projection", () => {
  it("gives a guardian the masked roster and no manage grant", async () => {
    const source = reader([{ playerId, teamId, name: "Alexander R." }]);

    const roster = await listTeamRoster({
      ...facts({
        guardianLinks: [guardianLink],
        registrations: [registration],
      }),
      reader: source,
    });

    expect(roster.visibility).toBe("masked");
    expect(roster.canManage).toBe(false);
    expect(roster.entries).toEqual([
      { playerId, teamId, name: "Alexander R." },
    ]);
    expect(source.calls).toEqual([`masked:${teamId}`]);
    expect(JSON.stringify(roster)).not.toContain("Robertson");
  });

  it("gives staff the registered name and only a manager the manage grant", async () => {
    const coach = reader([{ playerId, teamId, name: "Alexander Robertson" }]);
    const coachRoster = await listTeamRoster({
      ...facts({ teamMemberships: [staff("HEAD_COACH")] }),
      reader: coach,
    });
    expect(coachRoster.visibility).toBe("full");
    expect(coachRoster.canManage).toBe(false);
    expect(coach.calls).toEqual([`full:${teamId}`]);

    const assistant = reader([
      { playerId, teamId, name: "Alexander Robertson" },
    ]);
    const assistantRoster = await listTeamRoster({
      ...facts({ teamMemberships: [staff("ASSISTANT_COACH")] }),
      reader: assistant,
    });
    expect(assistantRoster.canManage).toBe(false);

    const manager = reader([{ playerId, teamId, name: "Alexander Robertson" }]);
    const managerRoster = await listTeamRoster({
      ...facts({ teamMemberships: [staff("TEAM_MANAGER")] }),
      reader: manager,
    });
    expect(managerRoster.visibility).toBe("full");
    expect(managerRoster.canManage).toBe(true);
    expect(managerRoster.entries[0]?.name).toBe("Alexander Robertson");
  });

  it("gives a club admin the full roster and manage grant", async () => {
    const source = reader([{ playerId, teamId, name: "Alexander Robertson" }]);
    const roster = await listTeamRoster({
      ...facts({ clubMemberships: [admin] }),
      reader: source,
    });
    expect(roster.visibility).toBe("full");
    expect(roster.canManage).toBe(true);
    expect(source.calls).toEqual([`full:${teamId}`]);
  });

  it("denies an outsider, another team, and an inactive team before reading", async () => {
    const source = reader([]);
    await expect(
      listTeamRoster({ ...facts(), reader: source }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: rosterMessages.forbidden,
    });
    await expect(
      listTeamRoster({
        ...facts({
          guardianLinks: [guardianLink],
          registrations: [{ ...registration, teamId: otherTeamId }],
          teamId,
        }),
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      listTeamRoster({
        ...facts({ clubMemberships: [admin], teamActive: false }),
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(source.calls).toEqual([]);
  });

  it("rejects a projection that names another team", async () => {
    await expect(
      listTeamRoster({
        ...facts({ clubMemberships: [admin] }),
        reader: reader([{ playerId, teamId: otherTeamId, name: "Noah Side" }]),
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: rosterMessages.readFailed,
    });
  });

  it("requires a signed-in adult and a valid team", async () => {
    const source = reader([]);
    await expect(
      listTeamRoster({ ...facts({ principal: null }), reader: source }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      listTeamRoster({
        ...facts({ clubMemberships: [admin], teamId: "team" }),
        reader: source,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(source.calls).toEqual([]);
  });
});

describe("roster management", () => {
  it("lets a team manager and a club admin change that team", async () => {
    const manager = writer();
    await registerRosterPlayer({
      ...facts({ teamMemberships: [staff("TEAM_MANAGER")] }),
      playerId,
      writer: manager,
    });
    await unregisterRosterPlayer({
      ...facts({ teamMemberships: [staff("TEAM_MANAGER")] }),
      playerId,
      writer: manager,
    });
    const clubAdmin = writer();
    await registerRosterPlayer({
      ...facts({ clubMemberships: [admin] }),
      playerId,
      writer: clubAdmin,
    });
    expect(manager.calls).toEqual([
      `register:${playerId}:${teamId}`,
      `unregister:${playerId}`,
    ]);
    expect(clubAdmin.calls).toEqual([`register:${playerId}:${teamId}`]);
  });

  it("keeps coaches and guardians from changing the roster", async () => {
    const changes = writer();
    await expect(
      registerRosterPlayer({
        ...facts({ teamMemberships: [staff("HEAD_COACH")] }),
        playerId,
        writer: changes,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      unregisterRosterPlayer({
        ...facts({
          guardianLinks: [guardianLink],
          registrations: [registration],
        }),
        playerId,
        writer: changes,
      }),
    ).rejects.toMatchObject({ message: rosterMessages.forbidden });
    expect(changes.calls).toEqual([]);
  });
});
