import { describe, expect, it } from "vitest";

import {
  emailCredentialChangeSchema,
  oauthLinkReceiptSchema,
  oauthProviderSettingsSchema,
} from "./credential.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("email credential change contract", () => {
  it("accepts a pending change without the email address", () => {
    expect(
      emailCredentialChangeSchema.parse({ status: "pending", userId }),
    ).toEqual({ status: "pending", userId });
  });

  it("rejects an email address on the result", () => {
    expect(
      emailCredentialChangeSchema.safeParse({
        status: "established",
        userId,
        email: "adult@example.com",
      }).success,
    ).toBe(false);
  });
});

describe("oauth link contract", () => {
  it("accepts a pending Google or Apple link with no provider payload", () => {
    expect(
      oauthLinkReceiptSchema.parse({
        status: "pending",
        provider: "google",
        userId,
        credentialEstablished: false,
      }),
    ).toEqual({
      status: "pending",
      provider: "google",
      userId,
      credentialEstablished: false,
    });
  });

  it("rejects an established credential or a raw token", () => {
    expect(
      oauthLinkReceiptSchema.safeParse({
        status: "pending",
        provider: "apple",
        userId,
        credentialEstablished: true,
      }).success,
    ).toBe(false);
    expect(
      oauthLinkReceiptSchema.safeParse({
        status: "pending",
        provider: "apple",
        userId,
        credentialEstablished: false,
        accessToken: "secret-token",
      }).success,
    ).toBe(false);
  });
});

describe("oauth provider settings contract", () => {
  it("accepts a disabled provider with no client id", () => {
    expect(
      oauthProviderSettingsSchema.parse({ enabled: false, clientId: null }),
    ).toEqual({ enabled: false, clientId: null });
    expect(
      oauthProviderSettingsSchema.parse({
        enabled: true,
        clientId: "unit-test-client",
      }),
    ).toEqual({ enabled: true, clientId: "unit-test-client" });
  });

  it("rejects an enabled provider without a real client id", () => {
    expect(
      oauthProviderSettingsSchema.safeParse({
        enabled: true,
        clientId: null,
      }).success,
    ).toBe(false);
    expect(
      oauthProviderSettingsSchema.safeParse({
        enabled: true,
        clientId: "local-test-otp",
      }).success,
    ).toBe(false);
    expect(
      oauthProviderSettingsSchema.safeParse({
        enabled: true,
        clientId: "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)",
      }).success,
    ).toBe(false);
  });
});
