import { describe, expect, it } from "vitest";

import { principalFromSession } from "./index.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("principalFromSession", () => {
  it("session double returns userId and does not copy role", () => {
    const session = {
      id: userId,
      role: "CLUB_ADMIN",
      accessToken: "secret-access-token",
      refreshToken: "secret-refresh-token",
    };

    const principal = principalFromSession(session);

    expect(principal).toEqual({ userId });
    expect(principal).not.toHaveProperty("role");
    expect(principal).not.toHaveProperty("accessToken");
    expect(principal).not.toHaveProperty("refreshToken");
  });

  it("prefers userId over id and keeps a display name", () => {
    const session = {
      id: otherUserId,
      userId,
      displayName: "Alex M",
      role: "CLUB_ADMIN",
      accessToken: "secret-access-token",
    };

    expect(principalFromSession(session)).toEqual({
      userId,
      displayName: "Alex M",
    });
  });

  it("null session returns null", () => {
    expect(principalFromSession(null)).toBeNull();
  });

  it("returns null when the session has no identity", () => {
    expect(principalFromSession({})).toBeNull();
    expect(principalFromSession({ id: "", userId: "" })).toBeNull();
  });

  it("falls back to id when userId is empty", () => {
    expect(principalFromSession({ userId: "", id: userId })).toEqual({
      userId,
    });
  });

  it("drops an empty display name and rejects a non-uuid identity", () => {
    expect(principalFromSession({ id: userId, displayName: "" })).toEqual({
      userId,
    });
    expect(principalFromSession({ id: "not-a-uuid" })).toBeNull();
  });
});
