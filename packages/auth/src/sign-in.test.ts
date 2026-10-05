import { ApplicationError } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import type { OtpAuthClient, OtpProviderUser } from "./otp-auth-client.js";
import {
  completeEmailCallback,
  requestEmailSignIn,
  requestPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
} from "./sign-in.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const redirectTo = "http://127.0.0.1:3000/auth/callback";
const leakedEmail = "person@example.com";
const leakedPhone = "+61400999888";
const leakedOtp = "918273";

describe("email sign-in", () => {
  it("accepts a valid address and does not echo it", async () => {
    const client = fakeClient();

    const challenge = await requestEmailSignIn(client.client, {
      email: "  Adult@local.stable.test  ",
      redirectTo,
      appEnv: "local",
    });

    expect(challenge).toEqual({ status: "accepted", method: "email_otp" });
    expect(client.emails).toEqual(["Adult@local.stable.test"]);
    expect(client.redirects).toEqual([redirectTo]);
    expect(JSON.stringify(challenge).includes("Adult@local.stable.test")).toBe(
      false,
    );
  });

  it("does not call the provider for a malformed address or unsafe redirect", async () => {
    const client = fakeClient();

    await expect(
      requestEmailSignIn(client.client, {
        email: "not-an-email",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toThrow(ApplicationError);
    await expect(
      requestEmailSignIn(client.client, {
        email: "   ",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toThrow(ApplicationError);
    await expect(
      requestEmailSignIn(client.client, {
        email: `${"a".repeat(250)}@example.com`,
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toThrow(ApplicationError);
    await expect(
      requestEmailSignIn(client.client, {
        email: leakedEmail,
        redirectTo: "https://evil.example/auth/callback",
        appEnv: "local",
      }),
    ).rejects.toThrow(ApplicationError);

    expect(client.emails).toEqual([]);
    await expect(
      requestEmailSignIn(client.client, {
        email: "not-an-email",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      message: "The sign-in details could not be checked.",
    });
    await expect(
      requestEmailSignIn(client.client, {
        email: leakedEmail,
        redirectTo: `https://evil.example/callback?email=${leakedEmail}`,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The sign-in details could not be checked.",
    });
  });

  it("maps provider failures without the provider text", async () => {
    const client = fakeClient({
      requestError: {
        status: 429,
        message: `rate limit ${leakedEmail}`,
      },
    });

    await expect(
      requestEmailSignIn(client.client, {
        email: "adult@local.stable.test",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      message: "Too many sign-in attempts. Wait and try again.",
    });
  });

  it("verifies a code into a principal and maps expiry without the code", async () => {
    const client = fakeClient();

    const snapshot = await verifyEmailOtp(client.client, {
      email: "adult@local.stable.test",
      token: "654321",
    });

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(client.emailTokens).toEqual(["654321"]);

    const expired = fakeClient({
      verifyError: {
        code: "otp_expired",
        message: `code ${leakedOtp} for ${leakedEmail}`,
      },
    });
    await expect(
      verifyEmailOtp(expired.client, {
        email: "adult@local.stable.test",
        token: "000000",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The sign-in details could not be checked.",
    });
  });

  it("rejects a malformed email code before the provider", async () => {
    const client = fakeClient();

    await expect(
      verifyEmailOtp(client.client, {
        email: "adult@local.stable.test",
        token: "12",
      }),
    ).rejects.toThrow(ApplicationError);
    expect(client.emailTokens).toEqual([]);
  });

  it("exchanges a local callback and keeps the internal return path", async () => {
    const client = fakeClient();

    const completed = await completeEmailCallback(client.client, {
      callbackUrl: `${redirectTo}?code=abcdefghijklmnop`,
      appEnv: "local",
      returnTo: "/club-structure",
    });

    expect(completed.returnTo).toBe("/club-structure");
    expect(completed.snapshot).toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(client.codes).toEqual(["abcdefghijklmnop"]);
    expect(JSON.stringify(completed).includes("abcdefghijklmnop")).toBe(false);
  });

  it("uses the home path when the callback omits a return path", async () => {
    const client = fakeClient();

    const completed = await completeEmailCallback(client.client, {
      callbackUrl: `stable://auth/callback?code=abcdefghijklmnop`,
      appEnv: "local",
    });

    expect(completed.returnTo).toBe("/");
    expect(client.codes).toEqual(["abcdefghijklmnop"]);
  });

  it("rejects an unsafe callback before exchanging a code", async () => {
    const client = fakeClient();

    await expect(
      completeEmailCallback(client.client, {
        callbackUrl: `https://evil.example/callback?code=abcdefghijklmnop&email=${leakedEmail}`,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The sign-in details could not be checked.",
    });
    expect(client.codes).toEqual([]);
  });
});

describe("phone sign-in", () => {
  it.each(["0412345678", "+61412345678", "61412345678"])(
    "sends the normalized number for %s",
    async (phone) => {
      const client = fakeClient();

      const challenge = await requestPhoneOtp(client.client, { phone });

      expect(challenge).toEqual({ status: "accepted", method: "phone_otp" });
      expect(client.phones).toEqual(["+61412345678"]);
      expect(JSON.stringify(challenge).includes(phone)).toBe(false);
    },
  );

  it("does not call the provider for a malformed number", async () => {
    const client = fakeClient();

    await expect(
      requestPhoneOtp(client.client, {
        phone: leakedPhone.replace("+614", "+612"),
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "Enter an Australian mobile number.",
    });
    expect(client.phones).toEqual([]);
  });

  it("verifies a phone code into a principal", async () => {
    const client = fakeClient({ hideDisplayName: true });

    const snapshot = await verifyPhoneOtp(client.client, {
      phone: "0400 000 000",
      token: "654321",
    });

    expect(snapshot).toEqual({
      state: "authenticated",
      principal: { userId },
    });
    expect(client.phoneTokens).toEqual([
      { phoneE164: "+61400000000", token: "654321" },
    ]);
  });

  it("maps invalid, expired, rate-limit, and upstream phone failures", async () => {
    await expectFailure(
      { code: "invalid_otp", message: `bad ${leakedOtp} ${leakedPhone}` },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
    await expectFailure(
      { code: "otp_expired", message: `expired ${leakedOtp}` },
      "VALIDATION_FAILED",
      "The sign-in details could not be checked.",
    );
    await expectFailure(
      { status: 429, message: `rate limit ${leakedPhone}` },
      "RATE_LIMITED",
      "Too many sign-in attempts. Wait and try again.",
    );
    await expectFailure(
      new TypeError(`Failed to fetch ${leakedPhone}`),
      "UPSTREAM_UNAVAILABLE",
      "Sign-in is unavailable right now.",
    );
  });

  it("rejects a short phone code before the provider", async () => {
    const client = fakeClient();

    await expect(
      verifyPhoneOtp(client.client, { phone: "0400000000", token: "12" }),
    ).rejects.toThrow(ApplicationError);
    expect(client.phoneTokens).toEqual([]);
  });

  it("hides an unusable provider user id", async () => {
    const client = fakeClient({ userId: "not-a-uuid" });

    await expect(
      verifyPhoneOtp(client.client, { phone: "0400000000", token: "654321" }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: "Sign-in could not be completed.",
    });
  });
});

async function expectFailure(
  error: unknown,
  code: string,
  message: string,
): Promise<void> {
  const client = fakeClient({ verifyError: error });
  await expect(
    verifyPhoneOtp(client.client, { phone: "0400000000", token: "654321" }),
  ).rejects.toMatchObject({ code, message });
}

function fakeClient(input?: {
  requestError?: unknown;
  verifyError?: unknown;
  userId?: string;
  hideDisplayName?: boolean;
}): {
  client: OtpAuthClient;
  emails: string[];
  redirects: string[];
  emailTokens: string[];
  phones: string[];
  phoneTokens: Array<{ phoneE164: string; token: string }>;
  codes: string[];
} {
  const state = {
    emails: [] as string[],
    redirects: [] as string[],
    emailTokens: [] as string[],
    phones: [] as string[],
    phoneTokens: [] as Array<{ phoneE164: string; token: string }>,
    codes: [] as string[],
  };
  const user: OtpProviderUser = {
    id: input?.userId ?? userId,
  };
  if (input?.hideDisplayName !== true && input?.userId === undefined) {
    Object.assign(user, { displayName: "Alex M" });
  }

  const client: OtpAuthClient = {
    async requestEmailOtp(value) {
      state.emails.push(value.email);
      state.redirects.push(value.redirectTo);
      if (input?.requestError !== undefined) {
        throw input.requestError;
      }
    },
    async verifyEmailOtp(value) {
      state.emailTokens.push(value.token);
      if (input?.verifyError !== undefined) {
        throw input.verifyError;
      }
      return user;
    },
    async exchangeEmailCode(value) {
      state.codes.push(value.code);
      if (input?.verifyError !== undefined) {
        throw input.verifyError;
      }
      return user;
    },
    async requestPhoneOtp(value) {
      state.phones.push(value.phoneE164);
      if (input?.requestError !== undefined) {
        throw input.requestError;
      }
    },
    async verifyPhoneOtp(value) {
      state.phoneTokens.push(value);
      if (input?.verifyError !== undefined) {
        throw input.verifyError;
      }
      return user;
    },
  };

  return {
    client,
    emails: state.emails,
    redirects: state.redirects,
    emailTokens: state.emailTokens,
    phones: state.phones,
    phoneTokens: state.phoneTokens,
    codes: state.codes,
  };
}
