import { ApplicationError, type Principal } from "@stable/contracts";
import { describe, expect, it } from "vitest";

import { MANUAL_LINKING_IS_ENABLED } from "./identity-link-policy.js";
import {
  OAUTH_PROVIDER_SETTINGS,
  cancelOAuthIdentityLink,
  oauthProviderReady,
  preserveOAuthCallback,
  requestOAuthIdentityLink,
  startOAuthIdentityLink,
  type OAuthLinkGateway,
} from "./oauth-link.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const principal: Principal = { userId, displayName: "Alex M" };
const redirectTo = "http://127.0.0.1:3000/auth/callback";
const ready = { enabled: true, clientId: "unit-test-client" } as const;

describe("oauth identity link", () => {
  it("boots with Google and Apple disabled and no client id", () => {
    expect(MANUAL_LINKING_IS_ENABLED).toBe(false);
    expect(OAUTH_PROVIDER_SETTINGS.google).toEqual({
      enabled: false,
      clientId: null,
    });
    expect(OAUTH_PROVIDER_SETTINGS.apple).toEqual({
      enabled: false,
      clientId: null,
    });
    expect(oauthProviderReady(OAUTH_PROVIDER_SETTINGS.google)).toBe(false);
    expect(oauthProviderReady(OAUTH_PROVIDER_SETTINGS.apple)).toBe(false);
    expect(
      oauthProviderReady({ enabled: false, clientId: "unit-test-client" }),
    ).toBe(false);
    expect(
      oauthProviderReady({ enabled: true, clientId: "local-test-otp" }),
    ).toBe(false);
    expect(oauthProviderReady(ready)).toBe(true);
  });

  it("denies a signed-out link and a disabled manual-linking flag", async () => {
    const gateway = fakeGateway();

    await expect(
      requestOAuthIdentityLink(gateway.gateway, {
        principal: null,
        provider: "google",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(
      requestOAuthIdentityLink(gateway.gateway, {
        principal,
        provider: "apple",
        redirectTo,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
    expect(gateway.calls).toEqual([]);
  });

  it("rejects an unsafe callback before the provider", async () => {
    const gateway = fakeGateway();

    await expect(
      startOAuthIdentityLink(gateway.gateway, {
        principal,
        provider: "google",
        redirectTo: "https://evil.example/auth/callback",
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: ready,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    expect(gateway.calls).toEqual([]);
  });

  it("reports a disabled provider as unavailable", async () => {
    const gateway = fakeGateway();

    await expect(
      startOAuthIdentityLink(gateway.gateway, {
        principal,
        provider: "google",
        redirectTo,
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: OAUTH_PROVIDER_SETTINGS.google,
      }),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
    expect(gateway.calls).toEqual([]);
  });

  it("maps Google and Apple links without establishing the credential", async () => {
    const google = fakeGateway();
    const apple = fakeGateway();

    await expect(
      startOAuthIdentityLink(google.gateway, {
        principal,
        provider: "google",
        redirectTo,
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: ready,
      }),
    ).resolves.toEqual({
      status: "pending",
      provider: "google",
      userId,
      credentialEstablished: false,
    });
    await expect(
      startOAuthIdentityLink(apple.gateway, {
        principal,
        provider: "apple",
        redirectTo,
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: ready,
      }),
    ).resolves.toEqual({
      status: "pending",
      provider: "apple",
      userId,
      credentialEstablished: false,
    });
    expect(google.calls).toEqual([{ provider: "google", redirectTo }]);
    expect(apple.calls).toEqual([{ provider: "apple", redirectTo }]);
  });

  it("maps a collision and a provider payload to catalog errors", async () => {
    const collision = fakeGateway({
      error: {
        code: "identity_already_exists",
        message: "Identity already linked person@example.com",
        status: 422,
      },
    });
    const leaked = fakeGateway({
      error: {
        code: "provider_error",
        message: "google id_token eyJhbGciOi-secret",
      },
    });

    await expect(
      startOAuthIdentityLink(collision.gateway, {
        principal,
        provider: "google",
        redirectTo,
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: ready,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
    await expect(
      startOAuthIdentityLink(leaked.gateway, {
        principal,
        provider: "apple",
        redirectTo,
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: ready,
      }),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
  });

  it("rejects a link result for a different adult", async () => {
    const gateway = fakeGateway({ userId: otherUserId });

    await expect(
      startOAuthIdentityLink(gateway.gateway, {
        principal,
        provider: "apple",
        redirectTo,
        appEnv: "local",
        manualLinkingEnabled: true,
        settings: ready,
      }),
    ).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("preserves the authenticated adult when a link is cancelled", () => {
    expect(cancelOAuthIdentityLink(principal)).toEqual({
      state: "authenticated",
      principal,
    });
    expect(() => cancelOAuthIdentityLink(null)).toThrow(ApplicationError);
    expect(
      preserveOAuthCallback({
        principal,
        callbackUrl: `${redirectTo}?error=access_denied`,
        appEnv: "local",
      }),
    ).toEqual({ state: "authenticated", principal });
    expect(
      preserveOAuthCallback({
        principal,
        callbackUrl: `stable://auth/callback?error=user_cancelled`,
        appEnv: "local",
      }),
    ).toEqual({ state: "authenticated", principal });
    expect(
      preserveOAuthCallback({
        principal,
        callbackUrl: `${redirectTo}?code=abcdefghijklmnop`,
        appEnv: "local",
      }),
    ).toEqual({ state: "authenticated", principal });
  });

  it("rejects an unsafe oauth callback", () => {
    expect(() =>
      preserveOAuthCallback({
        principal: null,
        callbackUrl: `${redirectTo}?error=access_denied`,
        appEnv: "local",
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      preserveOAuthCallback({
        principal,
        callbackUrl: `${redirectTo}?access_token=secret-token`,
        appEnv: "local",
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      preserveOAuthCallback({
        principal,
        callbackUrl: "https://evil.example/auth/callback?code=abcdefghijklmnop",
        appEnv: "local",
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      preserveOAuthCallback({
        principal,
        callbackUrl: `${redirectTo}?code=abcdefghijklmnop`,
        appEnv: "staging",
      }),
    ).toThrow(ApplicationError);
    expect(() =>
      preserveOAuthCallback({
        principal,
        callbackUrl: `${redirectTo}?email=person@example.com`,
        appEnv: "local",
      }),
    ).toThrow(ApplicationError);
  });
});

function fakeGateway(input?: { error?: unknown; userId?: string }): {
  gateway: OAuthLinkGateway;
  calls: Array<{ provider: "google" | "apple"; redirectTo: string }>;
} {
  const calls: Array<{ provider: "google" | "apple"; redirectTo: string }> = [];
  return {
    gateway: {
      async linkIdentity(value) {
        calls.push(value);
        if (input?.error !== undefined) {
          throw input.error;
        }
        return { userId: input?.userId ?? userId };
      },
    },
    calls,
  };
}
