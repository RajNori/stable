import { ENV } from "@stable/contracts";

export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

type PublicEnv = Readonly<Record<string, string | undefined>>;

/** Reads the public Supabase URL and publishable key. */
export function readPublicSupabaseConfig(
  env?: PublicEnv,
): PublicSupabaseConfig {
  const source: PublicEnv = env ?? {
    [ENV.nextSupabaseUrl]: process.env[ENV.nextSupabaseUrl],
    [ENV.nextSupabasePublishableKey]:
      process.env[ENV.nextSupabasePublishableKey],
  };
  const url = source[ENV.nextSupabaseUrl];
  const publishableKey = source[ENV.nextSupabasePublishableKey];

  if (
    url === undefined ||
    url.length === 0 ||
    publishableKey === undefined ||
    publishableKey.length === 0
  ) {
    throw new Error(
      `Missing ${ENV.nextSupabaseUrl} or ${ENV.nextSupabasePublishableKey}.`,
    );
  }

  return { url, publishableKey };
}
