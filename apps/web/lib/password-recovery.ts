export const RECOVERY_PENDING_COOKIE = "stable_recovery_pending";
export const RECOVERY_WINDOW_MS = 15 * 60 * 1000;
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export type RecoveryMarkerState = "none" | "active" | "expired";

export function recoveryDeadline(now = Date.now()): string {
  return String(now + RECOVERY_WINDOW_MS);
}

export function recoveryRedirectTo(webOrigin: string): string {
  return `${webOrigin}/auth/callback?type=recovery`;
}

export function recoveryMarkerState(
  value: string | undefined,
  now = Date.now(),
): RecoveryMarkerState {
  if (value === undefined) {
    return "none";
  }
  const deadline = Number(value);
  return Number.isSafeInteger(deadline) && deadline > now
    ? "active"
    : "expired";
}

export function isRecoveryRoute(pathname: string): boolean {
  return pathname === "/auth/recover";
}
