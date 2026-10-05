import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  type ApplicationErrorCode,
  type AuthErrorCode,
} from "@stable/contracts";

const SAFE_MESSAGES = AUTH_ERROR_MESSAGES;

type AuthFailureCode = AuthErrorCode;

const RATE_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "over_sms_send_rate_limit",
  "too_many_requests",
]);

const CONFLICT_CODES = new Set([
  "email_exists",
  "phone_exists",
  "identity_already_exists",
  "user_already_exists",
  "conflict",
]);

const UNAUTHENTICATED_CODES = new Set([
  "session_not_found",
  "refresh_token_not_found",
  "bad_jwt",
  "session_expired",
]);

const VALIDATION_CODES = new Set([
  "otp_expired",
  "otp_disabled",
  "invalid_otp",
  "expired_token",
  "invalid_grant",
  "validation_failed",
  "bad_oauth_state",
  "bad_oauth_callback",
  "bad_code_verifier",
  "user_cancelled",
  "access_denied",
]);

const UPSTREAM_CODES = new Set([
  "request_timeout",
  "unexpected_failure",
  "provider_error",
  "hook_timeout",
  "server_error",
]);

type AuthSignal = {
  readonly code: string | null;
  readonly status: number | null;
  readonly name: string | null;
  readonly message: string;
};

/**
 * Maps a provider or session failure onto a safe ApplicationError.
 * The returned message is a fixed catalog sentence and never includes provider text.
 */
export function mapAuthError(error: unknown): ApplicationError {
  const code =
    error instanceof ApplicationError
      ? authCodeFromApplication(error.code)
      : classify(signalFrom(error));

  return new ApplicationError(code, SAFE_MESSAGES[code]);
}

function authCodeFromApplication(code: ApplicationErrorCode): AuthFailureCode {
  if (
    code === "VALIDATION_FAILED" ||
    code === "RATE_LIMITED" ||
    code === "CONFLICT" ||
    code === "UPSTREAM_UNAVAILABLE" ||
    code === "UNAUTHENTICATED" ||
    code === "INTERNAL"
  ) {
    return code;
  }

  return "INTERNAL";
}

function classify(signal: AuthSignal): AuthFailureCode {
  const code = signal.code?.toLowerCase() ?? "";
  if (RATE_CODES.has(code) || signal.status === 429) {
    return "RATE_LIMITED";
  }

  if (CONFLICT_CODES.has(code) || signal.status === 409) {
    return "CONFLICT";
  }

  if (UNAUTHENTICATED_CODES.has(code) || signal.status === 401) {
    return "UNAUTHENTICATED";
  }

  if (
    VALIDATION_CODES.has(code) ||
    signal.status === 400 ||
    signal.status === 422
  ) {
    return "VALIDATION_FAILED";
  }

  if (
    UPSTREAM_CODES.has(code) ||
    (signal.status !== null && signal.status >= 500)
  ) {
    return "UPSTREAM_UNAVAILABLE";
  }

  if (signal.name === "TypeError" || signal.name === "AbortError") {
    return "UPSTREAM_UNAVAILABLE";
  }

  if (/rate limit|too many/i.test(signal.message)) {
    return "RATE_LIMITED";
  }

  if (/already (registered|exists)|identity already/i.test(signal.message)) {
    return "CONFLICT";
  }

  if (
    /otp|expired|invalid code|already been used|cancel/i.test(signal.message)
  ) {
    return "VALIDATION_FAILED";
  }

  if (/network|failed to fetch|timeout|unavailable/i.test(signal.message)) {
    return "UPSTREAM_UNAVAILABLE";
  }

  return "INTERNAL";
}

function signalFrom(error: unknown): AuthSignal {
  if (typeof error !== "object" || error === null) {
    return { code: null, status: null, name: null, message: "" };
  }

  const record = error as Record<string, unknown>;
  return {
    code: readString(record["code"]),
    status: readStatus(record["status"]),
    name: readString(record["name"]),
    message: readString(record["message"]) ?? "",
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readStatus(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
