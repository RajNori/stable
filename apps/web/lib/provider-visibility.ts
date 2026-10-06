import { OAUTH_PROVIDER_SETTINGS, oauthProviderReady } from "@stable/auth";
import type { OAuthProviderSettings } from "@stable/contracts";

export type AuthProviderName = "google" | "apple";

export type AuthProviderSettings = {
  readonly google: OAuthProviderSettings;
  readonly apple: OAuthProviderSettings;
};

export type VisibleAuthProviders = {
  readonly google: boolean;
  readonly apple: boolean;
};

export function frozenAuthProviderSettings(): AuthProviderSettings {
  return OAUTH_PROVIDER_SETTINGS;
}

/**
 * A provider button is ready only when the provider can start.
 * Enabled alone, a placeholder client id, or a missing handler stays hidden.
 */
export function providerButtonReady(
  settings: OAuthProviderSettings,
  start: ((provider: AuthProviderName) => void) | undefined,
): start is (provider: AuthProviderName) => void {
  return oauthProviderReady(settings) && typeof start === "function";
}

export function visibleAuthProviders(input?: {
  readonly settings?: AuthProviderSettings;
  readonly start?: (provider: AuthProviderName) => void;
}): VisibleAuthProviders {
  const settings = input?.settings ?? frozenAuthProviderSettings();
  return {
    google: providerButtonReady(settings.google, input?.start),
    apple: providerButtonReady(settings.apple, input?.start),
  };
}
