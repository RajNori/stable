import { describe, expect, it } from "vitest";

import {
  PLAYER_IMPORT_MAX_ROWS,
  PLAYER_IMPORT_SOURCE,
  PLAYER_NAME_MAX_LENGTH,
  clubAdultSchema,
  guardianLinkSchema,
  normalizePlayerName,
  playerImportResultSchema,
  playerImportRowSchema,
  playerSchema,
  playerSummarySchema,
} from "./index.js";

const playerId = "11111111-1111-4111-8111-111111111111";
const clubId = "22222222-2222-4222-8222-222222222222";
const guardianUserId = "33333333-3333-4333-8333-333333333333";
const linkId = "44444444-4444-4444-8444-444444444444";

const player = {
  id: playerId,
  clubId,
  firstName: " Alexander ",
  lastName: " Robertson ",
  active: true,
};

const forbiddenKeys = {
  authUserId: guardianUserId,
  email: "child@example.com",
  phone: "+61400000000",
  dateOfBirth: "2014-01-01",
  teamId: clubId,
  jerseyNumber: "12",
  role: "PLAYER",
  capability: "people.manage",
} as const;

describe("player contracts", () => {
  it("accepts a child profile and trims names the way persistence does", () => {
    expect(playerSchema.parse(player)).toEqual({
      id: playerId,
      clubId,
      firstName: "Alexander",
      lastName: "Robertson",
      active: true,
    });
    expect(PLAYER_NAME_MAX_LENGTH).toBe(80);
    expect(PLAYER_IMPORT_MAX_ROWS).toBe(50);
    expect(PLAYER_IMPORT_SOURCE).toBe("club_admin_import");
  });

  it("rejects persistence and auth fields that are not part of a player", () => {
    expect(
      playerSchema.safeParse({ ...player, ...forbiddenKeys }).success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, displayName: "Alexander R." })
        .success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, authUserId: guardianUserId }).success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, email: "child@example.com" }).success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, phone: "+61400000000" }).success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, dateOfBirth: "2014-01-01" }).success,
    ).toBe(false);
    expect(playerSchema.safeParse({ ...player, teamId: clubId }).success).toBe(
      false,
    );
    expect(
      playerSchema.safeParse({ ...player, jerseyNumber: "12" }).success,
    ).toBe(false);
    expect(playerSchema.safeParse({ ...player, role: "PLAYER" }).success).toBe(
      false,
    );
    expect(
      playerSchema.safeParse({ ...player, capability: "people.manage" })
        .success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, preferredName: "Alex" }).success,
    ).toBe(false);
    expect(
      playerSchema.safeParse({ ...player, guardianId: guardianUserId }).success,
    ).toBe(false);
  });

  it("rejects an empty, control-character, or over-long name", () => {
    expect(normalizePlayerName("   ")).toBeNull();
    expect(normalizePlayerName("Alexander\nRobertson")).toBeNull();
    expect(normalizePlayerName("Alexander\u007F")).toBeNull();
    expect(
      normalizePlayerName(`A${"x".repeat(PLAYER_NAME_MAX_LENGTH)}`),
    ).toBeNull();
    expect(normalizePlayerName("A".repeat(PLAYER_NAME_MAX_LENGTH))).toBe(
      "A".repeat(PLAYER_NAME_MAX_LENGTH),
    );
    expect(normalizePlayerName("  Álvarez  ")).toBe("Álvarez");
    expect(playerSchema.safeParse({ ...player, firstName: " " }).success).toBe(
      false,
    );
  });

  it("keeps a player summary to id and the derived display name", () => {
    expect(
      playerSummarySchema.parse({
        id: playerId,
        displayName: "Alexander R.",
      }),
    ).toEqual({ id: playerId, displayName: "Alexander R." });
    expect(
      playerSummarySchema.safeParse({
        id: playerId,
        displayName: "Alexander R.",
        firstName: "Alexander",
        lastName: "Robertson",
        ...forbiddenKeys,
      }).success,
    ).toBe(false);
  });

  it("describes a guardian link without contact fields", () => {
    expect(
      guardianLinkSchema.parse({
        id: linkId,
        playerId,
        guardianUserId,
        active: true,
      }),
    ).toEqual({
      id: linkId,
      playerId,
      guardianUserId,
      active: true,
    });
    expect(
      guardianLinkSchema.parse({
        id: linkId,
        playerId,
        guardianUserId,
        active: true,
        displayName: "Local Member",
      }).displayName,
    ).toBe("Local Member");
    expect(
      guardianLinkSchema.safeParse({
        id: linkId,
        playerId,
        guardianUserId,
        active: true,
        ...forbiddenKeys,
      }).success,
    ).toBe(false);
  });

  it("describes a same-club adult without email or phone", () => {
    expect(
      clubAdultSchema.parse({
        userId: guardianUserId,
        displayName: "Local Member",
      }),
    ).toEqual({ userId: guardianUserId, displayName: "Local Member" });
    expect(
      clubAdultSchema.safeParse({
        userId: guardianUserId,
        displayName: "Local Member",
        email: "adult@example.com",
        phone: "+61400000000",
      }).success,
    ).toBe(false);
  });

  it("describes an import row and a created or existing result", () => {
    expect(
      playerImportRowSchema.parse({
        firstName: "Jordan",
        lastName: "Lee",
        sourcePlayerId: " import-1 ",
      }),
    ).toEqual({
      firstName: "Jordan",
      lastName: "Lee",
      sourcePlayerId: "import-1",
    });
    expect(
      playerImportRowSchema.safeParse({
        firstName: "Jordan",
        lastName: "Lee",
        sourcePlayerId: "import-1",
        ...forbiddenKeys,
      }).success,
    ).toBe(false);
    expect(
      playerImportResultSchema.parse({
        sourcePlayerId: "import-1",
        playerId,
        status: "created",
      }).status,
    ).toBe("created");
    expect(
      playerImportResultSchema.parse({
        sourcePlayerId: "import-1",
        playerId,
        status: "existing",
      }).status,
    ).toBe("existing");
    expect(
      playerImportResultSchema.safeParse({
        sourcePlayerId: "import-1",
        playerId,
        status: "merged",
        firstName: "Jordan",
      }).success,
    ).toBe(false);
  });
});
