import { describe, expect, it } from "vitest";

import {
  AUTH_ERROR_CODES,
  AUTH_ERROR_MESSAGES,
  AUTH_METHODS,
  AUTH_STATES,
  INITIAL_AUTH_SESSION,
  LOGOUT_SCOPES,
  authErrorCodeSchema,
  authMethodSchema,
  authSessionSnapshotSchema,
  signInChallengeSchema,
  authStateSchema,
  logoutScopeSchema,
} from "./index.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("auth session contract", () => {
  it("freezes auth states, logout scopes, error codes, and methods", () => {
    expect(AUTH_STATES).toEqual([
      "loading",
      "authenticated",
      "unauthenticated",
      "expired",
      "recovery",
    ]);
    expect(LOGOUT_SCOPES).toEqual(["local", "global"]);
    expect(AUTH_METHODS).toEqual(["phone_otp", "email_otp", "apple", "google"]);
    expect(authStateSchema.parse("loading")).toBe("loading");
    expect(logoutScopeSchema.parse("local")).toBe("local");
    expect(logoutScopeSchema.parse("global")).toBe("global");
    expect(authMethodSchema.parse("phone_otp")).toBe("phone_otp");
    expect(authMethodSchema.safeParse("password").success).toBe(false);
    expect(
      signInChallengeSchema.parse({ status: "accepted", method: "email_otp" }),
    ).toEqual({ status: "accepted", method: "email_otp" });
    expect(
      signInChallengeSchema.safeParse({
        status: "accepted",
        method: "phone_otp",
        email: "person@example.com",
        accessToken: "secret-access-token",
      }).success,
    ).toBe(false);

    for (const code of AUTH_ERROR_CODES) {
      expect(authErrorCodeSchema.parse(code)).toBe(code);
      expect(AUTH_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("starts loading and accepts the settled snapshots", () => {
    expect(INITIAL_AUTH_SESSION).toEqual({ state: "loading" });
    expect(authSessionSnapshotSchema.parse(INITIAL_AUTH_SESSION)).toEqual({
      state: "loading",
    });
    expect(
      authSessionSnapshotSchema.parse({ state: "unauthenticated" }),
    ).toEqual({ state: "unauthenticated" });
    expect(authSessionSnapshotSchema.parse({ state: "expired" })).toEqual({
      state: "expired",
    });
    expect(
      authSessionSnapshotSchema.parse({
        state: "authenticated",
        principal: { userId, displayName: "Alex M" },
      }),
    ).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(
      authSessionSnapshotSchema.parse({
        state: "recovery",
        errorCode: "UPSTREAM_UNAVAILABLE",
        message: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
      }),
    ).toEqual({
      state: "recovery",
      errorCode: "UPSTREAM_UNAVAILABLE",
      message: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
    });
  });

  it("rejects tokens, roles, capabilities, and a non-catalog recovery message", () => {
    expect(
      authSessionSnapshotSchema.safeParse({
        state: "authenticated",
        principal: { userId },
        accessToken: "secret-access-token",
        refreshToken: "secret-refresh-token",
        role: "CLUB_ADMIN",
        capabilities: ["club.read"],
      }).success,
    ).toBe(false);
    expect(
      authSessionSnapshotSchema.safeParse({
        state: "loading",
        accessToken: "secret-access-token",
      }).success,
    ).toBe(false);
    expect(
      authSessionSnapshotSchema.safeParse({
        state: "recovery",
        errorCode: "INTERNAL",
        message: "person@example.com token eyJhbGci",
      }).success,
    ).toBe(false);
    expect(
      authSessionSnapshotSchema.safeParse({ state: "guest" }).success,
    ).toBe(false);
  });
});
