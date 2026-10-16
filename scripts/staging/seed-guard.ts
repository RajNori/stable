export const STAGING_PROJECT_REF = "rporaeagbsfmgbmhyett";
export const STAGING_SUPABASE_URL = `https://${STAGING_PROJECT_REF}.supabase.co`;

export type SeedRow = Readonly<Record<string, unknown>>;

/** Skip matching rows; never let a seed rerun overwrite an operator edit. */
export function classifySeedRow(
  existing: readonly SeedRow[],
  expected: SeedRow,
  fields: readonly string[],
): "missing" | "matching" {
  if (existing.length === 0) return "missing";
  if (
    existing.length !== 1 ||
    fields.some((field) => existing[0]?.[field] !== expected[field])
  ) {
    throw new Error(
      "An existing staging synthetic row conflicts with the seed baseline; refusing to overwrite it.",
    );
  }
  return "matching";
}

export type StagingSeedTarget = Readonly<{
  appEnv: string | undefined;
  projectRef: string | undefined;
  supabaseUrl: string | undefined;
  args: readonly string[];
}>;

/** Fail closed before any staging admin or database request is made. */
export function assertStagingSeedTarget(target: StagingSeedTarget): void {
  if (target.appEnv !== "staging") {
    throw new Error("APP_ENV must be exactly staging.");
  }
  if (target.projectRef !== STAGING_PROJECT_REF) {
    throw new Error(
      `TARGET_PROJECT_REF must be exactly ${STAGING_PROJECT_REF}.`,
    );
  }
  if (target.supabaseUrl !== STAGING_SUPABASE_URL) {
    throw new Error(
      `SUPABASE_URL must be exactly the approved staging project URL (${STAGING_SUPABASE_URL}).`,
    );
  }
  if (target.args.filter((arg) => arg === "--confirm-staging").length !== 1) {
    throw new Error("Pass --confirm-staging exactly once to continue.");
  }
  if (
    target.args.some(
      (arg) =>
        arg !== "--confirm-staging" &&
        arg !== "--dry-run" &&
        arg !== "--verify-access",
    )
  ) {
    throw new Error(
      "Unsupported argument. Only --confirm-staging, --dry-run, and --verify-access are allowed.",
    );
  }
}

export type StagingKeys = Readonly<{ serviceKey: string; publicKey: string }>;

/**
 * Explicit, opt-in key source for the gated `staging-e2e` workflow. When
 * STAGING_KEY_SOURCE is unset the seed keeps resolving keys from the
 * operator's authenticated Supabase CLI. Values are never logged.
 */
export function stagingKeysFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): StagingKeys | null {
  const source = env["STAGING_KEY_SOURCE"];
  if (source === undefined) return null;
  if (source !== "env") {
    throw new Error("STAGING_KEY_SOURCE must be exactly env when set.");
  }
  const serviceKey = env["STAGING_SECRET_KEY"];
  const publicKey = env["STAGING_PUBLISHABLE_KEY"];
  if (serviceKey === undefined || serviceKey.length === 0) {
    throw new Error(
      "STAGING_SECRET_KEY is required when STAGING_KEY_SOURCE=env.",
    );
  }
  if (publicKey === undefined || publicKey.length === 0) {
    throw new Error(
      "STAGING_PUBLISHABLE_KEY is required when STAGING_KEY_SOURCE=env.",
    );
  }
  if (publicKey.startsWith("sb_secret_")) {
    throw new Error("STAGING_PUBLISHABLE_KEY must not be a secret key.");
  }
  if (serviceKey === publicKey) {
    throw new Error("STAGING_SECRET_KEY must differ from the publishable key.");
  }
  return { serviceKey, publicKey };
}
