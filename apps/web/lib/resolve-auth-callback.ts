import { completeEmailCallback, type OtpAuthClient } from "@stable/auth";
import { AUTH_ERROR_MESSAGES, type AppEnv } from "@stable/contracts";

import { safeAuthMessage } from "./safe-auth-message";

const LOCAL_CALLBACK = "http://127.0.0.1:3000/auth/callback";

export type CallbackResolution =
  | { readonly status: "redirect"; readonly to: string }
  | { readonly status: "error"; readonly message: string };

export function callbackUrlFromCode(code: string | null): string {
  if (code === null || code.length === 0) {
    return LOCAL_CALLBACK;
  }
  return `${LOCAL_CALLBACK}?code=${encodeURIComponent(code)}`;
}

export function rejectProviderCallback(
  error: string,
): Extract<CallbackResolution, { status: "error" }> {
  const denied = error === "access_denied" || error === "user_cancelled";
  return {
    status: "error",
    message: denied
      ? AUTH_ERROR_MESSAGES.VALIDATION_FAILED
      : AUTH_ERROR_MESSAGES.UPSTREAM_UNAVAILABLE,
  };
}

export async function resolveAuthCallback(
  client: OtpAuthClient,
  input: { callbackUrl: string; appEnv: AppEnv; returnTo?: string },
): Promise<CallbackResolution> {
  try {
    const completed = await completeEmailCallback(client, input);
    return { status: "redirect", to: completed.returnTo };
  } catch (error) {
    return { status: "error", message: safeAuthMessage(error) };
  }
}
