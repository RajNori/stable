import { ENV } from "@stable/contracts";
import { readWebBootEnv } from "@stable/config";
import type { ClientEnvConfig } from "@stable/config";

type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Server-only boot check. Passes the secret through so a public value that
 * copies it is rejected, and does not return the secret.
 */
export function loadWebBootEnv(env?: EnvSource): ClientEnvConfig {
  const source = env ?? {
    // Keep NEXT_PUBLIC_* references static so Next.js can inline their
    // build-time values into server bundles as well as browser bundles.
    [ENV.nextAppEnv]: process.env.NEXT_PUBLIC_APP_ENV,
    [ENV.nextSiteUrl]: process.env.NEXT_PUBLIC_SITE_URL,
    [ENV.nextSupabaseUrl]: process.env.NEXT_PUBLIC_SUPABASE_URL,
    [ENV.nextSupabasePublishableKey]:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    [ENV.supabaseSecretKey]: process.env.SUPABASE_SECRET_KEY,
  };

  return readWebBootEnv(source);
}
