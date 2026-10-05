import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  authSessionSnapshotSchema,
  isExpectedSupabaseAuthOrigin,
  isSafeOAuthAuthorizationUrl,
  oauthSignInNavigationSchema,
  type AppEnv,
  type AuthSessionSnapshot,
  type OAuthProviderSettings,
  type OAuthSignInNavigation,
} from "@stable/contracts";

import {
  assertAllowedSignInRedirect,
  authCodeFromCallback,
} from "./auth-redirect.js";
import { OAUTH_PROVIDER_SETTINGS, oauthProviderReady } from "./oauth-link.js";
import { mapAuthError } from "./map-auth-error.js";
import { principalFromSession } from "./principal-from-session.js";

/**
 * Mobile Apple uses native Sign in with Apple and signInWithIdToken.
 * Mobile Google uses the same browser OAuth path as web, through the
 * stable:// callback, because this Expo app has no Google native SDK.
 * A native Google ID token can still use completeOAuthIdTokenSignIn later.
 */
export const MOBILE_OAUTH_SIGN_IN = {
  apple: "native_id_token",
  google: "browser_oauth",
} as const;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

export type OAuthSignInAdult = {
  readonly id: string;
  readonly displayName?: string;
};

export type OAuthSignInGateway = {
  startBrowserSignIn(input: {
    provider: "google" | "apple";
    redirectTo: string;
  }): Promise<{ authorizationUrl: string }>;
  exchangeSignInCode(input: { code: string }): Promise<OAuthSignInAdult | null>;
  signInWithIdToken(input: {
    provider: "google" | "apple";
    idToken: string;
    nonce: string;
  }): Promise<OAuthSignInAdult | null>;
};

export async function requestOAuthSignIn(
  gateway: OAuthSignInGateway,
  input: {
    provider: "google" | "apple";
    redirectTo: string;
    appEnv: AppEnv;
    authOrigin: string;
  },
): Promise<OAuthSignInNavigation> {
  return startOAuthBrowserSignIn(gateway, {
    ...input,
    settings: OAUTH_PROVIDER_SETTINGS[input.provider],
  });
}

/**
 * Browser sign-in with an explicit provider setting.
 * The package entry requestOAuthSignIn binds the disabled configuration.
 */
export async function startOAuthBrowserSignIn(
  gateway: OAuthSignInGateway,
  input: {
    provider: "google" | "apple";
    redirectTo: string;
    appEnv: AppEnv;
    authOrigin: string;
    settings: OAuthProviderSettings;
  },
): Promise<OAuthSignInNavigation> {
  const redirectTo = assertAllowedSignInRedirect(
    input.redirectTo,
    input.appEnv,
  );
  const authOrigin = assertExpectedAuthOrigin(input.authOrigin);
  assertProviderReady(input.settings);
  const started = await fromProvider(() =>
    gateway.startBrowserSignIn({ provider: input.provider, redirectTo }),
  );
  return oauthSignInNavigationSchema.parse({
    status: "redirect_required",
    provider: input.provider,
    authorizationUrl: assertAuthorizationUrl(
      started.authorizationUrl,
      authOrigin,
    ),
  });
}

export async function completeOAuthSignIn(
  gateway: OAuthSignInGateway,
  input: { callbackUrl: string; appEnv: AppEnv },
): Promise<AuthSessionSnapshot> {
  return finishOAuthBrowserSignIn(gateway, {
    ...input,
    settings: OAUTH_PROVIDER_SETTINGS,
  });
}

export async function finishOAuthBrowserSignIn(
  gateway: OAuthSignInGateway,
  input: {
    callbackUrl: string;
    appEnv: AppEnv;
    settings: { google: OAuthProviderSettings; apple: OAuthProviderSettings };
  },
): Promise<AuthSessionSnapshot> {
  if (
    !oauthProviderReady(input.settings.google) &&
    !oauthProviderReady(input.settings.apple)
  ) {
    throw unavailable();
  }
  rejectUnsafeCallback(input.callbackUrl);
  const code = authCodeFromCallback(input.callbackUrl, input.appEnv);
  const adult = await fromProvider(() => gateway.exchangeSignInCode({ code }));
  return authenticatedSnapshot(adult);
}

export async function completeOAuthIdTokenSignIn(
  gateway: OAuthSignInGateway,
  input: {
    provider: "google" | "apple";
    idToken: string;
    nonce: string;
  },
): Promise<AuthSessionSnapshot> {
  return finishOAuthIdTokenSignIn(gateway, {
    ...input,
    settings: OAUTH_PROVIDER_SETTINGS[input.provider],
  });
}

export async function finishOAuthIdTokenSignIn(
  gateway: OAuthSignInGateway,
  input: {
    provider: "google" | "apple";
    idToken: string;
    nonce: string;
    settings: OAuthProviderSettings;
  },
): Promise<AuthSessionSnapshot> {
  assertProviderReady(input.settings);
  assertOAuthNonce(input.nonce);
  assertIdToken(input.idToken);
  const adult = await fromProvider(() =>
    gateway.signInWithIdToken({
      provider: input.provider,
      idToken: input.idToken,
      nonce: input.nonce,
    }),
  );
  return authenticatedSnapshot(adult);
}

export function cancelOAuthSignIn(): AuthSessionSnapshot {
  return authSessionSnapshotSchema.parse({ state: "unauthenticated" });
}

export function issueOAuthNonce(): string {
  const bytes = new Uint8Array(32);
  webCrypto().getRandomValues(bytes);
  return hex(bytes.buffer);
}

/**
 * Apple receives the SHA-256 hex of the raw nonce.
 * signInWithIdToken receives the same raw nonce, which Supabase hashes again.
 */
export async function appleRequestNonce(rawNonce: string): Promise<string> {
  assertOAuthNonce(rawNonce);
  const bytes = new Uint8Array(rawNonce.length);
  for (let index = 0; index < rawNonce.length; index += 1) {
    bytes[index] = rawNonce.charCodeAt(index);
  }
  return hex(await webCrypto().subtle.digest("SHA-256", bytes));
}

type WebCryptoSource = {
  getRandomValues(array: Uint8Array): Uint8Array;
  subtle: {
    digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>;
  };
};

function webCrypto(): WebCryptoSource {
  const host: unknown = globalThis;
  if (typeof host !== "object" || host === null || !("crypto" in host)) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
  const candidate: unknown = host.crypto;
  if (!isWebCrypto(candidate)) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
  return candidate;
}

function isWebCrypto(value: unknown): value is WebCryptoSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("getRandomValues" in value) || !("subtle" in value)) {
    return false;
  }
  const subtle: unknown = value.subtle;
  return (
    typeof value.getRandomValues === "function" &&
    typeof subtle === "object" &&
    subtle !== null &&
    "digest" in subtle &&
    typeof subtle.digest === "function"
  );
}

function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let encoded = "";
  for (const byte of bytes) {
    encoded += byte.toString(16).padStart(2, "0");
  }
  return encoded;
}

function assertOAuthNonce(nonce: string): void {
  if (!NONCE_PATTERN.test(nonce)) {
    throw validationFailed();
  }
}

function assertIdToken(idToken: string): void {
  if (idToken.length < 20 || idToken.length > 8192 || /\s/u.test(idToken)) {
    throw validationFailed();
  }
}

function assertProviderReady(settings: OAuthProviderSettings): void {
  if (!oauthProviderReady(settings)) {
    throw unavailable();
  }
}

function assertExpectedAuthOrigin(authOrigin: string): string {
  if (!isExpectedSupabaseAuthOrigin(authOrigin)) {
    throw validationFailed();
  }
  return authOrigin;
}

function assertAuthorizationUrl(
  authorizationUrl: string,
  authOrigin: string,
): string {
  if (!isSafeOAuthAuthorizationUrl(authorizationUrl, authOrigin)) {
    throw validationFailed();
  }
  return authorizationUrl;
}

function rejectUnsafeCallback(callbackUrl: string): void {
  if (
    callbackUrl.includes("@") ||
    callbackUrl.toLowerCase().includes("access_token")
  ) {
    throw validationFailed();
  }
  const error = callbackError(callbackUrl);
  if (error === "access_denied" || error === "user_cancelled") {
    throw validationFailed();
  }
  if (error !== null) {
    throw unavailable();
  }
}

function callbackError(callbackUrl: string): string | null {
  const queryIndex = callbackUrl.indexOf("?");
  if (queryIndex === -1) {
    return null;
  }
  const query = callbackUrl.slice(queryIndex + 1).split("#")[0] ?? "";
  return readQueryValue(query, "error");
}

function readQueryValue(query: string, key: string): string | null {
  for (const part of query.split("&")) {
    const separator = part.indexOf("=");
    const name = separator === -1 ? part : part.slice(0, separator);
    if (name === key) {
      const value = separator === -1 ? "" : part.slice(separator + 1);
      try {
        return decodeURIComponent(value);
      } catch {
        throw validationFailed();
      }
    }
  }
  return null;
}

function authenticatedSnapshot(
  adult: OAuthSignInAdult | null,
): AuthSessionSnapshot {
  if (adult === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      AUTH_ERROR_MESSAGES.UNAUTHENTICATED,
    );
  }
  const identity =
    adult.displayName === undefined
      ? { id: adult.id }
      : { id: adult.id, displayName: adult.displayName };
  const principal = principalFromSession(identity);
  if (principal === null) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
  return authSessionSnapshotSchema.parse({
    state: "authenticated",
    principal,
  });
}

function validationFailed(): ApplicationError {
  return new ApplicationError(
    "VALIDATION_FAILED",
    AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
  );
}

function unavailable(): ApplicationError {
  return new ApplicationError(
    "UPSTREAM_UNAVAILABLE",
    AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
  );
}

async function fromProvider<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw mapAuthError(error);
  }
}
