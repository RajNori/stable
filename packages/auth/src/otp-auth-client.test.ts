import { describe, expect, it } from "vitest";

import {
  createSupabaseOtpAuthClient,
  type OtpAuthResult,
  type SupabaseOtpApi,
} from "./otp-auth-client.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const leakedToken = "secret-access-token";
const leakedRefresh = "secret-refresh-token";

describe("createSupabaseOtpAuthClient", () => {
  it("sends email and phone challenges without returning provider payloads", async () => {
    const api = fakeApi();
    const client = createSupabaseOtpAuthClient(api.api);

    await client.requestEmailOtp({
      email: "adult@local.stable.test",
      redirectTo: "http://127.0.0.1:3000/auth/callback",
    });
    await client.requestPhoneOtp({ phoneE164: "+61412345678" });

    expect(api.emailRedirects).toEqual(["http://127.0.0.1:3000/auth/callback"]);
    expect(api.phones).toEqual(["+61412345678"]);
  });

  it("returns only the adult id from email and phone verification", async () => {
    const api = fakeApi();
    const client = createSupabaseOtpAuthClient(api.api);

    const emailUser = await client.verifyEmailOtp({
      email: "adult@local.stable.test",
      token: "654321",
    });
    const phoneUser = await client.verifyPhoneOtp({
      phoneE164: "+61400000000",
      token: "654321",
    });
    const exchanged = await client.exchangeEmailCode({
      code: "abcdefghijklmnop",
    });

    expect(emailUser).toEqual({ id: userId, displayName: "Alex M" });
    expect(phoneUser).toEqual({ id: userId });
    expect(exchanged).toEqual({ id: userId });
    expect(JSON.stringify(emailUser).includes(leakedToken)).toBe(false);
    expect(JSON.stringify(phoneUser).includes(leakedRefresh)).toBe(false);
  });

  it("throws the provider error and hides a missing user", async () => {
    const api = fakeApi({
      fail: { status: 429, message: "too many person@example.com" },
    });
    const client = createSupabaseOtpAuthClient(api.api);

    await expect(
      client.requestEmailOtp({
        email: "adult@local.stable.test",
        redirectTo: "http://127.0.0.1:3000/auth/callback",
      }),
    ).rejects.toEqual({
      status: 429,
      message: "too many person@example.com",
    });
    await expect(
      client.requestPhoneOtp({ phoneE164: "+61400000000" }),
    ).rejects.toEqual({
      status: 429,
      message: "too many person@example.com",
    });

    await expect(
      client.verifyEmailOtp({
        email: "adult@local.stable.test",
        token: "654321",
      }),
    ).rejects.toEqual({
      status: 429,
      message: "too many person@example.com",
    });

    const missing = fakeApi({ user: null });
    await expect(
      createSupabaseOtpAuthClient(missing.api).verifyEmailOtp({
        email: "adult@local.stable.test",
        token: "654321",
      }),
    ).rejects.toThrow("Sign-in could not be completed.");

    const blank = fakeApi({
      user: { id: userId, user_metadata: null },
    });
    await expect(
      createSupabaseOtpAuthClient(blank.api).verifyEmailOtp({
        email: "adult@local.stable.test",
        token: "654321",
      }),
    ).resolves.toEqual({ id: userId });
  });
});

function sessionResult(input: {
  user: OtpAuthResult["data"]["user"];
}): OtpAuthResult {
  return {
    data: {
      user: input.user,
      session: {
        access_token: leakedToken,
        refresh_token: leakedRefresh,
        expires_at: 1_700_000_000,
      },
    },
    error: null,
  };
}

function fakeApi(input?: {
  fail?: unknown;
  user?: OtpAuthResult["data"]["user"];
}): {
  api: SupabaseOtpApi;
  emailRedirects: string[];
  phones: string[];
} {
  const emailRedirects: string[] = [];
  const phones: string[] = [];
  const user =
    input !== undefined && "user" in input
      ? input.user
      : {
          id: userId,
          user_metadata: { display_name: "Alex M", access_token: leakedToken },
        };
  const api: SupabaseOtpApi = {
    async signInWithOtp(credentials) {
      if ("email" in credentials) {
        emailRedirects.push(credentials.options.emailRedirectTo);
        return { error: input?.fail ?? null };
      }
      phones.push(credentials.phone);
      if (input?.fail !== undefined) {
        return { error: input.fail };
      }
      return { error: undefined };
    },
    async verifyOtp(params) {
      if (input?.fail !== undefined) {
        return {
          data: { user: null, session: null },
          error: input.fail,
        };
      }
      if ("phone" in params) {
        return sessionResult({
          user: { id: userId, user_metadata: { access_token: leakedToken } },
        });
      }
      return sessionResult({ user: user ?? null });
    },
    async exchangeCodeForSession() {
      const result = sessionResult({
        user: { id: userId, user_metadata: { display_name: "" } },
      });
      return { ...result, error: undefined };
    },
  };

  return { api, emailRedirects, phones };
}
