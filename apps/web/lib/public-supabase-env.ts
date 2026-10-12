import { readWebBootEnv } from "@stable/config";
import { ENV } from "@stable/contracts";
import type { AppEnv } from "@stable/contracts";

export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

export type PublicWebObservabilityConfig = {
  appEnv: AppEnv;
  sentryDsn: string | undefined;
};

type PublicEnv = Readonly<Record<string, string | undefined>>;

/**
 * Browser and server clients share this reader. It forwards only public
 * names into the shared boot parser, so a server secret is not bundled.
 */
export function readPublicSupabaseConfig(
  env?: PublicEnv,
): PublicSupabaseConfig {
  const parsed = readPublicWebBootConfig(env);

  return {
    url: parsed.supabaseUrl,
    publishableKey: parsed.supabasePublishableKey,
  };
}

export function readPublicWebObservabilityConfig(
  env?: PublicEnv,
): PublicWebObservabilityConfig {
  const parsed = readPublicWebBootConfig(env);
  return { appEnv: parsed.appEnv, sentryDsn: parsed.sentryDsn };
}

function readPublicWebBootConfig(env?: PublicEnv) {
  const source: PublicEnv = env ?? {
    [ENV.nextAppEnv]: process.env.NEXT_PUBLIC_APP_ENV,
    [ENV.nextSiteUrl]: process.env.NEXT_PUBLIC_SITE_URL,
    [ENV.nextSupabaseUrl]: process.env.NEXT_PUBLIC_SUPABASE_URL,
    [ENV.nextSupabasePublishableKey]:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  };
  return readWebBootEnv(source);
}
