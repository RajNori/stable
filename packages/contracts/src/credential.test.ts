import { describe, expect, it } from "vitest";

import {
  LOCAL_SUPABASE_AUTH_ORIGIN,
  emailCredentialChangeSchema,
  isExpectedSupabaseAuthOrigin,
  isSafeOAuthAuthorizationUrl,
  oauthLinkReceiptSchema,
  oauthProviderSettingsSchema,
  oauthSignInNavigationSchema,
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

describe("oauth sign-in navigation contract", () => {
  const hosted = "https://abcdefghijklmnopqrst.supabase.co";

  it("accepts the local and hosted Supabase authorize URLs", () => {
    expect(
      oauthSignInNavigationSchema.parse({
        status: "redirect_required",
        provider: "google",
        authorizationUrl: `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google`,
      }).authorizationUrl,
    ).toBe(`${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google`);
    expect(
      oauthSignInNavigationSchema.parse({
        status: "redirect_required",
        provider: "apple",
        authorizationUrl: `${hosted}/auth/v1/authorize`,
      }).authorizationUrl,
    ).toBe(`${hosted}/auth/v1/authorize`);
    expect(
      oauthSignInNavigationSchema.safeParse({
        status: "redirect_required",
        provider: "google",
        authorizationUrl: `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize#provider=google`,
      }).success,
    ).toBe(true);
  });

  it("rejects tokens, emails, and unsafe authorize URLs", () => {
    const rejected = [
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?access_token=secret`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?refresh_token=secret`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider_token=secret`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?id_token=secret`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?email=person@example.com`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?email=person%40example.com`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?q=a b`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?redirect_to=%`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?${"a".repeat(2100)}`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize/extra`,
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://evil.example/auth/v1/authorize?provider=google",
      "https://abcdefghijklmnopqrst.supabase.co/evil",
      "not a url",
      "https://abcdefghijklmnopqrst.supabase.co",
    ];
    for (const authorizationUrl of rejected) {
      expect(
        oauthSignInNavigationSchema.safeParse({
          status: "redirect_required",
          provider: "apple",
          authorizationUrl,
        }).success,
      ).toBe(false);
    }
    expect(isExpectedSupabaseAuthOrigin("https://evil.example")).toBe(false);
    expect(
      isSafeOAuthAuthorizationUrl(
        `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?${"a".repeat(2100)}`,
        LOCAL_SUPABASE_AUTH_ORIGIN,
      ),
    ).toBe(false);
    expect(
      isSafeOAuthAuthorizationUrl(
        `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize`,
        "https://evil.example",
      ),
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
