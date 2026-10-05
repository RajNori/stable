import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  authSessionSnapshotSchema,
  oauthLinkReceiptSchema,
  oauthProviderSettingsSchema,
  type AppEnv,
  type AuthSessionSnapshot,
  type OAuthLinkReceipt,
  type OAuthProviderSettings,
  type Principal,
} from "@stable/contracts";

import {
  assertAllowedSignInRedirect,
  callbackTargetFromUrl,
} from "./auth-redirect.js";
import {
  MANUAL_LINKING_IS_ENABLED,
  decideIdentityLink,
} from "./identity-link-policy.js";
import { mapAuthError } from "./map-auth-error.js";

export const OAUTH_PROVIDER_SETTINGS = {
  google: { enabled: false, clientId: null },
  apple: { enabled: false, clientId: null },
} as const satisfies Record<"google" | "apple", OAuthProviderSettings>;

export type OAuthLinkGateway = {
  linkIdentity(input: {
    provider: "google" | "apple";
    redirectTo: string;
  }): Promise<{ userId: string }>;
};

export async function requestOAuthIdentityLink(
  gateway: OAuthLinkGateway,
  input: {
    principal: Principal | null;
    provider: "google" | "apple";
    redirectTo: string;
    appEnv: AppEnv;
  },
): Promise<OAuthLinkReceipt> {
  return startOAuthIdentityLink(gateway, {
    ...input,
    manualLinkingEnabled: MANUAL_LINKING_IS_ENABLED,
    settings: OAUTH_PROVIDER_SETTINGS[input.provider],
  });
}

/**
 * Gate-aware OAuth link. Production entry is requestOAuthIdentityLink,
 * which binds the frozen manual-linking flag and the disabled provider settings.
 */
export async function startOAuthIdentityLink(
  gateway: OAuthLinkGateway,
  input: {
    principal: Principal | null;
    provider: "google" | "apple";
    redirectTo: string;
    appEnv: AppEnv;
    manualLinkingEnabled: boolean;
    settings: OAuthProviderSettings;
  },
): Promise<OAuthLinkReceipt> {
  const principal = requirePrincipal(input.principal);
  const redirectTo = assertAllowedSignInRedirect(
    input.redirectTo,
    input.appEnv,
  );
  const decision = decideIdentityLink({
    kind: "oauth_link",
    provider: input.provider,
    authenticated: true,
    manualLinkingEnabled: input.manualLinkingEnabled,
    candidateOwnedByOtherUser: false,
    callbackCompleted: false,
  });
  if (decision.application === "refuse") {
    throw new ApplicationError(
      decision.errorCode,
      AUTH_ERROR_MESSAGES[decision.errorCode],
    );
  }
  if (decision.application !== "allow_explicit_link") {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
  if (!oauthProviderReady(input.settings)) {
    throw new ApplicationError(
      "UPSTREAM_UNAVAILABLE",
      AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
    );
  }
  const linked = await fromProvider(() =>
    gateway.linkIdentity({ provider: input.provider, redirectTo }),
  );
  if (linked.userId !== principal.userId) {
    throw new ApplicationError("INTERNAL", AUTH_ERROR_MESSAGES.INTERNAL);
  }
  return oauthLinkReceiptSchema.parse({
    status: "pending",
    provider: input.provider,
    userId: principal.userId,
    credentialEstablished: false,
  });
}

export function cancelOAuthIdentityLink(
  principal: Principal | null,
): AuthSessionSnapshot {
  return authSessionSnapshotSchema.parse({
    state: "authenticated",
    principal: requirePrincipal(principal),
  });
}

export function preserveOAuthCallback(input: {
  principal: Principal | null;
  callbackUrl: string;
  appEnv: AppEnv;
}): AuthSessionSnapshot {
  const principal = requirePrincipal(input.principal);
  assertOAuthCallback(input.callbackUrl, input.appEnv);
  return authSessionSnapshotSchema.parse({
    state: "authenticated",
    principal,
  });
}

export function oauthProviderReady(settings: OAuthProviderSettings): boolean {
  const parsed = oauthProviderSettingsSchema.safeParse(settings);
  return parsed.success && parsed.data.clientId !== null && parsed.data.enabled;
}

function assertOAuthCallback(callbackUrl: string, appEnv: AppEnv): void {
  if (
    callbackUrl.includes("@") ||
    callbackUrl.toLowerCase().includes("access_token")
  ) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    );
  }
  const target = callbackTargetFromUrl(callbackUrl);
  if (target === null) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
    );
  }
  assertAllowedSignInRedirect(target, appEnv);
}

function requirePrincipal(principal: Principal | null): Principal {
  if (principal === null) {
    throw new ApplicationError(
      "UNAUTHENTICATED",
      AUTH_ERROR_MESSAGES.UNAUTHENTICATED,
    );
  }
  return principal;
}

async function fromProvider<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw mapAuthError(error);
  }
}
