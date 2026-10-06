import {
  AUTH_ERROR_MESSAGES,
  type AuthSessionSnapshot,
} from "@stable/contracts";

const CALLBACK_FLAGS = {
  validation: AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
  unavailable: AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
  limited: AUTH_ERROR_MESSAGES.RATE_LIMITED,
  internal: AUTH_ERROR_MESSAGES.INTERNAL,
} as const;

export function shouldLoadClubContext(snapshot: AuthSessionSnapshot): boolean {
  return snapshot.state === "authenticated";
}

export function callbackNotice(
  params: Record<string, string | string[] | undefined>,
): string | null {
  const raw = params["auth"];
  const flag = Array.isArray(raw) ? raw[0] : raw;
  if (flag === undefined) {
    return null;
  }
  if (flag in CALLBACK_FLAGS) {
    return CALLBACK_FLAGS[flag as keyof typeof CALLBACK_FLAGS];
  }
  return null;
}

export function authQueryFlag(message: string): keyof typeof CALLBACK_FLAGS {
  if (message === AUTH_ERROR_MESSAGES.VALIDATION_FAILED) {
    return "validation";
  }
  if (message === AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE) {
    return "unavailable";
  }
  if (message === AUTH_ERROR_MESSAGES.RATE_LIMITED) {
    return "limited";
  }
  return "internal";
}
