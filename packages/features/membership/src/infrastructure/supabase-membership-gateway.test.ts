import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { membershipMessages } from "../application/membership-commands.js";
import { createSupabaseMembershipGateway } from "./supabase-membership-gateway.js";

const teamId = "17171717-1717-4717-8717-171717171717";
const clubId = "11111111-1111-4111-8111-111111111111";
const userId = "19191919-1919-4919-8919-19191919191a";
const playerId = "18181818-1818-4818-8818-181818181818";
const rowId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function client(result: { data: unknown; error: { message: string } | null }) {
  const calls: string[] = [];
  return {
    calls,
    rpc(name: string) {
      calls.push(name);
      return Promise.resolve(result);
    },
    from(table: string) {
      calls.push(table);
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        then(
          onfulfilled: (value: typeof result) => unknown,
          onrejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(result).then(onfulfilled, onrejected);
        },
      };
      return builder;
    },
  };
}

describe("membership gateway", () => {
  it("maps a staff assignment and hides database text", async () => {
    const db = client({
      data: {
        id: rowId,
        club_id: clubId,
        team_id: teamId,
        user_id: userId,
        role: "HEAD_COACH",
        active: true,
      },
      error: null,
    });

    const assignment = await createSupabaseMembershipGateway(db).assignTeamRole(
      {
        clubId,
        teamId,
        userId,
        role: "HEAD_COACH",
      },
    );

    expect(db.calls).toEqual(["assign_team_role"]);
    expect(assignment.userId).toBe(userId);
    expect(JSON.stringify(assignment)).not.toContain("first_name");
  });

  it("maps not-found without the driver sentence", async () => {
    const db = client({
      data: null,
      error: { message: "P0002: NOT_FOUND" },
    });

    await expect(
      createSupabaseMembershipGateway(db).registerPlayer({
        clubId,
        playerId,
        teamId,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: membershipMessages.notFound,
    });
  });

  it("lists staff for a team", async () => {
    const db = client({
      data: [
        {
          id: rowId,
          club_id: clubId,
          team_id: teamId,
          user_id: userId,
          role: "TEAM_MANAGER",
          active: false,
        },
      ],
      error: null,
    });

    const staff =
      await createSupabaseMembershipGateway(db).listTeamStaff(teamId);

    expect(db.calls).toEqual(["team_memberships"]);
    expect(staff[0]?.role).toBe("TEAM_MANAGER");
  });

  it("maps authentication and validation failures to fixed messages", async () => {
    await expect(
      createSupabaseMembershipGateway(
        client({ data: null, error: { message: "28000: UNAUTHENTICATED" } }),
      ).reactivateTeamRole({
        clubId,
        teamId,
        userId,
        role: "HEAD_COACH",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: membershipMessages.unauthenticated,
    });

    await expect(
      createSupabaseMembershipGateway(
        client({ data: null, error: { message: "23514: VALIDATION_FAILED" } }),
      ).unregisterPlayer({ clubId, playerId }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: membershipMessages.validationFailed,
    });

    await expect(
      createSupabaseMembershipGateway(
        client({ data: null, error: { message: "driver timeout Synthetic" } }),
      ).assignTeamRole({
        clubId,
        teamId,
        userId,
        role: "HEAD_COACH",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: membershipMessages.saveFailed,
    });
  });

  it("lists registrations for a club", async () => {
    const db = client({
      data: [
        {
          id: rowId,
          club_id: clubId,
          team_id: teamId,
          player_id: playerId,
          active: true,
        },
      ],
      error: null,
    });

    const rows =
      await createSupabaseMembershipGateway(db).listRegistrations(clubId);

    expect(db.calls).toEqual(["player_team_registrations"]);
    expect(rows[0]?.playerId).toBe(playerId);
  });

  it("hides a failed staff read", async () => {
    await expect(
      createSupabaseMembershipGateway(
        client({ data: null, error: { message: "permission denied" } }),
      ).listRegistrations(clubId),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: membershipMessages.readFailed,
    });

    await expect(
      createSupabaseMembershipGateway(
        client({ data: [null], error: null }),
      ).listTeamStaff(teamId),
    ).rejects.toMatchObject({ message: membershipMessages.saveFailed });

    await expect(
      createSupabaseMembershipGateway(
        client({ data: [null], error: null }),
      ).listRegistrations(clubId),
    ).rejects.toMatchObject({ message: membershipMessages.saveFailed });

    await expect(
      createSupabaseMembershipGateway(
        client({ data: [{ active: false }], error: null }),
      ).listRegistrations(clubId),
    ).rejects.toMatchObject({ message: membershipMessages.saveFailed });
  });

  it("collapses an unexpected payload", async () => {
    const db = client({ data: { role: "GUARDIAN" }, error: null });
    await expect(
      createSupabaseMembershipGateway(db).revokeTeamRole({
        clubId,
        teamId,
        userId,
        role: "TEAM_MANAGER",
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
});
