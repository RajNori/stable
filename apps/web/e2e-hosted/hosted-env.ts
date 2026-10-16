import { STAGING_SUPABASE_URL } from "../../../scripts/staging/seed-guard";

/**
 * Hosted acceptance runs only against the approved staging Supabase project
 * and an HTTPS Vercel Preview. The secret key stays in the Playwright runner:
 * it mints one-time sessions and is never sent to the browser or the app.
 */
export type HostedEnv = Readonly<{
  webUrl: string;
  supabaseUrl: string;
  publishableKey: string;
  secretKey: string;
  vercelBypass: string | undefined;
}>;

function value(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const found = env[name];
  if (found === undefined || found.length === 0) {
    throw new Error(`${name} is required for the hosted acceptance suite.`);
  }
  return found;
}

export function readHostedEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): HostedEnv {
  const webUrl = value(env, "STAGING_WEB_URL");
  let parsed: URL;
  try {
    parsed = new URL(webUrl);
  } catch {
    throw new Error("STAGING_WEB_URL must be an absolute URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("STAGING_WEB_URL must use HTTPS.");
  }
  if (["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)) {
    throw new Error("STAGING_WEB_URL must be a hosted Preview, not loopback.");
  }
  if (
    env["PRODUCTION_WEB_URL"] !== undefined &&
    env["PRODUCTION_WEB_URL"].length > 0 &&
    new URL(env["PRODUCTION_WEB_URL"]).host === parsed.host
  ) {
    throw new Error("STAGING_WEB_URL must not be the production origin.");
  }

  const supabaseUrl = value(env, "STAGING_SUPABASE_URL");
  if (supabaseUrl !== STAGING_SUPABASE_URL) {
    throw new Error(
      `STAGING_SUPABASE_URL must be exactly the approved staging project URL (${STAGING_SUPABASE_URL}).`,
    );
  }

  const publishableKey = value(env, "STAGING_PUBLISHABLE_KEY");
  if (publishableKey.startsWith("sb_secret_")) {
    throw new Error("STAGING_PUBLISHABLE_KEY must not be a secret key.");
  }
  const secretKey = value(env, "STAGING_SECRET_KEY");
  if (secretKey === publishableKey) {
    throw new Error("STAGING_SECRET_KEY must differ from the publishable key.");
  }

  const bypass = env["VERCEL_AUTOMATION_BYPASS_SECRET"];
  return {
    webUrl: parsed.origin,
    supabaseUrl,
    publishableKey,
    secretKey,
    vercelBypass:
      bypass === undefined || bypass.length === 0 ? undefined : bypass,
  };
}

/** Synthetic staging identities and fixed ids from scripts/staging/seed-pilot.ts. */
export const STAGING = {
  primaryTeam: "99999999-9999-4999-8999-999999999999",
  secondTeam: "99999999-9999-4999-8999-999999999998",
  completedGame: "bbbbbbbb-0001-4000-8000-000000000001",
  secondTeamGame: "bbbbbbbb-0001-4000-8000-000000000006",
  adminCoach: "m5b-admin-coach@stable.invalid",
  assistantCoach: "m5b-assistant-coach@stable.invalid",
  manager: "m5b-team-manager@stable.invalid",
  guardianOne: "m5b-guardian-one@stable.invalid",
  guardianTwo: "m5b-guardian-two@stable.invalid",
  adminOnly: "m5b-admin-only@stable.invalid",
  otherTeamCoach: "m5b-other-team-coach@stable.invalid",
} as const;
