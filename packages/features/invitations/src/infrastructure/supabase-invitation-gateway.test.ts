import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { invitationMessages } from "../application/invitation-commands.js";
import { createSupabaseInvitationGateway } from "./supabase-invitation-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const teamId = "17171717-1717-4717-8717-171717171717";
const playerId = "18181818-1818-4818-8818-181818181818";
const invitationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = "ab".repeat(32);

function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: string[] = [];
  return {
    calls,
    rpc(name: string) {
      calls.push(name);
      return Promise.resolve(result);
    },
  };
}

describe("invitation gateway", () => {
  it("returns a token once and does not keep the driver text", async () => {
    const db = client({
      data: [
        {
          id: invitationId,
          token,
          expires_at: "2026-10-13T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const created = await createSupabaseInvitationGateway(db).createInvitation({
      clubId,
      inviteType: "GUARDIAN",
      teamId: null,
      playerId,
      intendedEmail: "person@example.com",
      intendedPhone: null,
    });

    expect(db.calls).toEqual(["create_invitation"]);
    expect(created.token).toBe(token);
    expect(JSON.stringify(created)).not.toContain("token_hash");
  });

  it("maps identity, expiry, revocation, and consumption to fixed messages", async () => {
    await expect(
      createSupabaseInvitationGateway(
        client({
          data: null,
          error: { message: "P0001: IDENTITY_MISMATCH person@example.com" },
        }),
      ).acceptInvitation(token),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: invitationMessages.saveFailed,
    });

    await expect(
      createSupabaseInvitationGateway(
        client({ data: null, error: { message: "P0001: IDENTITY_MISMATCH" } }),
      ).acceptInvitation(token),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: invitationMessages.identityMismatch,
    });

    await expect(
      createSupabaseInvitationGateway(
        client({ data: null, error: { message: "P0001: EXPIRED" } }),
      ).acceptInvitation(token),
    ).rejects.toMatchObject({ message: invitationMessages.expired });

    await expect(
      createSupabaseInvitationGateway(
        client({ data: null, error: { message: "P0001: REVOKED" } }),
      ).acceptInvitation(token),
    ).rejects.toMatchObject({ message: invitationMessages.revoked });

    await expect(
      createSupabaseInvitationGateway(
        client({ data: null, error: { message: "P0001: ALREADY_CONSUMED" } }),
      ).acceptInvitation(token),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: invitationMessages.alreadyConsumed,
    });
  });

  it("lists invitations and hides a bad payload", async () => {
    const db = client({
      data: [
        {
          id: invitationId,
          club_id: clubId,
          team_id: teamId,
          player_id: null,
          invite_type: "TEAM_MANAGER",
          intended_email: "person@example.com",
          intended_phone: null,
          expires_at: "2026-10-13T00:00:00.000Z",
          consumed_at: null,
          revoked_at: null,
          created_at: "2026-10-06T00:00:00.000Z",
          status: "pending",
        },
      ],
      error: null,
    });

    const rows =
      await createSupabaseInvitationGateway(db).listInvitations(clubId);

    expect(rows[0]?.inviteType).toBe("TEAM_MANAGER");
    await expect(
      createSupabaseInvitationGateway(
        client({ data: { token: "nope" }, error: null }),
      ).revokeInvitation(invitationId),
    ).resolves.toBeUndefined();
    await expect(
      createSupabaseInvitationGateway(
        client({ data: [{ status: "nope" }], error: null }),
      ).listInvitations(clubId),
    ).rejects.toBeInstanceOf(ApplicationError);

    await expect(
      createSupabaseInvitationGateway(
        client({ data: null, error: null }),
      ).createInvitation({
        clubId,
        inviteType: "HEAD_COACH",
        teamId,
        playerId: null,
        intendedEmail: "person@example.com",
        intendedPhone: null,
      }),
    ).rejects.toMatchObject({ message: invitationMessages.saveFailed });

    await expect(
      createSupabaseInvitationGateway(
        client({
          data: [
            {
              invitation_id: invitationId,
              invite_type: "HEAD_COACH",
              club_id: clubId,
              team_id: teamId,
              player_id: null,
            },
          ],
          error: null,
        }),
      ).acceptInvitation(token),
    ).resolves.toMatchObject({ inviteType: "HEAD_COACH" });

    await expect(
      createSupabaseInvitationGateway(
        client({ data: { nope: true }, error: null }),
      ).listInvitations(clubId),
    ).rejects.toMatchObject({ message: invitationMessages.readFailed });

    for (const message of [
      "28000: UNAUTHENTICATED",
      "42501: FORBIDDEN",
      "P0002: NOT_FOUND",
      "23514: VALIDATION_FAILED",
    ]) {
      await expect(
        createSupabaseInvitationGateway(
          client({ data: null, error: { message } }),
        ).acceptInvitation(token),
      ).rejects.toBeInstanceOf(ApplicationError);
    }
  });
});
