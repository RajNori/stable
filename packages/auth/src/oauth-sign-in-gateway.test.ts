import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createSupabaseOAuthSignInGateway,
  type OAuthSignInApi,
} from "./oauth-sign-in-gateway.js";

const userId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const redirectTo = "http://127.0.0.1:3000/auth/callback";
const authorizeUrl = "http://127.0.0.1:54321/auth/v1/authorize?provider=google";
const leakedToken = "secret-access-token";
const idToken = "eyJhbGciOiJIUzI1NiJ9.payload.signature";
const nonce = "0123456789abcdef";
const code = "abcdefghijklmnop";

describe("supabase oauth sign-in gateway", () => {
  it("starts Google and Apple browser sign-in without returning session tokens", async () => {
    const google = fakeApi();
    const apple = fakeApi();

    await expect(
      createSupabaseOAuthSignInGateway(google.api).startBrowserSignIn({
        provider: "google",
        redirectTo,
      }),
    ).resolves.toEqual({ authorizationUrl: authorizeUrl });
    await expect(
      createSupabaseOAuthSignInGateway(apple.api).startBrowserSignIn({
        provider: "apple",
        redirectTo,
      }),
    ).resolves.toEqual({ authorizationUrl: authorizeUrl });
    expect(google.oauth).toEqual([
      {
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      },
    ]);
    expect(apple.oauth).toEqual([
      {
        provider: "apple",
        options: { redirectTo, skipBrowserRedirect: true },
      },
    ]);
  });

  it("returns only the adult from a code exchange and an ID token", async () => {
    const api = fakeApi();
    const gateway = createSupabaseOAuthSignInGateway(api.api);

    const exchanged = await gateway.exchangeSignInCode({ code });
    expect(exchanged).toEqual({ id: userId, displayName: "Alex M" });
    expect(JSON.stringify(exchanged).includes(leakedToken)).toBe(false);
    expect(JSON.stringify(exchanged).includes("person@example.com")).toBe(
      false,
    );
    await expect(
      gateway.signInWithIdToken({ provider: "apple", idToken, nonce }),
    ).resolves.toEqual({ id: userId, displayName: "Alex M" });
    expect(api.idTokens).toEqual([
      { provider: "apple", token: idToken, nonce },
    ]);
  });

  it("hides an email address that is not a display name", async () => {
    const gateway = createSupabaseOAuthSignInGateway(
      fakeApi({ metadata: { email: "person@example.com" } }).api,
    );

    await expect(gateway.exchangeSignInCode({ code })).resolves.toEqual({
      id: userId,
    });
  });

  it("rethrows provider failures and a missing authorize URL", async () => {
    const failed = fakeApi({
      oauthError: { code: "provider_error", message: leakedToken },
    });
    const blank = fakeApi({ url: null });
    const missing = fakeApi({ user: null });

    await expect(
      createSupabaseOAuthSignInGateway(failed.api).startBrowserSignIn({
        provider: "google",
        redirectTo,
      }),
    ).rejects.toEqual(failed.oauthError);
    await expect(
      createSupabaseOAuthSignInGateway(blank.api).startBrowserSignIn({
        provider: "apple",
        redirectTo,
      }),
    ).rejects.toEqual({ code: "provider_error" });
    await expect(
      createSupabaseOAuthSignInGateway(missing.api).exchangeSignInCode({
        code,
      }),
    ).resolves.toBeNull();
    await expect(
      createSupabaseOAuthSignInGateway(
        fakeApi({ exchangeError: { code: "bad_oauth_state" } }).api,
      ).exchangeSignInCode({ code }),
    ).rejects.toEqual({ code: "bad_oauth_state" });
    await expect(
      createSupabaseOAuthSignInGateway(
        fakeApi({ metadata: null }).api,
      ).exchangeSignInCode({ code }),
    ).resolves.toEqual({ id: userId });
    await expect(
      createSupabaseOAuthSignInGateway(
        fakeApi({ metadata: { display_name: "" } }).api,
      ).exchangeSignInCode({ code }),
    ).resolves.toEqual({ id: userId });
    await expect(
      createSupabaseOAuthSignInGateway(
        fakeApi({ idError: { code: "bad_oauth_callback" } }).api,
      ).signInWithIdToken({ provider: "google", idToken, nonce }),
    ).rejects.toEqual({ code: "bad_oauth_callback" });
  });

  it("does not call identity linking", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "oauth-sign-in-gateway.ts"),
      "utf8",
    );
    expect(source.includes("linkIdentity")).toBe(false);
  });
});

function fakeApi(input?: {
  url?: string | null;
  user?: null;
  metadata?: unknown | null;
  oauthError?: unknown;
  exchangeError?: unknown;
  idError?: unknown;
}): {
  api: OAuthSignInApi;
  oauth: Array<{
    provider: "google" | "apple";
    options: { redirectTo: string; skipBrowserRedirect: true };
  }>;
  idTokens: Array<{
    provider: "google" | "apple";
    token: string;
    nonce: string;
  }>;
  oauthError: unknown;
} {
  const oauth: Array<{
    provider: "google" | "apple";
    options: { redirectTo: string; skipBrowserRedirect: true };
  }> = [];
  const idTokens: Array<{
    provider: "google" | "apple";
    token: string;
    nonce: string;
  }> = [];
  const metadata =
    input !== undefined && "metadata" in input
      ? input.metadata
      : {
          display_name: "Alex M",
          access_token: leakedToken,
        };
  const user =
    input?.user === null
      ? null
      : {
          id: userId,
          user_metadata: metadata,
        };
  return {
    api: {
      async signInWithOAuth(credentials) {
        oauth.push(credentials);
        if (input?.oauthError !== undefined) {
          return { data: { url: null }, error: input.oauthError };
        }
        return {
          data: { url: input?.url === undefined ? authorizeUrl : input.url },
          error: null,
        };
      },
      async exchangeCodeForSession() {
        if (input?.exchangeError !== undefined) {
          return { data: { user: null }, error: input.exchangeError };
        }
        return { data: { user }, error: null };
      },
      async signInWithIdToken(credentials) {
        idTokens.push(credentials);
        if (input?.idError !== undefined) {
          return { data: { user: null }, error: input.idError };
        }
        return { data: { user }, error: null };
      },
    },
    oauth,
    idTokens,
    oauthError: input?.oauthError,
  };
}
