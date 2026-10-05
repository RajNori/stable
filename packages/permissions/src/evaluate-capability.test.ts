import { CLUB_READ_CAPABILITY } from "@stable/contracts";
import type { MembershipFact } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { evaluateCapability } from "./index.js";

const clubId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherClubId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function adminMembership(
  membershipClubId: string,
  active: boolean,
): MembershipFact {
  return {
    clubId: membershipClubId,
    role: "CLUB_ADMIN",
    active,
  };
}

describe("evaluateCapability", () => {
  it("active CLUB_ADMIN allows club.read", () => {
    expect(
      evaluateCapability({
        memberships: [adminMembership(clubId, true)],
        capability: CLUB_READ_CAPABILITY,
        clubId,
      }),
    ).toBe("allow");
  });

  it("inactive membership denies club.read", () => {
    expect(
      evaluateCapability({
        memberships: [adminMembership(clubId, false)],
        capability: CLUB_READ_CAPABILITY,
        clubId,
      }),
    ).toBe("deny");
  });

  it("missing membership denies club.read", () => {
    expect(
      evaluateCapability({
        memberships: [],
        capability: CLUB_READ_CAPABILITY,
        clubId,
      }),
    ).toBe("deny");
  });

  it("unknown capability denies", () => {
    expect(
      evaluateCapability({
        memberships: [adminMembership(clubId, true)],
        capability: "club.manage",
        clubId,
      }),
    ).toBe("deny");
  });

  it("extra role field does not grant access", () => {
    const misleadingRole = {
      memberships: [adminMembership(clubId, true)],
      capability: CLUB_READ_CAPABILITY,
      clubId,
      role: "GUARDIAN",
    };
    const roleWithoutMembership = {
      memberships: [],
      capability: CLUB_READ_CAPABILITY,
      clubId,
      role: "CLUB_ADMIN",
    };

    expect(evaluateCapability(misleadingRole)).toBe("allow");
    expect(evaluateCapability(roleWithoutMembership)).toBe("deny");
  });

  it("membership for a different clubId denies club.read", () => {
    expect(
      evaluateCapability({
        memberships: [adminMembership(otherClubId, true)],
        capability: CLUB_READ_CAPABILITY,
        clubId,
      }),
    ).toBe("deny");
  });

  it("non-admin membership denies club.read", () => {
    const membership = adminMembership(clubId, true);
    Reflect.set(membership, "role", "HEAD_COACH");

    expect(
      evaluateCapability({
        memberships: [membership],
        capability: CLUB_READ_CAPABILITY,
        clubId,
      }),
    ).toBe("deny");
  });
});
