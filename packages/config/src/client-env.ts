import { ApplicationError, APP_ENV_VALUES, ENV } from "@stable/contracts";
import type { AppEnv } from "@stable/contracts";
import { z } from "zod";

import { assertSupabaseUrl } from "./supabase-url.js";
import type { ClientTarget } from "./supabase-url.js";

export type EnvRecord = Readonly<Record<string, string | undefined>>;

export type ClientEnvConfig = {
  appEnv: AppEnv;
  supabaseUrl: string;
  supabasePublishableKey: string;
  sentryDsn?: string;
  posthogKey?: string;
  posthogHost?: string;
};

/**
 * Optional public observability names already listed in the app env examples.
 * They are not part of the frozen ENV contract and are not required to boot.
 */
const WEB_PUBLIC_OBSERVABILITY = {
  sentryDsn: "NEXT_PUBLIC_SENTRY_DSN",
  posthogKey: "NEXT_PUBLIC_POSTHOG_KEY",
  posthogHost: "NEXT_PUBLIC_POSTHOG_HOST",
} as const;

const MOBILE_PUBLIC_OBSERVABILITY = {
  sentryDsn: "EXPO_PUBLIC_SENTRY_DSN",
  posthogKey: "EXPO_PUBLIC_POSTHOG_KEY",
  posthogHost: "EXPO_PUBLIC_POSTHOG_HOST",
} as const;

const appEnvSchema = z.enum(APP_ENV_VALUES);
const requiredValue = z.string().min(1);

export const webClientEnvSchema = z.strictObject({
  [ENV.nextAppEnv]: appEnvSchema,
  [ENV.nextSupabaseUrl]: requiredValue,
  [ENV.nextSupabasePublishableKey]: requiredValue,
  [WEB_PUBLIC_OBSERVABILITY.sentryDsn]: requiredValue.optional(),
  [WEB_PUBLIC_OBSERVABILITY.posthogKey]: requiredValue.optional(),
  [WEB_PUBLIC_OBSERVABILITY.posthogHost]: requiredValue.optional(),
});

export const mobileClientEnvSchema = z.strictObject({
  [ENV.expoAppEnv]: appEnvSchema,
  [ENV.expoSupabaseUrl]: requiredValue,
  [ENV.expoSupabasePublishableKey]: requiredValue,
  [MOBILE_PUBLIC_OBSERVABILITY.sentryDsn]: requiredValue.optional(),
  [MOBILE_PUBLIC_OBSERVABILITY.posthogKey]: requiredValue.optional(),
  [MOBILE_PUBLIC_OBSERVABILITY.posthogHost]: requiredValue.optional(),
});

function assertNoClientSecret(env: EnvRecord): void {
  if (Object.hasOwn(env, ENV.supabaseSecretKey)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      `${ENV.supabaseSecretKey} must not be part of the client environment schema.`,
    );
  }
}

function readValue(env: EnvRecord, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function pickFields(
  env: EnvRecord,
  keys: readonly string[],
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = readValue(env, key);
    if (value !== undefined) {
      picked[key] = value;
    }
  }
  return picked;
}

function invalidClientEnv(error: z.ZodError): ApplicationError {
  const fields = error.issues
    .map((issue) => issue.path.map((part) => String(part)).join("."))
    .join(", ");

  return new ApplicationError(
    "VALIDATION_FAILED",
    `Invalid client environment: ${fields}.`,
  );
}

function clientConfig(
  appEnv: AppEnv,
  supabaseUrl: string,
  supabasePublishableKey: string,
  optional: {
    sentryDsn: string | undefined;
    posthogKey: string | undefined;
    posthogHost: string | undefined;
  },
  target: ClientTarget,
): ClientEnvConfig {
  assertSupabaseUrl(supabaseUrl, appEnv, target);

  const config: ClientEnvConfig = {
    appEnv,
    supabaseUrl,
    supabasePublishableKey,
  };

  if (optional.sentryDsn !== undefined) {
    config.sentryDsn = optional.sentryDsn;
  }
  if (optional.posthogKey !== undefined) {
    config.posthogKey = optional.posthogKey;
  }
  if (optional.posthogHost !== undefined) {
    config.posthogHost = optional.posthogHost;
  }

  return config;
}

const webKeys = [
  ENV.nextAppEnv,
  ENV.nextSupabaseUrl,
  ENV.nextSupabasePublishableKey,
  WEB_PUBLIC_OBSERVABILITY.sentryDsn,
  WEB_PUBLIC_OBSERVABILITY.posthogKey,
  WEB_PUBLIC_OBSERVABILITY.posthogHost,
] as const;

const mobileKeys = [
  ENV.expoAppEnv,
  ENV.expoSupabaseUrl,
  ENV.expoSupabasePublishableKey,
  MOBILE_PUBLIC_OBSERVABILITY.sentryDsn,
  MOBILE_PUBLIC_OBSERVABILITY.posthogKey,
  MOBILE_PUBLIC_OBSERVABILITY.posthogHost,
] as const;

export function parseWebClientEnv(env: EnvRecord): ClientEnvConfig {
  assertNoClientSecret(env);

  const parsed = webClientEnvSchema.safeParse(pickFields(env, webKeys));
  if (!parsed.success) {
    throw invalidClientEnv(parsed.error);
  }

  return clientConfig(
    parsed.data[ENV.nextAppEnv],
    parsed.data[ENV.nextSupabaseUrl],
    parsed.data[ENV.nextSupabasePublishableKey],
    {
      sentryDsn: parsed.data[WEB_PUBLIC_OBSERVABILITY.sentryDsn],
      posthogKey: parsed.data[WEB_PUBLIC_OBSERVABILITY.posthogKey],
      posthogHost: parsed.data[WEB_PUBLIC_OBSERVABILITY.posthogHost],
    },
    "web",
  );
}

function assertPublishableIsNotSecret(publishableKey: string): void {
  if (publishableKey.startsWith("sb_secret_")) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "The publishable key must not be a secret key.",
    );
  }
}

function assertPublicValuesDifferFromSecret(
  env: EnvRecord,
  publicValues: readonly string[],
): void {
  const secret = readValue(env, ENV.supabaseSecretKey);
  if (secret === undefined) {
    return;
  }

  if (publicValues.some((value) => value === secret)) {
    throw new ApplicationError(
      "VALIDATION_FAILED",
      "A public client value must not be the Supabase secret key.",
    );
  }
}

function readBootEnv(
  env: EnvRecord,
  keys: readonly string[],
  parse: (env: EnvRecord) => ClientEnvConfig,
): ClientEnvConfig {
  const picked = pickFields(env, keys);
  assertPublicValuesDifferFromSecret(env, Object.values(picked));
  const parsed = parse(picked);
  assertPublishableIsNotSecret(parsed.supabasePublishableKey);
  return parsed;
}

/**
 * Selects the public Next.js keys from a server environment and validates them.
 * `SUPABASE_SECRET_KEY` is never copied into the result.
 */
export function readWebBootEnv(env: EnvRecord): ClientEnvConfig {
  return readBootEnv(env, webKeys, parseWebClientEnv);
}

/**
 * Selects the public Expo keys from an environment and validates them.
 * `SUPABASE_SECRET_KEY` is never copied into the result.
 */
export function readMobileBootEnv(env: EnvRecord): ClientEnvConfig {
  return readBootEnv(env, mobileKeys, parseMobileClientEnv);
}

export function parseMobileClientEnv(env: EnvRecord): ClientEnvConfig {
  assertNoClientSecret(env);

  const parsed = mobileClientEnvSchema.safeParse(pickFields(env, mobileKeys));
  if (!parsed.success) {
    throw invalidClientEnv(parsed.error);
  }

  return clientConfig(
    parsed.data[ENV.expoAppEnv],
    parsed.data[ENV.expoSupabaseUrl],
    parsed.data[ENV.expoSupabasePublishableKey],
    {
      sentryDsn: parsed.data[MOBILE_PUBLIC_OBSERVABILITY.sentryDsn],
      posthogKey: parsed.data[MOBILE_PUBLIC_OBSERVABILITY.posthogKey],
      posthogHost: parsed.data[MOBILE_PUBLIC_OBSERVABILITY.posthogHost],
    },
    "mobile",
  );
}
