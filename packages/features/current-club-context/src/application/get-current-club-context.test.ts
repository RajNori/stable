import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApplicationError,
  CLUB_READ_CAPABILITY,
  type ApplicationErrorCode,
  type ClubContextReadResult,
  type ClubContextReader,
  type ClubMembershipRecord,
  type ClubSummary,
  type Principal,
} from "@stable/contracts";
import { evaluateCapability } from "@stable/permissions";

import { getCurrentClubContext } from "../index.js";

vi.mock("@stable/permissions", () => {
  return {
    evaluateCapability: vi.fn((): "allow" | "deny" => "allow"),
  };
});

const evaluateCapabilityMock = vi.mocked(evaluateCapability);

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const inactiveClubId = "00000000-0000-4000-8000-000000000000";
const alphaClubId = "11111111-1111-4111-8111-111111111111";
const bravoClubId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const charlieClubId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const principal: Principal = {
  userId,
  displayName: "Principal Name",
};

function clubSummary(id: string, name: string): ClubSummary {
  return {
    id,
    name,
    slug: "mentone-mustangs",
    timezone: "Australia/Melbourne",
    themeKey: "mustangs",
  };
}

function membership(
  clubId: string,
  name: string,
  active: boolean,
): ClubMembershipRecord {
  return {
    clubId,
    role: "CLUB_ADMIN",
    active,
    club: clubSummary(clubId, name),
  };
}

function createReader(result: ClubContextReadResult): {
  reader: ClubContextReader;
  read: ReturnType<typeof vi.fn<ClubContextReader["read"]>>;
} {
  const read = vi.fn<ClubContextReader["read"]>(async () => result);
  return { reader: { read }, read };
}

function failingReader(error: unknown): {
  reader: ClubContextReader;
  read: ReturnType<typeof vi.fn<ClubContextReader["read"]>>;
} {
  const read = vi.fn<ClubContextReader["read"]>(async () => {
    throw error;
  });
  return { reader: { read }, read };
}

async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error: unknown) {
    return error;
  }

  throw new Error("Expected the use case to throw.");
}

function expectApplicationError(
  error: unknown,
  code: ApplicationErrorCode,
): ApplicationError {
  expect(error).toBeInstanceOf(ApplicationError);
  if (!(error instanceof ApplicationError)) {
    throw new Error("Expected ApplicationError.");
  }

  expect(error.code).toBe(code);
  return error;
}

describe("getCurrentClubContext", () => {
  beforeEach(() => {
    evaluateCapabilityMock.mockReset();
    evaluateCapabilityMock.mockReturnValue("allow");
  });

  it("throws UNAUTHENTICATED and does not call the reader when principal is null", async () => {
    const { reader, read } = failingReader(
      new Error("reader should not be called"),
    );

    const error = await captureError(() =>
      getCurrentClubContext({ principal: null, reader }),
    );

    expectApplicationError(error, "UNAUTHENTICATED");
    expect(read).not.toHaveBeenCalled();
    expect(evaluateCapabilityMock).not.toHaveBeenCalled();
  });

  it("maps a reader rejection to INTERNAL without driver text", async () => {
    const driverMessage =
      "duplicate key value violates unique constraint (Postgres)";
    const { reader, read } = failingReader(new Error(driverMessage));

    const error = expectApplicationError(
      await captureError(() => getCurrentClubContext({ principal, reader })),
      "INTERNAL",
    );

    expect(read).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledWith(userId);
    expect(error.message).not.toContain("duplicate key");
    expect(error.message).not.toContain("Postgres");
    expect(error.message).not.toContain(driverMessage);
    expect(evaluateCapabilityMock).not.toHaveBeenCalled();
  });

  it("maps a non-Error reader rejection to INTERNAL without the thrown text", async () => {
    const { reader } = failingReader("duplicate key from Postgres");

    const error = expectApplicationError(
      await captureError(() => getCurrentClubContext({ principal, reader })),
      "INTERNAL",
    );

    expect(error.message).not.toContain("duplicate key");
    expect(error.message).not.toContain("Postgres");
  });

  it("returns the active club, reader display name, and club.read when allowed", async () => {
    const club = clubSummary(alphaClubId, "Mentone Mustangs");
    const { reader, read } = createReader({
      displayName: "Jordan P",
      memberships: [membership(alphaClubId, "Mentone Mustangs", true)],
    });

    const result = await getCurrentClubContext({ principal, reader });

    expect(read).toHaveBeenCalledWith(userId);
    expect(evaluateCapabilityMock).toHaveBeenCalledExactlyOnceWith({
      memberships: [{ clubId: alphaClubId, role: "CLUB_ADMIN", active: true }],
      capability: CLUB_READ_CAPABILITY,
      clubId: alphaClubId,
    });
    expect(result).toEqual({
      userId,
      displayName: "Jordan P",
      club,
      activeTeam: null,
      capabilities: [CLUB_READ_CAPABILITY],
      managedPlayerIds: [],
    });
  });

  it("omits club.read when evaluateCapability denies the selected club", async () => {
    evaluateCapabilityMock.mockReturnValue("deny");
    const club = clubSummary(alphaClubId, "Mentone Mustangs");
    const { reader } = createReader({
      displayName: "Jordan P",
      memberships: [membership(alphaClubId, "Mentone Mustangs", true)],
    });

    const result = await getCurrentClubContext({ principal, reader });

    expect(result.club).toEqual(club);
    expect(result.capabilities).toEqual([]);
    expect(result.activeTeam).toBeNull();
    expect(result.managedPlayerIds).toEqual([]);
  });

  it("returns an empty club context when the user has no memberships", async () => {
    const { reader } = createReader({
      displayName: "Outsider O",
      memberships: [],
    });

    const result = await getCurrentClubContext({ principal, reader });

    expect(evaluateCapabilityMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      userId,
      displayName: "Outsider O",
      club: null,
      activeTeam: null,
      capabilities: [],
      managedPlayerIds: [],
    });
  });

  it("returns an empty club context when every membership is inactive", async () => {
    const { reader } = createReader({
      displayName: "Former Admin",
      memberships: [membership(alphaClubId, "Mentone Mustangs", false)],
    });

    const result = await getCurrentClubContext({ principal, reader });

    expect(evaluateCapabilityMock).not.toHaveBeenCalled();
    expect(result.club).toBeNull();
    expect(result.capabilities).toEqual([]);
    expect(result.displayName).toBe("Former Admin");
    expect(result.activeTeam).toBeNull();
    expect(result.managedPlayerIds).toEqual([]);
  });

  it("selects the lexicographically smallest active clubId", async () => {
    const memberships = [
      membership(charlieClubId, "Charlie Club", true),
      membership(inactiveClubId, "Inactive Club", false),
      membership(alphaClubId, "Alpha Club", true),
      membership(bravoClubId, "Bravo Club", true),
    ];
    const { reader } = createReader({
      displayName: "Multi Admin",
      memberships,
    });

    const result = await getCurrentClubContext({ principal, reader });

    expect(evaluateCapabilityMock).toHaveBeenCalledExactlyOnceWith({
      memberships: [
        { clubId: charlieClubId, role: "CLUB_ADMIN", active: true },
        { clubId: inactiveClubId, role: "CLUB_ADMIN", active: false },
        { clubId: alphaClubId, role: "CLUB_ADMIN", active: true },
        { clubId: bravoClubId, role: "CLUB_ADMIN", active: true },
      ],
      capability: CLUB_READ_CAPABILITY,
      clubId: alphaClubId,
    });
    expect(result.club).toEqual(clubSummary(alphaClubId, "Alpha Club"));
    expect(result.capabilities).toEqual([CLUB_READ_CAPABILITY]);
    expect(result.displayName).toBe("Multi Admin");
  });

  it("keeps the smallest club and omits club.read when that club is denied", async () => {
    evaluateCapabilityMock.mockReturnValue("deny");
    const { reader } = createReader({
      displayName: "Multi Admin",
      memberships: [
        membership(bravoClubId, "Bravo Club", true),
        membership(alphaClubId, "Alpha Club", true),
      ],
    });

    const result = await getCurrentClubContext({ principal, reader });

    expect(evaluateCapabilityMock).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: alphaClubId }),
    );
    expect(result.club).toEqual(clubSummary(alphaClubId, "Alpha Club"));
    expect(result.capabilities).toEqual([]);
  });

  it("throws VALIDATION_FAILED when the assembled context does not match the schema", async () => {
    const { reader } = createReader({
      displayName: "",
      memberships: [],
    });

    const error = expectApplicationError(
      await captureError(() => getCurrentClubContext({ principal, reader })),
      "VALIDATION_FAILED",
    );

    expect(error.message).not.toContain("displayName");
    expect(evaluateCapabilityMock).not.toHaveBeenCalled();
  });
});
