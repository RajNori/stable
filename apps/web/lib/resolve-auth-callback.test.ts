import { AUTH_ERROR_MESSAGES } from "@stable/contracts";
import type { OtpAuthClient } from "@stable/auth";
import { describe, expect, it } from "vitest";

import {
  callbackUrlFromCode,
  rejectProviderCallback,
  resolveAuthCallback,
} from "./resolve-auth-callback";
import {
  authQueryFlag,
  callbackNotice,
  shouldLoadClubContext,
} from "./home-auth";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("auth callback resolution", () => {
  it("redirects a safe return path after the code is exchanged", async () => {
    const calls: string[] = [];
    const result = await resolveAuthCallback(otp({ calls }), {
      callbackUrl: callbackUrlFromCode("abcdefgh"),
      appEnv: "local",
      returnTo: "/club-structure",
    });

    expect(result).toEqual({ status: "redirect", to: "/club-structure" });
    expect(calls).toEqual(["abcdefgh"]);
  });

  it("rejects an unsafe return path before exchange", async () => {
    const calls: string[] = [];
    const result = await resolveAuthCallback(otp({ calls }), {
      callbackUrl:
        "http://127.0.0.1:3000/auth/callback?code=abcdefgh&access_token=secret",
      appEnv: "local",
      returnTo: "https://evil.example/phish",
    });

    expect(result).toEqual({
      status: "error",
      message: AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    });
    expect(calls).toEqual([]);
    expect(JSON.stringify(result).includes("evil.example")).toBe(false);
    expect(JSON.stringify(result).includes("secret")).toBe(false);
  });

  it("rejects a missing or malformed code without echoing it", async () => {
    const missing = await resolveAuthCallback(otp({ calls: [] }), {
      callbackUrl: callbackUrlFromCode(null),
      appEnv: "local",
    });
    const malformed = await resolveAuthCallback(otp({ calls: [] }), {
      callbackUrl: callbackUrlFromCode("short"),
      appEnv: "local",
    });

    expect(missing).toEqual({
      status: "error",
      message: AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    });
    expect(malformed.status).toBe("error");
    if (malformed.status === "error") {
      expect(malformed.message).toBe(AUTH_ERROR_MESSAGES.VALIDATION_FAILED);
    }
    expect(JSON.stringify(malformed).includes("short")).toBe(false);
  });

  it("maps a provider error without copying the query", () => {
    expect(rejectProviderCallback("access_denied")).toEqual({
      status: "error",
      message: AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    });
    expect(rejectProviderCallback("user_cancelled")).toEqual({
      status: "error",
      message: AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    });
    const other = rejectProviderCallback("server_error person@example.com");
    expect(other.message).toBe(AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE);
    expect(other.message.includes("person@")).toBe(false);
    expect(authQueryFlag(other.message)).toBe("unavailable");
  });
});

describe("home auth gate", () => {
  it("loads club context only after authentication", () => {
    expect(shouldLoadClubContext({ state: "loading" })).toBe(false);
    expect(shouldLoadClubContext({ state: "unauthenticated" })).toBe(false);
    expect(shouldLoadClubContext({ state: "expired" })).toBe(false);
    expect(
      shouldLoadClubContext({
        state: "recovery",
        errorCode: "INTERNAL",
        message: AUTH_ERROR_MESSAGES.INTERNAL,
      }),
    ).toBe(false);
    expect(
      shouldLoadClubContext({
        state: "authenticated",
        principal: { userId },
      }),
    ).toBe(true);
  });

  it("shows only known callback flags", () => {
    expect(callbackNotice({ auth: "validation" })).toBe(
      AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    );
    expect(callbackNotice({ auth: ["unavailable"] })).toBe(
      AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
    );
    expect(callbackNotice({ auth: "https://evil.example" })).toBeNull();
    expect(callbackNotice({})).toBeNull();
  });
});

function otp(input: { calls: string[] }): OtpAuthClient {
  return {
    async requestEmailOtp() {
      return undefined;
    },
    async verifyEmailOtp() {
      return { id: userId };
    },
    async exchangeEmailCode(code) {
      input.calls.push(code.code);
      return { id: userId };
    },
    async requestPhoneOtp() {
      return undefined;
    },
    async verifyPhoneOtp() {
      return { id: userId };
    },
  };
}
