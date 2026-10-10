export const STAGING_PROJECT_REF = "rporaeagbsfmgbmhyett";
export const STAGING_SUPABASE_URL = `https://${STAGING_PROJECT_REF}.supabase.co`;

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
