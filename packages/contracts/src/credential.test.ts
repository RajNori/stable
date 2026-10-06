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

  it("rejects encoded token keys, nested emails, and unsafe fragments", () => {
    const local = `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize`;
    const rejected = [
      `${local}?access_token=secret`,
      `${local}?%61ccess_token=secret`,
      `${local}?access%5ftoken=secret`,
      `${local}?refresh_token=secret`,
      `${local}?provider_token=secret`,
      `${local}?id_token=secret`,
      `${local}?ACCESS_TOKEN=secret`,
      `${local}?email=person@example.com`,
      `${local}?email=person%40example.com`,
      `${local}?email=person%2540example.com`,
      `${local}?email=person%252540example.com`,
      `${local}?%65mail=person%2540example.com`,
      `${local}#access_token`,
      `${local}#access_token=secret`,
      `${local}#%61ccess_token=secret`,
      `${local}#email=person%2540example.com`,
      `${local}?state=%FF`,
      `${local}?state=%25252561`,
      `${local}?provider=google#access_token=secret`,
      `${hosted}/auth/v1/authorize?provider=google`,
      `${local}/extra`,
    ];
    for (const authorizationUrl of rejected) {
      expect(
        isSafeOAuthAuthorizationUrl(
          authorizationUrl,
          LOCAL_SUPABASE_AUTH_ORIGIN,
        ),
      ).toBe(false);
    }
    expect(
      isSafeOAuthAuthorizationUrl(
        `${hosted}/auth/v1/authorize?%61ccess_token=secret`,
        hosted,
      ),
    ).toBe(false);
    expect(
      isSafeOAuthAuthorizationUrl("http://[", LOCAL_SUPABASE_AUTH_ORIGIN),
    ).toBe(false);
    expect(
      isSafeOAuthAuthorizationUrl(
        "HTTP://127.0.0.1:54321/auth/v1/authorize",
        LOCAL_SUPABASE_AUTH_ORIGIN,
      ),
    ).toBe(false);
    expect(
      isSafeOAuthAuthorizationUrl(
        `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize/../authorize`,
        LOCAL_SUPABASE_AUTH_ORIGIN,
      ),
    ).toBe(false);
    expect(authorizationUrlWithoutParser(local)).toBe(false);
    expect(authorizationUrlWithInvalidParser(local)).toBe(false);
    expect(
      oauthSignInNavigationSchema.safeParse({
        status: "redirect_required",
        provider: "google",
        authorizationUrl: `${local}?email=person%2540example.com`,
      }).success,
    ).toBe(false);
  });

  it("allows a canonical authorize URL with ordinary encoded parameters", () => {
    const allowed = [
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google&code_challenge=abc-def_123&code_challenge_method=S256`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?state=abc%2Fdef`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?redirect_to=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Fcallback`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?state=100%25done`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?state=%252561`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google#state=ok`,
      `${hosted}/auth/v1/authorize?provider=apple`,
      `${hosted}/auth/v1/authorize#provider=apple`,
    ];
    for (const authorizationUrl of allowed) {
      const origin = authorizationUrl.startsWith(hosted)
        ? hosted
        : LOCAL_SUPABASE_AUTH_ORIGIN;
      expect(isSafeOAuthAuthorizationUrl(authorizationUrl, origin)).toBe(true);
    }
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

function authorizationUrlWithoutParser(authorizationUrl: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "URL");
  Reflect.deleteProperty(globalThis, "URL");
  try {
    return isSafeOAuthAuthorizationUrl(
      authorizationUrl,
      LOCAL_SUPABASE_AUTH_ORIGIN,
    );
  } finally {
    if (descriptor !== undefined) {
      Object.defineProperty(globalThis, "URL", descriptor);
    }
  }
}

function authorizationUrlWithInvalidParser(authorizationUrl: string): boolean {
  return withReplacedUrl("not-a-parser", () =>
    isSafeOAuthAuthorizationUrl(authorizationUrl, LOCAL_SUPABASE_AUTH_ORIGIN),
  );
}

function withReplacedUrl(replacement: unknown, read: () => boolean): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "URL");
  Object.defineProperty(globalThis, "URL", {
    configurable: true,
    value: replacement,
  });
  try {
    return read();
  } finally {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, "URL");
    } else {
      Object.defineProperty(globalThis, "URL", descriptor);
    }
  }
}
