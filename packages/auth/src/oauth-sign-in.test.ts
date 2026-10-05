import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ApplicationError,
  LOCAL_SUPABASE_AUTH_ORIGIN,
} from "@stable/contracts";
import { describe, expect, it } from "vitest";

import {
  MANUAL_LINKING_IS_ENABLED,
  decideIdentityLink,
} from "./identity-link-policy.js";
import {
  OAUTH_PROVIDER_SETTINGS,
  requestOAuthIdentityLink,
} from "./oauth-link.js";
import {
  MOBILE_OAUTH_SIGN_IN,
  appleRequestNonce,
  cancelOAuthSignIn,
  completeOAuthIdTokenSignIn,
  completeOAuthSignIn,
  finishOAuthBrowserSignIn,
  finishOAuthIdTokenSignIn,
  issueOAuthNonce,
  requestOAuthSignIn,
  startOAuthBrowserSignIn,
  type OAuthSignInGateway,
} from "./oauth-sign-in.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const redirectTo = "http://127.0.0.1:3000/auth/callback";
const ready = { enabled: true, clientId: "unit-test-client" } as const;
const hostedOrigin = "https://abcdefghijklmnopqrst.supabase.co";
const authorizeUrl = `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2F127.0.0.1%3A3000%2Fauth%2Fcallback`;
const hostedAuthorizeUrl = `${hostedOrigin}/auth/v1/authorize?provider=apple`;
const code = "abcdefghijklmnop";
const nonce = "0123456789abcdef";
const idToken = "eyJhbGciOiJIUzI1NiJ9.payload.signature";
const leakedEmail = "person@example.com";

describe("oauth sign-in", () => {
  it("keeps mobile Apple native and mobile Google on the browser path", () => {
    expect(MOBILE_OAUTH_SIGN_IN).toEqual({
      apple: "native_id_token",
      google: "browser_oauth",
    });
    expect(MANUAL_LINKING_IS_ENABLED).toBe(false);
  });

  it("does not merge adults from a verified email, an Apple relay, or different provider emails", () => {
    expect(
      decideIdentityLink({
        kind: "oauth_email",
        providerEmailVerified: true,
        existingAccountWithSameEmail: true,
        autoconfirm: false,
      }),
    ).toMatchObject({
      application: "keep_separate",
      providerMayAutomaticLink: true,
      createsProfile: false,
      transfersMembership: false,
    });
    expect(decideIdentityLink({ kind: "apple_private_relay" })).toMatchObject({
      application: "keep_separate",
      providerMayAutomaticLink: false,
    });
    expect(
      decideIdentityLink({ kind: "different_provider_emails" }),
    ).toMatchObject({
      application: "keep_separate",
      providerMayAutomaticLink: false,
    });
  });

  it("allows a signed-out browser sign-in without manual linking", async () => {
    const google = fakeGateway();
    const apple = fakeGateway({ authorizationUrl: hostedAuthorizeUrl });

    await expect(
      startOAuthBrowserSignIn(google.gateway, {
        provider: "google",
        redirectTo,
        appEnv: "local",
        authOrigin: LOCAL_SUPABASE_AUTH_ORIGIN,
        settings: ready,
      }),
    ).resolves.toEqual({
      status: "redirect_required",
      provider: "google",
      authorizationUrl: authorizeUrl,
    });
    await expect(
      startOAuthBrowserSignIn(apple.gateway, {
        provider: "apple",
        redirectTo: "stable://auth/callback",
        appEnv: "local",
        authOrigin: hostedOrigin,
        settings: ready,
      }),
    ).resolves.toEqual({
      status: "redirect_required",
      provider: "apple",
      authorizationUrl: hostedAuthorizeUrl,
    });
    expect(google.browser).toEqual([{ provider: "google", redirectTo }]);
    expect(apple.browser).toEqual([
      { provider: "apple", redirectTo: "stable://auth/callback" },
    ]);
    expect(google.links).toBe(0);
  });

  it("fails a disabled provider and an unsafe redirect before the provider call", async () => {
    const gateway = fakeGateway();

    await expect(
      requestOAuthSignIn(gateway.gateway, {
        provider: "google",
        redirectTo,
        appEnv: "local",
        authOrigin: LOCAL_SUPABASE_AUTH_ORIGIN,
      }),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
    await expect(
      requestOAuthSignIn(gateway.gateway, {
        provider: "apple",
        redirectTo: "https://evil.example/auth/callback",
        appEnv: "local",
        authOrigin: LOCAL_SUPABASE_AUTH_ORIGIN,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The sign-in details could not be checked.",
    });
    expect(gateway.browser).toEqual([]);
  });

  it("accepts only the expected Supabase authorize URL", async () => {
    await expect(
      navigationFor(
        `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google`,
        LOCAL_SUPABASE_AUTH_ORIGIN,
      ),
    ).resolves.toMatchObject({
      authorizationUrl: `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider=google`,
    });
    await expect(
      navigationFor(hostedAuthorizeUrl, hostedOrigin),
    ).resolves.toMatchObject({ authorizationUrl: hostedAuthorizeUrl });
  });

  it("rejects an authorization URL with a token, email, or unsafe origin", async () => {
    const rejected = [
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?access_token=secret-token`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?refresh_token=secret-token`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?provider_token=secret-token`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?id_token=secret-token`,
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?email=person@example.com`,
      "javascript:alert(1)",
      "data:text/html,hi",
      "https://evil.example/auth/v1/authorize?provider=google",
      "not a url",
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize?redirect_to=%`,
      hostedAuthorizeUrl,
    ];
    await expect(
      navigationFor(authorizeUrl, "https://evil.example"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    for (const authorizationUrl of rejected) {
      await expect(
        navigationFor(authorizationUrl, LOCAL_SUPABASE_AUTH_ORIGIN),
      ).rejects.toMatchObject({
        code: "VALIDATION_FAILED",
        message: "The sign-in details could not be checked.",
      });
    }
  });

  it("exchanges a safe callback into an AuthSessionSnapshot", async () => {
    const gateway = fakeGateway();
    const readyProviders = { google: ready, apple: ready };

    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?code=${code}`,
        appEnv: "local",
        settings: readyProviders,
      }),
    ).resolves.toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    expect(gateway.codes).toEqual([code]);
  });

  it("does not exchange while both providers are disabled", async () => {
    const gateway = fakeGateway();

    await expect(
      completeOAuthSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?code=${code}`,
        appEnv: "local",
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(gateway.codes).toEqual([]);
  });

  it("rejects an unsafe callback, a cancellation, and a bad code", async () => {
    const gateway = fakeGateway();
    const settings = { google: ready, apple: ready };

    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?access_token=secret-token`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toBeInstanceOf(ApplicationError);
    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?error=access_denied`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: "stable://auth/callback?error=user_cancelled",
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?code=short`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?error=server_error`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    expect(gateway.codes).toEqual([]);
  });

  it("maps collision, upstream failure, and a missing session without provider text", async () => {
    const settings = { google: ready, apple: ready };
    const collision = fakeGateway({
      exchangeError: {
        code: "identity_already_exists",
        message: `identity already linked ${leakedEmail}`,
        status: 422,
      },
    });
    const upstream = fakeGateway({
      exchangeError: {
        code: "provider_error",
        message: `google token ${idToken}`,
      },
    });
    const missing = fakeGateway({ adult: null });

    await expect(
      finishOAuthBrowserSignIn(collision.gateway, {
        callbackUrl: `${redirectTo}?code=${code}`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "This sign-in method can't be added.",
    });
    await expect(
      finishOAuthBrowserSignIn(upstream.gateway, {
        callbackUrl: `${redirectTo}?code=${code}`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Sign-in is unavailable right now.",
    });
    await expect(
      finishOAuthBrowserSignIn(missing.gateway, {
        callbackUrl: `${redirectTo}?code=${code}`,
        appEnv: "local",
        settings,
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    });
  });

  it("signs in with an Apple or Google ID token and a nonce", async () => {
    const apple = fakeGateway();
    const google = fakeGateway();

    await expect(
      finishOAuthIdTokenSignIn(apple.gateway, {
        provider: "apple",
        idToken,
        nonce,
        settings: ready,
      }),
    ).resolves.toEqual({
      state: "authenticated",
      principal: { userId, displayName: "Alex M" },
    });
    await expect(
      finishOAuthIdTokenSignIn(google.gateway, {
        provider: "google",
        idToken,
        nonce,
        settings: ready,
      }),
    ).resolves.toMatchObject({ state: "authenticated" });
    expect(apple.idTokens).toEqual([{ provider: "apple", idToken, nonce }]);
    expect(JSON.stringify(apple.idTokens[0]).includes("access_token")).toBe(
      false,
    );
    const snapshot = await finishOAuthIdTokenSignIn(apple.gateway, {
      provider: "apple",
      idToken,
      nonce,
      settings: ready,
    });
    expect(JSON.stringify(snapshot).includes(idToken)).toBe(false);
    expect(JSON.stringify(snapshot).includes(nonce)).toBe(false);
  });

  it("rejects a disabled native provider, a weak nonce, and a cancelled ID token", async () => {
    const gateway = fakeGateway();

    await expect(
      completeOAuthIdTokenSignIn(gateway.gateway, {
        provider: "apple",
        idToken,
        nonce,
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_UNAVAILABLE" });
    await expect(
      finishOAuthIdTokenSignIn(gateway.gateway, {
        provider: "apple",
        idToken,
        nonce: "short",
        settings: ready,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthIdTokenSignIn(gateway.gateway, {
        provider: "apple",
        idToken: "short token",
        nonce,
        settings: ready,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: redirectTo,
        appEnv: "local",
        settings: { google: ready, apple: ready },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthBrowserSignIn(gateway.gateway, {
        callbackUrl: `${redirectTo}?error=%`,
        appEnv: "local",
        settings: { google: ready, apple: ready },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      finishOAuthIdTokenSignIn(
        fakeGateway({ adult: { id: "not-a-uuid" } }).gateway,
        {
          provider: "apple",
          idToken,
          nonce,
          settings: ready,
        },
      ),
    ).rejects.toMatchObject({ code: "INTERNAL" });
    await expect(
      finishOAuthIdTokenSignIn(
        fakeGateway({
          idTokenError: {
            code: "user_cancelled",
            message: `cancelled ${idToken}`,
          },
        }).gateway,
        {
          provider: "google",
          idToken,
          nonce,
          settings: ready,
        },
      ),
    ).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      message: "The sign-in details could not be checked.",
    });
    expect(gateway.idTokens).toEqual([]);
  });

  it("leaves the adult signed out when browser sign-in is cancelled", () => {
    expect(cancelOAuthSignIn()).toEqual({ state: "unauthenticated" });
  });

  it("issues a nonce and the Apple request hash", async () => {
    const issued = issueOAuthNonce();
    expect(issued).toMatch(/^[a-f0-9]{64}$/u);
    expect(issueOAuthNonce()).not.toBe(issued);
    await expect(appleRequestNonce(nonce)).resolves.toBe(
      "9f9f5111f7b27a781f1f1ddde5ebc2dd2b796bfc7365c9c28b548e564176929f",
    );
    await expect(appleRequestNonce("short")).rejects.toBeInstanceOf(
      ApplicationError,
    );
  });

  it("keeps identity linking behind manual linking and out of the sign-in module", async () => {
    const directory = dirname(fileURLToPath(import.meta.url));
    const signIn = readFileSync(join(directory, "oauth-sign-in.ts"), "utf8");
    const linking = readFileSync(join(directory, "oauth-link.ts"), "utf8");
    expect(signIn.includes("linkIdentity")).toBe(false);
    expect(linking.includes("signInWithOAuth")).toBe(false);
    expect(linking.includes("signInWithIdToken")).toBe(false);
    await expect(
      requestOAuthIdentityLink(
        {
          async linkIdentity() {
            return { userId };
          },
        },
        {
          principal: { userId },
          provider: "google",
          redirectTo,
          appEnv: "local",
        },
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(OAUTH_PROVIDER_SETTINGS.google.enabled).toBe(false);
    expect(OAUTH_PROVIDER_SETTINGS.apple.clientId).toBeNull();
  });
});

function navigationFor(
  authorizationUrl: string,
  authOrigin: string,
): Promise<unknown> {
  return startOAuthBrowserSignIn(fakeGateway({ authorizationUrl }).gateway, {
    provider: "google",
    redirectTo,
    appEnv: "local",
    authOrigin,
    settings: ready,
  });
}

function fakeGateway(input?: {
  authorizationUrl?: string;
  adult?: { id: string; displayName?: string } | null;
  exchangeError?: unknown;
  idTokenError?: unknown;
  browserError?: unknown;
}): {
  gateway: OAuthSignInGateway;
  browser: Array<{ provider: "google" | "apple"; redirectTo: string }>;
  codes: string[];
  idTokens: Array<{
    provider: "google" | "apple";
    idToken: string;
    nonce: string;
  }>;
  links: number;
} {
  const state = {
    browser: [] as Array<{ provider: "google" | "apple"; redirectTo: string }>,
    codes: [] as string[],
    idTokens: [] as Array<{
      provider: "google" | "apple";
      idToken: string;
      nonce: string;
    }>,
    links: 0,
  };
  const adult =
    input?.adult === undefined
      ? { id: userId, displayName: "Alex M" }
      : input.adult;
  return {
    gateway: {
      async startBrowserSignIn(value) {
        state.browser.push(value);
        if (input?.browserError !== undefined) {
          throw input.browserError;
        }
        return { authorizationUrl: input?.authorizationUrl ?? authorizeUrl };
      },
      async exchangeSignInCode(value) {
        state.codes.push(value.code);
        if (input?.exchangeError !== undefined) {
          throw input.exchangeError;
        }
        return adult;
      },
      async signInWithIdToken(value) {
        state.idTokens.push(value);
        if (input?.idTokenError !== undefined) {
          throw input.idTokenError;
        }
        return adult;
      },
    },
    browser: state.browser,
    codes: state.codes,
    idTokens: state.idTokens,
    links: state.links,
  };
}
