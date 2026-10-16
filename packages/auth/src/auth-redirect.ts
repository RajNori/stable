import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  type AppEnv,
} from "@stable/contracts";

export const LOCAL_SIGN_IN_REDIRECTS = [
  "http://127.0.0.1:3000/auth/callback",
  "stable://auth/callback",
] as const;

const LOCAL_WEB_ORIGIN = "http://127.0.0.1:3000";
const MOBILE_CALLBACK = "stable://auth/callback";

function rejectRedirect(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
  );
}

export function assertAllowedSignInRedirect(
  redirectTo: string,
  appEnv: AppEnv,
  webOrigin?: string,
): string {
  if (redirectTo === MOBILE_CALLBACK) {
    return redirectTo;
  }
  const webCallback = webCallbackFor(appEnv, webOrigin);
  if (redirectTo !== webCallback) {
    rejectRedirect();
  }

  return redirectTo;
}

export function assertSafeReturnPath(returnTo: string): string {
  const lowered = returnTo.toLowerCase();
  if (
    returnTo.length === 0 ||
    returnTo.length > 200 ||
    !returnTo.startsWith("/") ||
    returnTo.startsWith("//") ||
    returnTo.startsWith("/\\") ||
    returnTo.includes("\\") ||
    returnTo.includes(":") ||
    /\s/.test(returnTo) ||
    lowered.includes("%2f%2f") ||
    lowered.includes("%5c") ||
    lowered.includes("javascript")
  ) {
    rejectRedirect();
  }

  return returnTo;
}

export function authCodeFromCallback(
  callbackUrl: string,
  appEnv: AppEnv,
  webOrigin?: string,
): string {
  if (
    callbackUrl.includes("@") ||
    callbackUrl.toLowerCase().includes("access_token")
  ) {
    rejectRedirect();
  }

  const identity = callbackIdentity(callbackUrl, appEnv, webOrigin);
  if (
    identity === null ||
    (identity !== MOBILE_CALLBACK &&
      identity !== webCallbackFor(appEnv, webOrigin))
  ) {
    rejectRedirect();
  }

  const query = callbackUrl.slice(callbackUrl.indexOf("?") + 1).split("#")[0];
  const code = readQueryValue(query ?? "", "code");
  if (code === null || !/^[A-Za-z0-9_-]{8,512}$/.test(code)) {
    rejectRedirect();
  }

  return code;
}

export function callbackTargetFromUrl(
  callbackUrl: string,
  appEnv: AppEnv = "local",
  webOrigin?: string,
): string | null {
  return callbackIdentity(callbackUrl, appEnv, webOrigin);
}

function callbackIdentity(
  callbackUrl: string,
  appEnv: AppEnv,
  webOrigin?: string,
): string | null {
  for (const candidate of [MOBILE_CALLBACK]) {
    if (
      callbackUrl.startsWith(`${candidate}?`) ||
      callbackUrl.startsWith(`${candidate}#`) ||
      callbackUrl.startsWith(`${candidate}/?`) ||
      callbackUrl.startsWith(`${candidate}/#`)
    ) {
      return candidate;
    }
  }
  const expectedWebCallback = webCallbackFor(appEnv, webOrigin);
  for (const candidate of [expectedWebCallback]) {
    if (
      callbackUrl.startsWith(`${candidate}?`) ||
      callbackUrl.startsWith(`${candidate}#`) ||
      callbackUrl.startsWith(`${candidate}/?`) ||
      callbackUrl.startsWith(`${candidate}/#`)
    ) {
      return candidate;
    }
  }
  return null;
}

function webCallbackFor(appEnv: AppEnv, webOrigin?: string): string {
  const origin = webOrigin ?? (appEnv === "local" ? LOCAL_WEB_ORIGIN : null);
  if (origin === null) {
    rejectRedirect();
  }
  const isLocal = appEnv === "local" && origin === LOCAL_WEB_ORIGIN;
  const isHosted =
    appEnv !== "local" &&
    /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/u.test(
      origin,
    ) &&
    !origin.endsWith(".supabase.co");
  if (!isLocal && !isHosted) {
    rejectRedirect();
  }
  return `${origin}/auth/callback`;
}

function readQueryValue(query: string, key: string): string | null {
  for (const part of query.split("&")) {
    const separator = part.indexOf("=");
    const name = separator === -1 ? part : part.slice(0, separator);
    if (name === key) {
      const value = separator === -1 ? "" : part.slice(separator + 1);
      return decodeURIComponent(value);
    }
  }
  return null;
}
