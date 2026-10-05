import { ApplicationError, type Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  EMAIL_CHANGE_MODE_BY_ENV,
  cancelEmailCredentialChange,
  requestEmailCredentialChange,
  verifyEmailCredentialChange,
  type EmailCredentialGateway,
} from "./email-credential.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const principal: Principal = { userId, displayName: "Alex M" };
const redirectTo = "http://127.0.0.1:3000/auth/callback";
const leakedEmail = "person@example.com";

describe("email credential change", () => {
  it("keeps hosted email-change modes unset and local mode explicit", () => {
    expect(EMAIL_CHANGE_MODE_BY_ENV).toEqual({
      local: "double_confirm",
      staging: "unset",
      production: "unset",
    });
  });

  it("requires an authenticated adult before the provider", async () => {
    const gateway = fakeGateway();

    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal: null,
        email: "adult@local.stable.test",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });
    expect(gateway.requests).toEqual([]);
  });

  it("starts a local change as pending and does not echo the address", async () => {
    const gateway = fakeGateway();

    const change = await requestEmailCredentialChange(gateway.gateway, {
      principal,
      email: "  Adult@local.stable.test  ",
      redirectTo,
      appEnv: "local",
    });

    expect(change).toEqual({ status: "pending", userId });
    expect(gateway.requests).toEqual([
      {
        email: "Adult@local.stable.test",
        redirectTo,
      },
    ]);
    expect(JSON.stringify(change).includes("Adult@local.stable.test")).toBe(
      false,
    );
  });

  it("does not call the provider for a bad address, unsafe redirect, or unset mode", async () => {
    const gateway = fakeGateway();

    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: "   ",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: `${"a".repeat(250)}@example.com`,
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: "not-an-email",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The sign-in details could not be checked.",
    });
    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: leakedEmail,
        redirectTo: "https://evil.example/auth/callback",
        appEnv: "local",
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: leakedEmail,
        redirectTo,
        appEnv: "staging",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: leakedEmail,
        redirectTo,
        appEnv: "production",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    expect(gateway.requests).toEqual([]);
  });

  it("maps an owned address to CONFLICT without the address", async () => {
    const gateway = fakeGateway({
      requestError: {
        code: "email_exists",
        message: `already registered ${leakedEmail}`,
        status: 422,
      },
    });

    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: leakedEmail,
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
  });

  it("rejects a provider result for a different adult", async () => {
    const gateway = fakeGateway({ userId: otherUserId });

    await expect(
      requestEmailCredentialChange(gateway.gateway, {
        principal,
        email: leakedEmail,
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: "Sign-in could not be completed.",
    });
  });

  it("keeps the credential pending until verification says it is committed", async () => {
    const gateway = fakeGateway({ established: false });

    const pending = await verifyEmailCredentialChange(gateway.gateway, {
      principal,
      email: "next@local.stable.test",
      token: "654321",
      appEnv: "local",
    });

    expect(pending).toEqual({ status: "pending", userId });
    expect(gateway.verifications).toEqual([
      { email: "next@local.stable.test", token: "654321" },
    ]);
  });

  it("establishes the credential only after the provider commits it", async () => {
    const gateway = fakeGateway({ established: true });

    const established = await verifyEmailCredentialChange(gateway.gateway, {
      principal,
      email: "next@local.stable.test",
      token: "654321",
      appEnv: "local",
    });

    expect(established).toEqual({ status: "established", userId });
    expect(JSON.stringify(established).includes("654321")).toBe(false);
  });

  it("rejects a short code and an unauthenticated verification", async () => {
    const gateway = fakeGateway();

    await expect(
      verifyEmailCredentialChange(gateway.gateway, {
        principal,
        email: "next@local.stable.test",
        token: "12",
        appEnv: "local",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      verifyEmailCredentialChange(gateway.gateway, {
        principal: null,
        email: "next@local.stable.test",
        token: "654321",
        appEnv: "local",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(gateway.verifications).toEqual([]);
  });

  it("maps a verification collision without provider text", async () => {
    const gateway = fakeGateway({
      verifyError: {
        code: "email_exists",
        message: `user already exists ${leakedEmail}`,
      },
    });

    await expect(
      verifyEmailCredentialChange(gateway.gateway, {
        principal,
        email: leakedEmail,
        token: "654321",
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
  });

  it("leaves the current adult in place when the change is cancelled", () => {
    expect(cancelEmailCredentialChange(principal)).toEqual({
      state: "authenticated",
      principal,
    });
    expect(() => cancelEmailCredentialChange(null)).toThrow(ApplicationError);
  });
});

function fakeGateway(input?: {
  requestError?: unknown;
  verifyError?: unknown;
  userId?: string;
  established?: boolean;
}): {
  gateway: EmailCredentialGateway;
  requests: Array<{ email: string; redirectTo: string }>;
  verifications: Array<{ email: string; token: string }>;
} {
  const state = {
    requests: [] as Array<{ email: string; redirectTo: string }>,
    verifications: [] as Array<{ email: string; token: string }>,
  };
  const userIdForResult = input?.userId ?? userId;
  return {
    gateway: {
      async requestEmailChange(value) {
        state.requests.push(value);
        if (input?.requestError !== undefined) {
          throw input.requestError;
        }
        return { userId: userIdForResult };
      },
      async verifyEmailChange(value) {
        state.verifications.push(value);
        if (input?.verifyError !== undefined) {
          throw input.verifyError;
        }
        return {
          userId: userIdForResult,
          established: input?.established ?? false,
        };
      },
    },
    requests: state.requests,
    verifications: state.verifications,
  };
}
