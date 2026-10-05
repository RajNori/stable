import { ENV } from "@stable/contracts";
import { readWebBootEnv } from "@stable/config";
import type { ClientEnvConfig } from "@stable/config";

type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Server-only boot check. Passes the secret through so a public value that
 * copies it is rejected, and does not return the secret.
 */
export function loadWebBootEnv(env: EnvSource = process.env): ClientEnvConfig {
  return readWebBootEnv({
    [ENV.nextAppEnv]: env[ENV.nextAppEnv],
    [ENV.nextSupabaseUrl]: env[ENV.nextSupabaseUrl],
    [ENV.nextSupabasePublishableKey]: env[ENV.nextSupabasePublishableKey],
    NEXT_PUBLIC_SENTRY_DSN: env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: env.NEXT_PUBLIC_POSTHOG_HOST,
    [ENV.supabaseSecretKey]: env[ENV.supabaseSecretKey],
  });
}
