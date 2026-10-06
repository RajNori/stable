import { ApplicationError } from "@stable/contracts";
import type { MembershipFact, Player, Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  PlayerImportValidationError,
  createPlayer,
  deactivatePlayer,
  importPlayers,
  inspectImportRows,
  linkGuardian,
  playerMessages,
  reactivatePlayer,
  unlinkGuardian,
  updatePlayerIdentity,
} from "./player-commands.js";
import type { PlayerDirectory, PlayerWriter } from "./player-commands.js";

const clubId = "11111111-1111-4111-8111-111111111111";
const otherClubId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userId = "55555555-5555-4555-8555-555555555555";
const playerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const guardianUserId = "23232323-2323-4232-8232-232323232323";
const linkId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const principal: Principal = { userId };
const adminMembership: MembershipFact = {
  clubId,
  role: "CLUB_ADMIN",
  active: true,
};

function player(active = true): Player {
  return {
    id: playerId,
    clubId,
    firstName: "Alexander",
    lastName: "Robertson",
    active,
  };
}

function directory(found: Player | null = player()): PlayerDirectory {
  return { findPlayer: async () => found };
}

function writer(): { writer: PlayerWriter; calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    writer: {
      createPlayer: async (command) => {
        calls.push(command);
        return player();
      },
      importPlayers: async (command) => {
        calls.push(command);
        return command.rows.map((row) => ({
          sourcePlayerId: row.sourcePlayerId,
          playerId,
          status: "created" as const,
        }));
      },
      updatePlayerIdentity: async (command) => {
        calls.push(command);
        return {
          ...player(),
          firstName: command.firstName,
          lastName: command.lastName,
        };
      },
      deactivatePlayer: async (command) => {
        calls.push(command);
        return { ...player(), active: false };
      },
      reactivatePlayer: async (command) => {
        calls.push(command);
        return player();
      },
      linkGuardian: async (command) => {
        calls.push(command);
        return {
          id: linkId,
          playerId,
          guardianUserId: command.guardianUserId,
          active: true,
        };
      },
      unlinkGuardian: async (command) => {
        calls.push(command);
        return {
          id: linkId,
          playerId,
          guardianUserId: command.guardianUserId,
          active: false,
        };
      },
    },
  };
}

describe("player commands", () => {
  it("creates a trimmed player for an active club admin", async () => {
    const fake = writer();
    const created = await createPlayer({
      principal,
      memberships: [adminMembership],
      clubId,
      firstName: " Alexander ",
      lastName: " Robertson ",
      writer: fake.writer,
    });

    expect(created.firstName).toBe("Alexander");
    expect(fake.calls).toEqual([
      { clubId, firstName: "Alexander", lastName: "Robertson" },
    ]);
    expect(JSON.stringify(fake.calls)).not.toContain(userId);
  });

  it("refuses create without an admin membership", async () => {
    const fake = writer();
    await expect(
      createPlayer({
        principal: null,
        memberships: [],
        clubId,
        firstName: "Alexander",
        lastName: "Robertson",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      createPlayer({
        principal,
        memberships: [{ ...adminMembership, active: false }],
        clubId,
        firstName: "Alexander",
        lastName: "Robertson",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createPlayer({
        principal,
        memberships: [adminMembership],
        clubId: otherClubId,
        firstName: "Alexander",
        lastName: "Robertson",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.calls).toEqual([]);
  });

  it("rejects an invalid name before writing", async () => {
    const fake = writer();
    await expect(
      createPlayer({
        principal,
        memberships: [adminMembership],
        clubId,
        firstName: " ",
        lastName: "Robertson",
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: playerMessages.validationFailed,
    });
    expect(fake.calls).toEqual([]);
  });

  it("imports a valid batch and rejects invalid batches before writing", async () => {
    const fake = writer();
    const imported = await importPlayers({
      principal,
      memberships: [adminMembership],
      clubId,
      rows: [
        { firstName: "Jordan", lastName: "Lee", sourcePlayerId: "import-1" },
        { firstName: "Jordan", lastName: "Lee", sourcePlayerId: "import-2" },
      ],
      writer: fake.writer,
    });
    expect(imported).toHaveLength(2);
    expect(fake.calls).toHaveLength(1);

    const duplicate = inspectImportRows([
      { firstName: "Jordan", lastName: "Lee", sourcePlayerId: "import-1" },
      { firstName: "Changed", lastName: "Lee", sourcePlayerId: "import-1" },
    ]);
    expect(duplicate.valid).toBe(false);
    expect(duplicate.rowNumbers).toEqual([1, 2]);

    const invalid = inspectImportRows([
      { firstName: "Jordan", lastName: "Lee", sourcePlayerId: "import-3" },
      {
        firstName: " ",
        lastName: "Lee",
        sourcePlayerId: "import-4",
        email: "x",
      },
    ]);
    expect(invalid.rowNumbers).toEqual([2]);
    expect(invalid.rows).toEqual([]);

    await expect(
      importPlayers({
        principal,
        memberships: [adminMembership],
        clubId,
        rows: [],
        writer: fake.writer,
      }),
    ).rejects.toBeInstanceOf(PlayerImportValidationError);
    await expect(
      importPlayers({
        principal,
        memberships: [adminMembership],
        clubId,
        rows: Array.from({ length: 51 }, (_, index) => ({
          firstName: "Jordan",
          lastName: "Lee",
          sourcePlayerId: `row-${index}`,
        })),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ rowNumbers: [] });
    expect(fake.calls).toHaveLength(1);
  });

  it("updates, deactivates, and reactivates through the directory", async () => {
    const fake = writer();
    const updated = await updatePlayerIdentity({
      principal,
      memberships: [adminMembership],
      playerId,
      firstName: "Alexandra",
      lastName: "Robertson",
      directory: directory(),
      writer: fake.writer,
    });
    expect(updated.firstName).toBe("Alexandra");

    const inactive = await deactivatePlayer({
      principal,
      memberships: [adminMembership],
      playerId,
      directory: directory(),
      writer: fake.writer,
    });
    expect(inactive.active).toBe(false);

    const active = await reactivatePlayer({
      principal,
      memberships: [adminMembership],
      playerId,
      directory: directory(),
      writer: fake.writer,
    });
    expect(active.active).toBe(true);
  });

  it("does not write when the player is hidden or outside the admin club", async () => {
    const fake = writer();
    await expect(
      updatePlayerIdentity({
        principal,
        memberships: [adminMembership],
        playerId,
        firstName: "Alexandra",
        lastName: "Robertson",
        directory: directory(null),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      deactivatePlayer({
        principal,
        memberships: [adminMembership],
        playerId,
        directory: directory({ ...player(), clubId: otherClubId }),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.calls).toEqual([]);
  });

  it("links an active player and refuses a new link when the player is inactive", async () => {
    const fake = writer();
    const linked = await linkGuardian({
      principal,
      memberships: [adminMembership],
      playerId,
      guardianUserId,
      directory: directory(),
      writer: fake.writer,
    });
    expect(linked.guardianUserId).toBe(guardianUserId);

    await expect(
      linkGuardian({
        principal,
        memberships: [adminMembership],
        playerId,
        guardianUserId,
        directory: directory(player(false)),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ message: playerMessages.inactivePlayer });

    const unlinked = await unlinkGuardian({
      principal,
      memberships: [adminMembership],
      playerId,
      guardianUserId,
      directory: directory(player(false)),
      writer: fake.writer,
    });
    expect(unlinked.active).toBe(false);
    expect(fake.calls).toHaveLength(2);
  });

  it("rejects a guardian id that is not a uuid", async () => {
    const fake = writer();
    await expect(
      linkGuardian({
        principal,
        memberships: [adminMembership],
        playerId,
        guardianUserId: "not-a-uuid",
        directory: directory(),
        writer: fake.writer,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(fake.calls).toEqual([]);
  });

  it("hides writer failures and keeps application errors", async () => {
    const failing: PlayerWriter = {
      ...writer().writer,
      createPlayer: async () => {
        throw new Error("child Alexander Robertson");
      },
    };
    await expect(
      createPlayer({
        principal,
        memberships: [adminMembership],
        clubId,
        firstName: "Alexander",
        lastName: "Robertson",
        writer: failing,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: playerMessages.saveFailed,
    });

    const explicit: PlayerWriter = {
      ...writer().writer,
      createPlayer: async () => {
        throw new ApplicationError("NOT_FOUND", playerMessages.notFound);
      },
    };
    await expect(
      createPlayer({
        principal,
        memberships: [adminMembership],
        clubId,
        firstName: "Alexander",
        lastName: "Robertson",
        writer: explicit,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
