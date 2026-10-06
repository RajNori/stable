import { z } from "zod";

export const EMAIL_CREDENTIAL_CHANGE_STATUSES = [
  "pending",
  "established",
] as const;

export const emailCredentialChangeSchema = z
  .strictObject({
    status: z.enum(EMAIL_CREDENTIAL_CHANGE_STATUSES),
    userId: z.string().uuid(),
  })
  .describe(
    "Authenticated email credential change. The address stays out of this result.",
  );

export type EmailCredentialChange = z.infer<typeof emailCredentialChangeSchema>;

export const OAUTH_LINK_PROVIDERS = ["google", "apple"] as const;

export const oauthLinkReceiptSchema = z
  .strictObject({
    status: z.literal("pending"),
    provider: z.enum(OAUTH_LINK_PROVIDERS),
    userId: z.string().uuid(),
    credentialEstablished: z.literal(false),
  })
  .describe(
    "Explicit OAuth link that has not established a credential. No provider tokens.",
  );

export type OAuthLinkReceipt = z.infer<typeof oauthLinkReceiptSchema>;

export const oauthProviderSettingsSchema = z
  .strictObject({
    enabled: z.boolean(),
    clientId: z.string().nullable(),
  })
  .superRefine((value, context) => {
    if (
      value.enabled &&
      (value.clientId === null || value.clientId.trim() === "")
    ) {
      context.addIssue({
        code: "custom",
        message: "Provider configuration is incomplete.",
      });
    }
    if (
      value.clientId !== null &&
      (value.clientId.includes("env(") || value.clientId === "local-test-otp")
    ) {
      context.addIssue({
        code: "custom",
        message: "Provider configuration is incomplete.",
      });
    }
  });

export type OAuthProviderSettings = z.infer<typeof oauthProviderSettingsSchema>;

export const LOCAL_SUPABASE_AUTH_ORIGIN = "http://127.0.0.1:54321";

const HOSTED_SUPABASE_AUTH_ORIGIN = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/u;
const AUTHORIZATION_PATH = "/auth/v1/authorize";
const SENSITIVE_PARAMETER =
  /access_token|refresh_token|provider_token|id_token/u;
const PERCENT_ESCAPE = /%[0-9A-Fa-f]{2}/u;
const MAX_CANONICAL_DECODES = 3;

export function isExpectedSupabaseAuthOrigin(authOrigin: string): boolean {
  return (
    authOrigin === LOCAL_SUPABASE_AUTH_ORIGIN ||
    HOSTED_SUPABASE_AUTH_ORIGIN.test(authOrigin)
  );
}

export function isSafeOAuthAuthorizationUrl(
  authorizationUrl: string,
  authOrigin: string,
): boolean {
  if (!isExpectedSupabaseAuthOrigin(authOrigin)) {
    return false;
  }
  if (authorizationUrl.length > 2048 || /\s/u.test(authorizationUrl)) {
    return false;
  }
  const parsed = parseAuthorizationUrl(authorizationUrl);
  if (parsed === null) {
    return false;
  }
  if (parsed.origin !== authOrigin) {
    return false;
  }
  if (parsed.pathname !== AUTHORIZATION_PATH) {
    return false;
  }
  const prefix = `${authOrigin}${AUTHORIZATION_PATH}`;
  if (!hasAuthorizePrefix(authorizationUrl, prefix)) {
    return false;
  }
  const parts = queryAndHash(authorizationUrl.slice(prefix.length));
  return !parametersLeak(parts.query) && !parametersLeak(parts.hash);
}

type ParsedAuthorizationUrl = {
  readonly origin: string;
  readonly pathname: string;
};

type UrlConstructor = new (value: string) => ParsedAuthorizationUrl;

function parseAuthorizationUrl(value: string): ParsedAuthorizationUrl | null {
  const host: unknown = globalThis;
  if (typeof host !== "object" || host === null || !("URL" in host)) {
    return null;
  }
  const candidate: unknown = host.URL;
  if (!isUrlConstructor(candidate)) {
    return null;
  }
  try {
    return new candidate(value);
  } catch {
    return null;
  }
}

function isUrlConstructor(value: unknown): value is UrlConstructor {
  return typeof value === "function";
}

function hasAuthorizePrefix(authorizationUrl: string, prefix: string): boolean {
  if (!authorizationUrl.startsWith(prefix)) {
    return false;
  }
  const rest = authorizationUrl.slice(prefix.length);
  return rest.length === 0 || rest.startsWith("?") || rest.startsWith("#");
}

function queryAndHash(rest: string): {
  readonly query: string;
  readonly hash: string;
} {
  if (rest.startsWith("?")) {
    const hashAt = rest.indexOf("#");
    if (hashAt === -1) {
      return { query: rest.slice(1), hash: "" };
    }
    return { query: rest.slice(1, hashAt), hash: rest.slice(hashAt + 1) };
  }
  if (rest.startsWith("#")) {
    return { query: "", hash: rest.slice(1) };
  }
  return { query: "", hash: "" };
}

function parametersLeak(serialized: string): boolean {
  if (serialized.length === 0) {
    return false;
  }
  for (const piece of serialized.split("&")) {
    const separator = piece.indexOf("=");
    const rawName = separator === -1 ? piece : piece.slice(0, separator);
    const rawValue = separator === -1 ? "" : piece.slice(separator + 1);
    const name = canonicalPiece(rawName);
    const value = canonicalPiece(rawValue);
    if (name === null || value === null || leaks(name) || leaks(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Decodes percent-encoding a fixed number of times.
 * A truncated escape is rejected. Encoding that still changes past the bound
 * is rejected instead of being followed forever.
 */
function canonicalPiece(value: string): string | null {
  let current = value;
  for (let depth = 0; depth < MAX_CANONICAL_DECODES; depth += 1) {
    if (!PERCENT_ESCAPE.test(current)) {
      if (depth === 0 && current.includes("%")) {
        return null;
      }
      return current;
    }
    try {
      current = decodeURIComponent(current);
    } catch {
      return null;
    }
  }
  if (PERCENT_ESCAPE.test(current)) {
    return null;
  }
  return current;
}

function leaks(canonical: string): boolean {
  const lowered = canonical.toLowerCase();
  return lowered.includes("@") || SENSITIVE_PARAMETER.test(lowered);
}

export function isStructurallySafeOAuthAuthorizationUrl(
  authorizationUrl: string,
): boolean {
  if (
    authorizationUrl.startsWith(
      `${LOCAL_SUPABASE_AUTH_ORIGIN}/auth/v1/authorize`,
    )
  ) {
    return isSafeOAuthAuthorizationUrl(
      authorizationUrl,
      LOCAL_SUPABASE_AUTH_ORIGIN,
    );
  }
  const scheme = "https://";
  if (!authorizationUrl.startsWith(scheme)) {
    return false;
  }
  const path = authorizationUrl.indexOf("/", scheme.length);
  if (path === -1) {
    return false;
  }
  return isSafeOAuthAuthorizationUrl(
    authorizationUrl,
    authorizationUrl.slice(0, path),
  );
}

export const oauthSignInNavigationSchema = z
  .strictObject({
    status: z.literal("redirect_required"),
    provider: z.enum(OAUTH_LINK_PROVIDERS),
    authorizationUrl: z.string().min(1).max(2048),
  })
  .superRefine((value, context) => {
    if (!isStructurallySafeOAuthAuthorizationUrl(value.authorizationUrl)) {
      context.addIssue({
        code: "custom",
        message: "Authorization URL is not safe.",
      });
    }
  })
  .describe(
    "Browser navigation for a signed-out OAuth sign-in. Not an authenticated session.",
  );

export type OAuthSignInNavigation = z.infer<typeof oauthSignInNavigationSchema>;
