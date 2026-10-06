import { ApplicationError } from "@stable/contracts";
import type { MembershipFact, Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  acceptInvitation,
  createInvitation,
  invitationMessages,
  listInvitations,
  revokeInvitation,
} from "./invitation-commands.js";
import type { InvitationWriter } from "./invitation-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "17171717-1717-4717-8717-171717171717";
const playerId = "18181818-1818-4818-8818-181818181818";
const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "a".repeat(64);
const principal: Principal = { userId: "19191919-1919-4919-8919-191919191919" };
const admin: MembershipFact = {
  clubId,
  role: "CLUB_ADMIN",
  active: true,
};

function writer(): InvitationWriter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    createInvitation: async (command) => {
      calls.push("create");
      return {
        id: invitationId,
        token,
        expiresAt: "2026-10-13T00:00:00.000Z",
        ...command,
      };
    },
    revokeInvitation: async () => {
      calls.push("revoke");
    },
    acceptInvitation: async () => {
      calls.push("accept");
      return {
        invitationId,
        inviteType: "GUARDIAN",
        clubId,
        teamId: null,
        playerId,
      };
    },
    listInvitations: async () => {
      calls.push("list");
      return [];
    },
  };
}

describe("invitation commands", () => {
  it("creates a guardian invitation for an active club admin", async () => {
    const sink = writer();
    const created = await createInvitation({
      principal,
      memberships: [admin],
      clubId,
      inviteType: "GUARDIAN",
      teamId: null,
      playerId,
      intendedEmail: "person@example.com",
      intendedPhone: null,
      writer: sink,
    });

    expect(sink.calls).toEqual(["create"]);
    expect(created.token).toHaveLength(64);
  });

  it("rejects an unbound identity, a staff invite without a team, and a signed-out caller", async () => {
    const sink = writer();
    await expect(
      createInvitation({
        principal,
        memberships: [admin],
        clubId,
        inviteType: "GUARDIAN",
        teamId: null,
        playerId,
        intendedEmail: "person@example.com",
        intendedPhone: "+61400111222",
        writer: sink,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: invitationMessages.validationFailed,
    });
    await expect(
      createInvitation({
        principal,
        memberships: [admin],
        clubId,
        inviteType: "HEAD_COACH",
        teamId: null,
        playerId: null,
        intendedEmail: "person@example.com",
        intendedPhone: null,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      acceptInvitation({
        principal: null,
        token,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      acceptInvitation({
        principal,
        token: "short",
        writer: sink,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: invitationMessages.notFound,
    });
    expect(sink.calls).toEqual([]);
  });

  it("revokes and lists for an admin and denies another club", async () => {
    const sink = writer();
    await revokeInvitation({
      principal,
      memberships: [admin],
      clubId,
      invitationId,
      writer: sink,
    });
    await expect(
      listInvitations({
        principal,
        memberships: [{ ...admin, active: false }],
        clubId,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      revokeInvitation({
        principal,
        memberships: [{ ...admin, role: "CLUB_ADMIN", clubId: teamId }],
        clubId,
        invitationId,
        writer: sink,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    expect(sink.calls).toEqual(["revoke"]);
  });

  it("accepts a token and rejects a bad identifier", async () => {
    const sink = writer();
    await expect(
      acceptInvitation({ principal, token, writer: sink }),
    ).resolves.toMatchObject({ inviteType: "GUARDIAN" });
    await expect(
      createInvitation({
        principal,
        memberships: [admin],
        clubId,
        inviteType: "TEAM_MANAGER",
        teamId,
        playerId: null,
        intendedEmail: null,
        intendedPhone: "+61400111222",
        writer: sink,
      }),
    ).resolves.toMatchObject({ token });
    await expect(
      revokeInvitation({
        principal,
        memberships: [admin],
        clubId,
        invitationId: "not-an-id",
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      listInvitations({
        principal,
        memberships: [{ ...admin, role: "HEAD_COACH" as "CLUB_ADMIN" }],
        clubId,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      listInvitations({
        principal,
        memberships: [admin],
        clubId: "not-a-club",
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createInvitation({
        principal,
        memberships: [admin],
        clubId,
        inviteType: "GUARDIAN",
        teamId: null,
        playerId,
        intendedEmail: "not-an-email",
        intendedPhone: null,
        writer: sink,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
