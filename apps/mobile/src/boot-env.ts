import { ENV } from "@stable/contracts";
import { readMobileBootEnv } from "@stable/config";
import type { ClientEnvConfig } from "@stable/config";

type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Direct `EXPO_PUBLIC_*` reads so Expo inlines them. Validation stays in
 * `@stable/config`.
 */
export function loadMobileBootEnv(
  env: EnvSource = {
    [ENV.expoAppEnv]: process.env.EXPO_PUBLIC_APP_ENV,
    [ENV.expoSupabaseUrl]: process.env.EXPO_PUBLIC_SUPABASE_URL,
    [ENV.expoSupabasePublishableKey]:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
    EXPO_PUBLIC_POSTHOG_KEY: process.env.EXPO_PUBLIC_POSTHOG_KEY,
    EXPO_PUBLIC_POSTHOG_HOST: process.env.EXPO_PUBLIC_POSTHOG_HOST,
  },
): ClientEnvConfig {
  return readMobileBootEnv(env);
}
