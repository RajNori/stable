import {
  ApplicationError,
  AUTH_ERROR_MESSAGES,
  type AppEnv,
} from "@stable/contracts";

export const LOCAL_SIGN_IN_REDIRECTS = [
  "http://127.0.0.1:3000/auth/callback",
  "stable://auth/callback",
] as const;

const SIGN_IN_REDIRECTS: Record<AppEnv, readonly string[]> = {
  local: LOCAL_SIGN_IN_REDIRECTS,
  staging: [],
  production: [],
};

function rejectRedirect(): never {
  throw new ApplicationError(
    "VALIDATION_FAILED",
    AUTH_ERROR_MESSAGES.VALIDATION_FAILED,
  );
}

export function assertAllowedSignInRedirect(
  redirectTo: string,
  appEnv: AppEnv,
): string {
  const allowed = SIGN_IN_REDIRECTS[appEnv];
  if (!allowed.some((candidate) => candidate === redirectTo)) {
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
): string {
  if (
    callbackUrl.includes("@") ||
    callbackUrl.toLowerCase().includes("access_token")
  ) {
    rejectRedirect();
  }

  const identity = callbackIdentity(callbackUrl);
  if (
    identity === null ||
    !SIGN_IN_REDIRECTS[appEnv].some((candidate) => candidate === identity)
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

function callbackIdentity(callbackUrl: string): string | null {
  const web = "http://127.0.0.1:3000/auth/callback";
  const mobile = "stable://auth/callback";
  if (callbackUrl.startsWith(`${web}?`) || callbackUrl.startsWith(`${web}#`)) {
    return web;
  }
  if (
    callbackUrl.startsWith(`${web}/?`) ||
    callbackUrl.startsWith(`${web}/#`)
  ) {
    return web;
  }
  if (
    callbackUrl.startsWith(`${mobile}?`) ||
    callbackUrl.startsWith(`${mobile}#`)
  ) {
    return mobile;
  }
  return null;
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
