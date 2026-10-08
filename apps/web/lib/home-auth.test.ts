import { AUTH_ERROR_MESSAGES } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  authQueryFlag,
  callbackNotice,
  shouldLoadClubContext,
} from "./home-auth";

describe("home auth routing", () => {
  it("loads club context only after an authenticated session", () => {
    expect(
      shouldLoadClubContext({
        state: "authenticated",
        principal: { userId: "adult-1" },
      }),
    ).toBe(true);
    expect(shouldLoadClubContext({ state: "loading" })).toBe(false);
    expect(shouldLoadClubContext({ state: "unauthenticated" })).toBe(false);
  });

  it("maps known callback flags while ignoring missing and unknown values", () => {
    expect(callbackNotice({})).toBeNull();
    expect(callbackNotice({ auth: "unknown" })).toBeNull();
    expect(callbackNotice({ auth: ["unavailable", "validation"] })).toBe(
      AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
    );
    expect(callbackNotice({ auth: "validation" })).toBe(
      AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    );
    expect(callbackNotice({ auth: "limited" })).toBe(
      AUTH_ERROR_MESSAGES.RATE_LIMITED,
    );
    expect(callbackNotice({ auth: "internal" })).toBe(
      AUTH_ERROR_MESSAGES.INTERNAL,
    );
  });

  it("only returns explicit safe flags and defaults other messages to internal", () => {
    expect(authQueryFlag(AUTH_ERROR_MESSAGES.VALIDATION_FAILED)).toBe(
      "validation",
    );
    expect(authQueryFlag(AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE)).toBe(
      "unavailable",
    );
    expect(authQueryFlag(AUTH_ERROR_MESSAGES.RATE_LIMITED)).toBe("limited");
    expect(authQueryFlag("provider raw text containing credentials")).toBe(
      "internal",
    );
  });
});
