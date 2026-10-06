import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { PlayerImportValidationError } from "../application/player-commands.js";
import { playerMessages } from "../application/player-commands.js";
import { createSupabasePlayerGateway } from "./supabase-player-gateway.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const playerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "55555555-5555-4555-8555-555555555555";
const guardianUserId = "23232323-2323-4232-8232-232323232323";
const linkId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const driverText =
  "duplicate key value violates unique constraint players_name_key Alexander";

type QueryResult = {
  data: unknown;
  error: { message: string; hint?: string | null } | null;
};

function ok(data: unknown): QueryResult {
  return { data, error: null };
}

function fail(message: string, hint?: string | null): QueryResult {
  return {
    data: null,
    error: hint === undefined ? { message } : { message, hint },
  };
}

function playerRow(firstName = "Alexander") {
  return {
    id: playerId,
    club_id: clubId,
    first_name: firstName,
    last_name: "Robertson",
    active: true,
    email: "hidden@example.com",
  };
}

function createHarness(input?: {
  rpc?: (name: string, args: Record<string, unknown>) => QueryResult;
  rows?: Record<string, QueryResult>;
  user?: QueryResult & { data: { user: { id: string } | null } };
}) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      return Promise.resolve(input?.rpc?.(name, args) ?? ok(playerRow()));
    },
    from(table: string) {
      const result = input?.rows?.[table] ?? ok([]);
      const builder = {
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve(result);
        },
        then(
          onFulfilled: (value: QueryResult) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return { select: () => builder };
    },
    auth: {
      getUser: () =>
        Promise.resolve(input?.user ?? ok({ user: { id: userId } })),
    },
  };
  return { gateway: createSupabasePlayerGateway(client), rpcCalls };
}

describe("player gateway", () => {
  it("creates a player without sending an actor id", async () => {
    const { gateway, rpcCalls } = createHarness();
    const created = await gateway.writer.createPlayer({
      clubId,
      firstName: "Alexander",
      lastName: "Robertson",
    });

    expect(created).toEqual({
      id: playerId,
      clubId,
      firstName: "Alexander",
      lastName: "Robertson",
      active: true,
    });
    expect(created).not.toHaveProperty("email");
    expect(rpcCalls).toEqual([
      {
        name: "create_player",
        args: {
          p_club_id: clubId,
          p_first_name: "Alexander",
          p_last_name: "Robertson",
        },
      },
    ]);
  });

  it("maps database failures without forwarding driver text", async () => {
    const cases: [string, string][] = [
      ["UNAUTHENTICATED", "UNAUTHENTICATED"],
      ["42501: FORBIDDEN", "FORBIDDEN"],
      ["NOT_FOUND", "NOT_FOUND"],
      ["VALIDATION_FAILED", "VALIDATION_FAILED"],
      [driverText, "INTERNAL"],
    ];

    for (const [message, code] of cases) {
      const { gateway } = createHarness({
        rpc: () => fail(message),
      });
      await expect(
        gateway.writer.updatePlayerIdentity({
          playerId,
          firstName: "Alexandra",
          lastName: "Robertson",
        }),
      ).rejects.toMatchObject({ code });
    }

    try {
      const { gateway } = createHarness({ rpc: () => fail(driverText) });
      await gateway.writer.deactivatePlayer({ playerId });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ApplicationError);
      expect(error instanceof Error ? error.message : "").toBe(
        playerMessages.saveFailed,
      );
      expect(error instanceof Error ? error.message : "").not.toContain(
        "Alexander",
      );
    }
  });

  it("imports rows and keeps validation hints to row numbers", async () => {
    const { gateway, rpcCalls } = createHarness({
      rpc: () =>
        ok([
          {
            source_player_id: "import-1",
            player_id: playerId,
            status: "existing",
          },
        ]),
    });
    const imported = await gateway.writer.importPlayers({
      clubId,
      rows: [
        { firstName: "Jordan", lastName: "Lee", sourcePlayerId: "import-1" },
      ],
    });
    expect(imported[0]?.status).toBe("existing");
    expect(rpcCalls[0]?.args["p_rows"]).toEqual([
      {
        first_name: "Jordan",
        last_name: "Lee",
        source_player_id: "import-1",
      },
    ]);

    const hinted = createHarness({
      rpc: () => fail("VALIDATION_FAILED", "2,4"),
    });
    await expect(
      hinted.gateway.writer.importPlayers({ clubId, rows: [] }),
    ).rejects.toMatchObject({ rowNumbers: [2, 4] });

    const named = createHarness({
      rpc: () => fail("VALIDATION_FAILED", "Alexander Robertson"),
    });
    try {
      await named.gateway.writer.importPlayers({ clubId, rows: [] });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(PlayerImportValidationError);
      expect(
        error instanceof PlayerImportValidationError ? error.rowNumbers : null,
      ).toEqual([]);
      expect(error instanceof Error ? error.message : "").not.toContain(
        "Alexander",
      );
    }
  });

  it("links, unlinks, reactivates, and reads the same-club adult list", async () => {
    const { gateway } = createHarness({
      rpc: (name) => {
        if (name === "list_club_adults") {
          return ok([
            {
              user_id: guardianUserId,
              display_name: "Second Adult",
              email: "adult@example.com",
              phone: "+61400000000",
            },
          ]);
        }
        if (name === "unlink_player_guardian") {
          return ok({
            id: linkId,
            player_id: playerId,
            user_id: guardianUserId,
            active: false,
          });
        }
        if (
          name === "reactivate_player" ||
          name === "update_player_identity" ||
          name === "deactivate_player"
        ) {
          return ok([playerRow()]);
        }
        return ok({
          id: linkId,
          player_id: playerId,
          user_id: guardianUserId,
          active: true,
        });
      },
    });

    const linked = await gateway.writer.linkGuardian({
      playerId,
      guardianUserId,
    });
    expect(linked).toEqual({
      id: linkId,
      playerId,
      guardianUserId,
      active: true,
    });
    const unlinked = await gateway.writer.unlinkGuardian({
      playerId,
      guardianUserId,
    });
    expect(unlinked.active).toBe(false);
    const reactivated = await gateway.writer.reactivatePlayer({ playerId });
    expect(reactivated.id).toBe(playerId);
    const updated = await gateway.writer.updatePlayerIdentity({
      playerId,
      firstName: "Alexandra",
      lastName: "Robertson",
    });
    expect(updated.firstName).toBe("Alexander");
    const deactivated = await gateway.writer.deactivatePlayer({ playerId });
    expect(deactivated.active).toBe(true);

    const adults = await gateway.listClubAdults(clubId);
    expect(adults).toEqual([
      { userId: guardianUserId, displayName: "Second Adult" },
    ]);
    expect(adults[0]).not.toHaveProperty("email");
    expect(adults[0]).not.toHaveProperty("phone");
  });

  it("lists players and guardians and hides a missing player", async () => {
    const { gateway } = createHarness({
      rows: {
        players: ok([playerRow()]),
        guardian_relationships: ok([
          {
            id: linkId,
            player_id: playerId,
            user_id: guardianUserId,
            active: true,
          },
        ]),
      },
    });
    expect(await gateway.listPlayers(clubId)).toHaveLength(1);
    expect(await gateway.listGuardians(playerId)).toHaveLength(1);

    const missing = createHarness({
      rows: { players: ok(null) },
    });
    expect(await missing.gateway.directory.findPlayer(playerId)).toBeNull();

    const found = createHarness({
      rows: { players: ok(playerRow("Alexandra")) },
    });
    expect(
      (await found.gateway.directory.findPlayer(playerId))?.firstName,
    ).toBe("Alexandra");
  });

  it("reads the caller session and fails closed on a bad read", async () => {
    const { gateway } = createHarness({
      rows: {
        club_memberships: ok([
          { club_id: clubId, role: "CLUB_ADMIN", active: true },
        ]),
      },
    });
    expect(await gateway.readSession()).toEqual({
      principal: { userId },
      memberships: [{ clubId, role: "CLUB_ADMIN", active: true }],
    });

    const signedOut = createHarness({
      user: { data: { user: null }, error: null },
    });
    expect(await signedOut.gateway.readSession()).toEqual({
      principal: null,
      memberships: [],
    });

    const broken = createHarness({
      user: { data: { user: null }, error: { message: driverText } },
    });
    await expect(broken.gateway.readSession()).rejects.toMatchObject({
      message: playerMessages.readFailed,
    });

    const badRole = createHarness({
      rows: {
        club_memberships: ok([
          { club_id: clubId, role: "COACH", active: true },
        ]),
      },
    });
    await expect(badRole.gateway.readSession()).rejects.toMatchObject({
      code: "INTERNAL",
    });

    const badList = createHarness({
      rows: { players: fail(driverText) },
    });
    await expect(badList.gateway.listPlayers(clubId)).rejects.toMatchObject({
      message: playerMessages.readFailed,
    });

    const badFind = createHarness({
      rows: { players: fail(driverText) },
    });
    await expect(
      badFind.gateway.directory.findPlayer(playerId),
    ).rejects.toMatchObject({ message: playerMessages.readFailed });

    const badAdults = createHarness({
      rpc: () => ok([{ user_id: guardianUserId, display_name: " " }]),
    });
    await expect(
      badAdults.gateway.listClubAdults(clubId),
    ).rejects.toMatchObject({
      message: playerMessages.saveFailed,
    });

    const notArray = createHarness({
      rpc: () => ok({ status: "created" }),
    });
    await expect(
      notArray.gateway.writer.importPlayers({ clubId, rows: [] }),
    ).rejects.toMatchObject({ message: playerMessages.saveFailed });

    const emptyRpc = createHarness({ rpc: () => ok(null) });
    await expect(
      emptyRpc.gateway.writer.deactivatePlayer({ playerId }),
    ).rejects.toMatchObject({ message: playerMessages.saveFailed });
  });

  it("rejects malformed rows and non-validation import failures", async () => {
    const malformed = createHarness({
      rpc: (name) => {
        if (name === "import_players") {
          return ok(["not-a-row"]);
        }
        if (name === "link_player_guardian") {
          return ok(["not-a-row"]);
        }
        if (name === "list_club_adults") {
          return ok(["not-a-row"]);
        }
        return ok(playerRow());
      },
      rows: {
        club_memberships: ok(["not-a-row"]),
        players: ok("not-a-list"),
        guardian_relationships: ok([null]),
      },
    });

    await expect(
      malformed.gateway.writer.importPlayers({ clubId, rows: [] }),
    ).rejects.toMatchObject({ message: playerMessages.saveFailed });
    await expect(
      malformed.gateway.writer.linkGuardian({ playerId, guardianUserId }),
    ).rejects.toMatchObject({ message: playerMessages.saveFailed });
    await expect(
      malformed.gateway.listClubAdults(clubId),
    ).rejects.toMatchObject({
      message: playerMessages.readFailed,
    });
    await expect(malformed.gateway.listPlayers(clubId)).rejects.toMatchObject({
      message: playerMessages.readFailed,
    });
    await expect(
      malformed.gateway.listGuardians(playerId),
    ).rejects.toMatchObject({
      message: playerMessages.saveFailed,
    });
    await expect(malformed.gateway.readSession()).rejects.toMatchObject({
      message: playerMessages.readFailed,
    });

    const hinted = createHarness({
      rpc: (name) => {
        if (name === "import_players") {
          return fail("VALIDATION_FAILED", null);
        }
        return fail("NOT_FOUND");
      },
    });
    await expect(
      hinted.gateway.writer.importPlayers({ clubId, rows: [] }),
    ).rejects.toMatchObject({ rowNumbers: [] });
    await expect(hinted.gateway.listClubAdults(clubId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    const forbiddenImport = createHarness({
      rpc: () => fail("42501: FORBIDDEN"),
    });
    await expect(
      forbiddenImport.gateway.writer.importPlayers({ clubId, rows: [] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const badPlayerRow = createHarness({
      rows: { players: ok([null]) },
    });
    await expect(
      badPlayerRow.gateway.listPlayers(clubId),
    ).rejects.toMatchObject({
      message: playerMessages.saveFailed,
    });

    const badMembershipShape = createHarness({
      rows: { club_memberships: ok({ club_id: clubId }) },
    });
    await expect(
      badMembershipShape.gateway.readSession(),
    ).rejects.toMatchObject({
      message: playerMessages.readFailed,
    });

    const notArray = createHarness({
      rpc: () => ok("not-a-list"),
    });
    await expect(notArray.gateway.listClubAdults(clubId)).rejects.toMatchObject(
      {
        message: playerMessages.readFailed,
      },
    );
  });
});
