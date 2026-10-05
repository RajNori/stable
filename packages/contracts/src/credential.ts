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
const AUTHORIZATION_TOKEN =
  /access_token|refresh_token|provider_token|id_token/u;

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
  if (
    !hasAuthorizePrefix(authorizationUrl, `${authOrigin}/auth/v1/authorize`)
  ) {
    return false;
  }
  const lowered = authorizationUrl.toLowerCase();
  if (
    AUTHORIZATION_TOKEN.test(lowered) ||
    authorizationUrl.includes("@") ||
    lowered.includes("%40")
  ) {
    return false;
  }
  if (authorizationUrl.length > 2048 || /\s/u.test(authorizationUrl)) {
    return false;
  }
  try {
    decodeURIComponent(authorizationUrl);
  } catch {
    return false;
  }
  return true;
}

function hasAuthorizePrefix(authorizationUrl: string, prefix: string): boolean {
  if (!authorizationUrl.startsWith(prefix)) {
    return false;
  }
  const rest = authorizationUrl.slice(prefix.length);
  return rest.length === 0 || rest.startsWith("?") || rest.startsWith("#");
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
