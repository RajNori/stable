import { oauthProviderReady } from "@stable/auth";
import type { OAuthProviderSettings } from "@stable/contracts";

export type AuthProviderName = "google" | "facebook";

export type AuthProviderSettings = {
  readonly google: OAuthProviderSettings;
  readonly facebook: OAuthProviderSettings;
};

export type VisibleAuthProviders = {
  readonly google: boolean;
  readonly facebook: boolean;
};

type PublicOAuthEnv = Readonly<Record<string, string | undefined>>;

export function frozenAuthProviderSettings(
  env: PublicOAuthEnv = {
    NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED:
      process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED,
    NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
      process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID,
    NEXT_PUBLIC_FACEBOOK_SIGN_IN_ENABLED:
      process.env.NEXT_PUBLIC_FACEBOOK_SIGN_IN_ENABLED,
    NEXT_PUBLIC_FACEBOOK_OAUTH_CLIENT_ID:
      process.env.NEXT_PUBLIC_FACEBOOK_OAUTH_CLIENT_ID,
  },
): AuthProviderSettings {
  return {
    google: {
      enabled: env.NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED === "true",
      clientId: nonEmpty(env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID),
    },
    facebook: {
      enabled: env.NEXT_PUBLIC_FACEBOOK_SIGN_IN_ENABLED === "true",
      clientId: nonEmpty(env.NEXT_PUBLIC_FACEBOOK_OAUTH_CLIENT_ID),
    },
  };
}

function nonEmpty(value: string | undefined): string | null {
  return value === undefined || value.trim().length === 0 ? null : value.trim();
}

/**
 * A provider button is ready only when the provider can start.
 * Enabled alone, a placeholder client id, or a missing handler stays hidden.
 */
export function providerButtonReady(
  settings: OAuthProviderSettings,
  start: ((provider: AuthProviderName) => Promise<void>) | undefined,
): start is (provider: AuthProviderName) => Promise<void> {
  return oauthProviderReady(settings) && typeof start === "function";
}

export function visibleAuthProviders(input?: {
  readonly settings?: AuthProviderSettings;
  readonly start?: (provider: AuthProviderName) => Promise<void>;
}): VisibleAuthProviders {
  const settings = input?.settings ?? frozenAuthProviderSettings();
  return {
    google: providerButtonReady(settings.google, input?.start),
    facebook: providerButtonReady(settings.facebook, input?.start),
  };
}
