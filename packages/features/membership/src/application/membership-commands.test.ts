import { ApplicationError } from "@stable/contracts";
import type { MembershipFact, Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  assignTeamRole,
  membershipMessages,
  reactivateTeamRole,
  registerPlayerOnTeam,
  revokeTeamRole,
  unregisterPlayerFromTeam,
} from "./membership-commands.js";
import type { MembershipWriter } from "./membership-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "17171717-1717-4717-8717-171717171717";
const userId = "19191919-1919-4919-8919-19191919191a";
const playerId = "18181818-1818-4818-8818-181818181818";
const principal: Principal = { userId: "19191919-1919-4919-8919-191919191919" };
const admin: MembershipFact = {
  clubId,
  role: "CLUB_ADMIN",
  active: true,
};

function writer(): MembershipWriter & { calls: string[] } {
  const calls: string[] = [];
  const staff = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    clubId,
    teamId,
    userId,
    role: "HEAD_COACH" as const,
    active: true,
  };
  const registration = {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    clubId,
    teamId,
    playerId,
    active: true,
  };
  return {
    calls,
    assignTeamRole: async () => {
      calls.push("assign");
      return staff;
    },
    revokeTeamRole: async () => {
      calls.push("revoke");
      return { ...staff, active: false };
    },
    reactivateTeamRole: async () => {
      calls.push("reactivate");
      return staff;
    },
    registerPlayer: async () => {
      calls.push("register");
      return registration;
    },
    unregisterPlayer: async () => {
      calls.push("unregister");
      return { ...registration, active: false };
    },
  };
}

describe("membership commands", () => {
  it("assigns a staff role for an active club admin", async () => {
    const sink = writer();
    const result = await assignTeamRole({
      principal,
      memberships: [admin],
      clubId,
      teamId,
      userId,
      role: "HEAD_COACH",
      writer: sink,
    });

    expect(sink.calls).toEqual(["assign"]);
    expect(result.role).toBe("HEAD_COACH");
  });

  it("rejects a guardian role, another club, and a signed-out caller", async () => {
    const sink = writer();
    await expect(
      assignTeamRole({
        principal,
        memberships: [admin],
        clubId,
        teamId,
        userId,
        role: "GUARDIAN" as "HEAD_COACH",
        writer: sink,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: membershipMessages.validationFailed,
    });
    await expect(
      revokeTeamRole({
        principal,
        memberships: [{ ...admin, clubId: teamId }],
        clubId,
        teamId,
        userId,
        role: "HEAD_COACH",
        writer: sink,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      registerPlayerOnTeam({
        principal: null,
        memberships: [admin],
        clubId,
        playerId,
        teamId,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(sink.calls).toEqual([]);
  });

  it("reactivates, registers, and unregisters for an active admin", async () => {
    const sink = writer();
    await expect(
      reactivateTeamRole({
        principal,
        memberships: [admin],
        clubId,
        teamId,
        userId,
        role: "HEAD_COACH",
        writer: sink,
      }),
    ).resolves.toMatchObject({ active: true });
    await expect(
      registerPlayerOnTeam({
        principal,
        memberships: [admin],
        clubId,
        playerId,
        teamId,
        writer: sink,
      }),
    ).resolves.toMatchObject({ playerId });
    await expect(
      unregisterPlayerFromTeam({
        principal,
        memberships: [{ ...admin, active: false }],
        clubId,
        playerId,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      registerPlayerOnTeam({
        principal,
        memberships: [admin],
        clubId,
        playerId: "not-a-player",
        teamId,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      unregisterPlayerFromTeam({
        principal,
        memberships: [admin],
        clubId,
        playerId: "not-a-player",
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      unregisterPlayerFromTeam({
        principal,
        memberships: [{ ...admin, role: "HEAD_COACH" as "CLUB_ADMIN" }],
        clubId,
        playerId,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(sink.calls).toEqual(["reactivate", "register"]);
  });
});
